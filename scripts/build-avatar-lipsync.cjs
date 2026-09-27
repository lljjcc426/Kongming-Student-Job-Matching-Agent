const fs = require('node:fs');
const path = require('node:path');

const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;
const LIP_SYNC_ANIMATION = 'KongMing_Talking_LipSync';
const ARRAY_BUFFER_TARGET = 34962;

const COMPONENT_LAYOUTS = {
  5121: { bytes: 1, read: (buffer, offset) => buffer.readUInt8(offset) },
  5123: { bytes: 2, read: (buffer, offset) => buffer.readUInt16LE(offset) },
  5125: { bytes: 4, read: (buffer, offset) => buffer.readUInt32LE(offset) },
  5126: { bytes: 4, read: (buffer, offset) => buffer.readFloatLE(offset) },
};

const TYPE_COMPONENTS = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
};

function align4(value) {
  return (value + 3) & ~3;
}

function readGlb(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF' || buffer.readUInt32LE(4) !== 2) {
    throw new Error(`${filePath} is not a valid glTF 2.0 binary file.`);
  }

  let document;
  let binary = Buffer.alloc(0);
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunk = buffer.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === JSON_CHUNK_TYPE) {
      document = JSON.parse(chunk.toString('utf8').replace(/\u0000/g, '').trim());
    } else if (chunkType === BIN_CHUNK_TYPE) {
      binary = Buffer.from(chunk);
    }
    offset += 8 + chunkLength;
  }

  if (!document) throw new Error(`${filePath} does not contain a JSON chunk.`);
  return { document, binary };
}

function writeGlb(filePath, document, binary) {
  const jsonSource = Buffer.from(JSON.stringify(document), 'utf8');
  const jsonLength = align4(jsonSource.length);
  const binaryLength = align4(binary.length);
  const totalLength = 12 + 8 + jsonLength + (binaryLength > 0 ? 8 + binaryLength : 0);
  const output = Buffer.alloc(totalLength);

  output.write('glTF', 0, 4, 'ascii');
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(totalLength, 8);
  output.writeUInt32LE(jsonLength, 12);
  output.writeUInt32LE(JSON_CHUNK_TYPE, 16);
  jsonSource.copy(output, 20);
  output.fill(0x20, 20 + jsonSource.length, 20 + jsonLength);

  if (binaryLength > 0) {
    const binaryHeader = 20 + jsonLength;
    output.writeUInt32LE(binaryLength, binaryHeader);
    output.writeUInt32LE(BIN_CHUNK_TYPE, binaryHeader + 4);
    binary.copy(output, binaryHeader + 8);
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, output);
}

function findAvatar(document) {
  const nodeIndex = (document.nodes ?? []).findIndex((node) => typeof node.mesh === 'number');
  if (nodeIndex < 0) throw new Error('The avatar does not contain a mesh node.');
  const node = document.nodes[nodeIndex];
  const mesh = document.meshes?.[node.mesh];
  if (!mesh) throw new Error('The avatar mesh is missing.');
  const names = mesh.extras?.targetNames ?? mesh.primitives?.[0]?.extras?.targetNames ?? [];
  if (names.length === 0) throw new Error('The avatar does not expose named morph targets.');
  return { nodeIndex, node, mesh, names };
}

function createWeights(names, values = {}) {
  return names.map((name) => values[name] ?? 0);
}

function readAccessor(document, binary, accessorIndex) {
  const accessor = document.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`Accessor ${accessorIndex} is missing.`);
  if (accessor.sparse) throw new Error(`Sparse accessor ${accessorIndex} is not supported.`);
  const component = COMPONENT_LAYOUTS[accessor.componentType];
  const componentCount = TYPE_COMPONENTS[accessor.type];
  if (!component || !componentCount) {
    throw new Error(`Accessor ${accessorIndex} uses an unsupported layout.`);
  }
  const values = new Array(accessor.count * componentCount).fill(0);
  if (accessor.bufferView === undefined) return values;
  const view = document.bufferViews?.[accessor.bufferView];
  if (!view || (view.buffer ?? 0) !== 0) {
    throw new Error(`Accessor ${accessorIndex} does not use the GLB binary buffer.`);
  }
  const packedStride = component.bytes * componentCount;
  const stride = view.byteStride ?? packedStride;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  for (let itemIndex = 0; itemIndex < accessor.count; itemIndex += 1) {
    const itemOffset = start + itemIndex * stride;
    for (let componentIndex = 0; componentIndex < componentCount; componentIndex += 1) {
      values[itemIndex * componentCount + componentIndex] = component.read(
        binary,
        itemOffset + componentIndex * component.bytes,
      );
    }
  }
  return values;
}

function normalizeVector(x, y, z, fallbackX, fallbackY, fallbackZ) {
  const length = Math.hypot(x, y, z);
  if (length < 1e-8) return [fallbackX, fallbackY, fallbackZ];
  return [x / length, y / length, z / length];
}

function calculateTangents(document, binary, primitive) {
  const positionAccessor = document.accessors[primitive.attributes.POSITION];
  const vertexCount = positionAccessor.count;
  const positions = readAccessor(document, binary, primitive.attributes.POSITION);
  const normals = readAccessor(document, binary, primitive.attributes.NORMAL);
  const texCoords = readAccessor(document, binary, primitive.attributes.TEXCOORD_0);
  const indices = primitive.indices === undefined
    ? Array.from({ length: vertexCount }, (_, index) => index)
    : readAccessor(document, binary, primitive.indices);
  const tangentSums = new Float64Array(vertexCount * 3);
  const bitangentSums = new Float64Array(vertexCount * 3);

  for (let index = 0; index + 2 < indices.length; index += 3) {
    const first = indices[index];
    const second = indices[index + 1];
    const third = indices[index + 2];
    const firstPosition = first * 3;
    const secondPosition = second * 3;
    const thirdPosition = third * 3;
    const firstUv = first * 2;
    const secondUv = second * 2;
    const thirdUv = third * 2;
    const edge1 = [
      positions[secondPosition] - positions[firstPosition],
      positions[secondPosition + 1] - positions[firstPosition + 1],
      positions[secondPosition + 2] - positions[firstPosition + 2],
    ];
    const edge2 = [
      positions[thirdPosition] - positions[firstPosition],
      positions[thirdPosition + 1] - positions[firstPosition + 1],
      positions[thirdPosition + 2] - positions[firstPosition + 2],
    ];
    const deltaUv1 = [
      texCoords[secondUv] - texCoords[firstUv],
      texCoords[secondUv + 1] - texCoords[firstUv + 1],
    ];
    const deltaUv2 = [
      texCoords[thirdUv] - texCoords[firstUv],
      texCoords[thirdUv + 1] - texCoords[firstUv + 1],
    ];
    const determinant = deltaUv1[0] * deltaUv2[1] - deltaUv1[1] * deltaUv2[0];
    if (Math.abs(determinant) < 1e-8) continue;
    const reciprocal = 1 / determinant;
    const tangent = [
      (edge1[0] * deltaUv2[1] - edge2[0] * deltaUv1[1]) * reciprocal,
      (edge1[1] * deltaUv2[1] - edge2[1] * deltaUv1[1]) * reciprocal,
      (edge1[2] * deltaUv2[1] - edge2[2] * deltaUv1[1]) * reciprocal,
    ];
    const bitangent = [
      (edge2[0] * deltaUv1[0] - edge1[0] * deltaUv2[0]) * reciprocal,
      (edge2[1] * deltaUv1[0] - edge1[1] * deltaUv2[0]) * reciprocal,
      (edge2[2] * deltaUv1[0] - edge1[2] * deltaUv2[0]) * reciprocal,
    ];
    for (const vertex of [first, second, third]) {
      const offset = vertex * 3;
      for (let axis = 0; axis < 3; axis += 1) {
        tangentSums[offset + axis] += tangent[axis];
        bitangentSums[offset + axis] += bitangent[axis];
      }
    }
  }

  const tangents = [];
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const offset = vertex * 3;
    const normal = normalizeVector(
      normals[offset], normals[offset + 1], normals[offset + 2], 0, 1, 0,
    );
    const normalDotTangent = normal[0] * tangentSums[offset]
      + normal[1] * tangentSums[offset + 1]
      + normal[2] * tangentSums[offset + 2];
    let tangent = normalizeVector(
      tangentSums[offset] - normal[0] * normalDotTangent,
      tangentSums[offset + 1] - normal[1] * normalDotTangent,
      tangentSums[offset + 2] - normal[2] * normalDotTangent,
      0, 0, 0,
    );
    if (tangent[0] === 0 && tangent[1] === 0 && tangent[2] === 0) {
      const helper = Math.abs(normal[1]) < 0.999 ? [0, 1, 0] : [1, 0, 0];
      tangent = normalizeVector(
        helper[1] * normal[2] - helper[2] * normal[1],
        helper[2] * normal[0] - helper[0] * normal[2],
        helper[0] * normal[1] - helper[1] * normal[0],
        1, 0, 0,
      );
    }
    const cross = [
      normal[1] * tangent[2] - normal[2] * tangent[1],
      normal[2] * tangent[0] - normal[0] * tangent[2],
      normal[0] * tangent[1] - normal[1] * tangent[0],
    ];
    const handedness = cross[0] * bitangentSums[offset]
      + cross[1] * bitangentSums[offset + 1]
      + cross[2] * bitangentSums[offset + 2] < 0 ? -1 : 1;
    tangents.push(tangent[0], tangent[1], tangent[2], handedness);
  }
  return tangents;
}

function applyStaticTest(document) {
  const { node, names } = findAvatar(document);
  node.weights = createWeights(names, {
    mouthOpen: 0.08,
    jawOpen: 0.16,
    viseme_aa: 0.48,
  });
}

function appendFloatData(document, binary, values, target) {
  const byteOffset = align4(binary.length);
  const data = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => data.writeFloatLE(value, index * 4));
  const combined = Buffer.alloc(byteOffset + data.length);
  binary.copy(combined);
  data.copy(combined, byteOffset);

  document.buffers ??= [{ byteLength: combined.length }];
  document.bufferViews ??= [];
  document.accessors ??= [];
  const bufferView = document.bufferViews.length;
  const view = {
    buffer: 0,
    byteOffset,
    byteLength: data.length,
  };
  if (target !== undefined) view.target = target;
  document.bufferViews.push(view);
  document.buffers[0].byteLength = combined.length;
  return { binary: combined, bufferView };
}

function prepareMorphAttributes(document, sourceBinary) {
  let binary = sourceBinary;
  for (const mesh of document.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if (!primitive.targets?.length) continue;
      const positionAccessor = document.accessors?.[primitive.attributes?.POSITION];
      if (!positionAccessor) throw new Error('A morphable primitive is missing its POSITION accessor.');
      const vertexCount = positionAccessor.count;

      if (primitive.attributes.TANGENT === undefined) {
        if (primitive.attributes.NORMAL === undefined || primitive.attributes.TEXCOORD_0 === undefined) {
          throw new Error('Cannot generate base tangents without NORMAL and TEXCOORD_0 attributes.');
        }
        const tangents = calculateTangents(document, binary, primitive);
        const appended = appendFloatData(document, binary, tangents, ARRAY_BUFFER_TARGET);
        binary = appended.binary;
        primitive.attributes.TANGENT = document.accessors.length;
        document.accessors.push({
          bufferView: appended.bufferView,
          componentType: 5126,
          count: vertexCount,
          type: 'VEC4',
        });
      }

      const missingMorphAttributes = primitive.targets.some((target) => (
        target.NORMAL === undefined || target.TANGENT === undefined
      ));
      if (!missingMorphAttributes) continue;
      const appended = appendFloatData(
        document,
        binary,
        new Array(vertexCount * 3).fill(0),
        ARRAY_BUFFER_TARGET,
      );
      binary = appended.binary;
      const zeroDeltaAccessor = document.accessors.length;
      document.accessors.push({
        bufferView: appended.bufferView,
        componentType: 5126,
        count: vertexCount,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [0, 0, 0],
      });
      for (const target of primitive.targets) {
        if (target.NORMAL === undefined) target.NORMAL = zeroDeltaAccessor;
        if (target.TANGENT === undefined) target.TANGENT = zeroDeltaAccessor;
      }
    }
  }
  document.buffers[0].byteLength = binary.length;
  return binary;
}

function addLipSyncAnimation(document, sourceBinary) {
  const { nodeIndex, names } = findAvatar(document);
  const frames = [
    { time: 0, values: {} },
    { time: 0.1, values: { viseme_PP: 0.42 } },
    { time: 0.22, values: { viseme_aa: 0.54, jawOpen: 0.08 } },
    { time: 0.34, values: { viseme_E: 0.48, jawOpen: 0.05 } },
    { time: 0.46, values: { viseme_sil: 0.25, eyeBlinkLeft: 0.92, eyeBlinkRight: 0.92 } },
    { time: 0.58, values: { viseme_O: 0.5, jawOpen: 0.06 } },
    { time: 0.7, values: { viseme_CH: 0.4 } },
    { time: 0.82, values: { viseme_aa: 0.5, jawOpen: 0.07 } },
    { time: 0.94, values: { viseme_I: 0.42 } },
    { time: 1.06, values: { viseme_FF: 0.36 } },
    { time: 1.18, values: { viseme_U: 0.45 } },
    { time: 1.3, values: {} },
  ];
  const times = frames.map((frame) => frame.time);
  const weights = frames.flatMap((frame) => createWeights(names, frame.values));

  let result = appendFloatData(document, sourceBinary, times);
  const timeBufferView = result.bufferView;
  result = appendFloatData(document, result.binary, weights);
  const weightBufferView = result.bufferView;

  const timeAccessor = document.accessors.length;
  document.accessors.push({
    bufferView: timeBufferView,
    componentType: 5126,
    count: times.length,
    type: 'SCALAR',
    min: [times[0]],
    max: [times[times.length - 1]],
  });
  const weightAccessor = document.accessors.length;
  document.accessors.push({
    bufferView: weightBufferView,
    componentType: 5126,
    count: weights.length,
    type: 'SCALAR',
    min: [0],
    max: [1],
  });

  document.animations ??= [];
  document.animations = document.animations.filter((animation) => animation.name !== LIP_SYNC_ANIMATION);
  document.animations.push({
    name: LIP_SYNC_ANIMATION,
    samplers: [{ input: timeAccessor, output: weightAccessor, interpolation: 'LINEAR' }],
    channels: [{ sampler: 0, target: { node: nodeIndex, path: 'weights' } }],
    extras: { purpose: 'native-interview-lip-sync', morphTargetCount: names.length },
  });
  document.buffers[0].byteLength = result.binary.length;
  return result.binary;
}

function main() {
  const args = process.argv.slice(2);
  const staticTest = args.includes('--static-test');
  const runtimeMorphs = args.includes('--runtime-morphs');
  const files = args.filter((arg) => !arg.startsWith('--'));
  if (files.length !== 2) {
    throw new Error(
      'Usage: node scripts/build-avatar-lipsync.cjs <input.glb> <output.glb> [--static-test|--runtime-morphs]',
    );
  }

  const input = path.resolve(files[0]);
  const output = path.resolve(files[1]);
  const { document, binary } = readGlb(input);
  let outputBinary = prepareMorphAttributes(document, binary);
  if (staticTest) {
    applyStaticTest(document);
  } else if (!runtimeMorphs) {
    outputBinary = addLipSyncAnimation(document, outputBinary);
  }
  writeGlb(output, document, outputBinary);
  const mode = staticTest ? 'Static morph test' : runtimeMorphs ? 'Runtime morph support' : 'Lip-sync animation';
  console.log(`${mode} written to ${output}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
