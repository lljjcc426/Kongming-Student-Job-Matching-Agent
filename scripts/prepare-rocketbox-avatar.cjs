const fs = require('node:fs');
const path = require('node:path');

const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;

const TARGET_MAPPINGS = [
  ['AA_VI_00_Sil', 'viseme_sil'],
  ['AA_VI_01_PP', 'viseme_PP'],
  ['AA_VI_02_FF', 'viseme_FF'],
  ['AA_VI_03_TH', 'viseme_TH'],
  ['AA_VI_04_DD', 'viseme_DD'],
  ['AA_VI_05_KK', 'viseme_kk'],
  ['AA_VI_06_CH', 'viseme_CH'],
  ['AA_VI_07_SS', 'viseme_SS'],
  ['AA_VI_08_nn', 'viseme_nn'],
  ['AA_VI_09_RR', 'viseme_RR'],
  ['AA_VI_10_aa', 'viseme_aa'],
  ['AA_VI_11_E', 'viseme_E'],
  ['AA_VI_12_I', 'viseme_I'],
  ['AA_VI_13_O', 'viseme_O'],
  ['AA_VI_14_U', 'viseme_U'],
  ['AU_25_LipsPart', 'mouthOpen'],
  ['AK_25_JawOpen', 'jawOpen'],
  ['HB_07_MouthSmile', 'mouthSmile'],
  ['AK_36_MouthPressLeft', 'mouthPressLeft'],
  ['AK_37_MouthPressRight', 'mouthPressRight'],
  ['AK_03_BrowInnerUp', 'browInnerUp'],
  ['AK_04_BrowOuterUpLeft', 'browOuterUpLeft'],
  ['AK_05_BrowOuterUpRight', 'browOuterUpRight'],
  ['AK_21_EyeWideLeft', 'eyeWideLeft'],
  ['AK_22_EyeWideRight', 'eyeWideRight'],
  ['AU_64_EyesDown', 'eyesLookDown'],
  ['AK_09_EyeBlinkLeft', 'eyeBlinkLeft'],
  ['AK_10_EyeBlinkRight', 'eyeBlinkRight'],
];

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
  const totalLength = 12 + 8 + jsonLength + 8 + binaryLength;
  const output = Buffer.alloc(totalLength);

  output.write('glTF', 0, 4, 'ascii');
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(totalLength, 8);
  output.writeUInt32LE(jsonLength, 12);
  output.writeUInt32LE(JSON_CHUNK_TYPE, 16);
  jsonSource.copy(output, 20);
  output.fill(0x20, 20 + jsonSource.length, 20 + jsonLength);

  const binaryHeader = 20 + jsonLength;
  output.writeUInt32LE(binaryLength, binaryHeader);
  output.writeUInt32LE(BIN_CHUNK_TYPE, binaryHeader + 4);
  binary.copy(output, binaryHeader + 8);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, output);
}

function extractSourceMorphNames(fbxPath) {
  const source = fs.readFileSync(fbxPath).toString('latin1');
  const names = [];
  const seen = new Set();
  const matcher = /blendShape1\.([A-Za-z0-9_]+)/g;
  let match;
  while ((match = matcher.exec(source)) !== null) {
    if (seen.has(match[1])) continue;
    seen.add(match[1]);
    names.push(match[1]);
  }
  if (names.length === 0) throw new Error('No Rocketbox blend-shape channels were found in the FBX source.');
  return names;
}

function prepareMorphTargets(document, sourceNames) {
  const sourceIndexes = new Map(sourceNames.map((name, index) => [name, index]));
  const selections = TARGET_MAPPINGS.map(([sourceName, targetName]) => {
    const sourceIndex = sourceIndexes.get(sourceName);
    if (sourceIndex === undefined) throw new Error(`Required Rocketbox morph target is missing: ${sourceName}`);
    return { sourceIndex, targetName };
  });

  for (const mesh of document.meshes ?? []) {
    const largestTargetCount = Math.max(0, ...(mesh.primitives ?? []).map((primitive) => primitive.targets?.length ?? 0));
    if (largestTargetCount !== sourceNames.length) {
      throw new Error(`Mesh ${mesh.name ?? 'unnamed'} has ${largestTargetCount} targets; expected ${sourceNames.length}.`);
    }
    for (const primitive of mesh.primitives ?? []) {
      primitive.targets = selections.map(({ sourceIndex }) => primitive.targets[sourceIndex]);
    }
    mesh.weights = selections.map(({ sourceIndex }) => mesh.weights?.[sourceIndex] ?? 0);
    mesh.extras = {
      ...(mesh.extras ?? {}),
      targetNames: selections.map(({ targetName }) => targetName),
      sourceMorphTargetCount: sourceNames.length,
    };
  }

  for (const node of document.nodes ?? []) {
    if (node.mesh === undefined) continue;
    node.weights = selections.map(({ sourceIndex }) => node.weights?.[sourceIndex] ?? 0);
  }

  delete document.animations;
}

function appendBinary(document, binary, data, target) {
  const byteOffset = align4(binary.length);
  const combined = Buffer.alloc(byteOffset + data.length);
  binary.copy(combined);
  data.copy(combined, byteOffset);
  const bufferView = document.bufferViews.length;
  const view = { buffer: 0, byteOffset, byteLength: data.length };
  if (target !== undefined) view.target = target;
  document.bufferViews.push(view);
  return { binary: combined, bufferView };
}

function embedTextures(document, sourceBinary, textureDirectory) {
  const textureFiles = (document.images ?? []).map((image, index) => {
    const sourceName = path.basename(image.name ?? image.uri ?? '');
    if (!sourceName) throw new Error(`Converted texture slot ${index} has no source name.`);
    return sourceName.replace(/\.[^.]+$/, '.png');
  });
  if (textureFiles.length === 0) throw new Error('Converted avatar contains no texture slots.');
  let binary = sourceBinary;
  textureFiles.forEach((fileName, imageIndex) => {
    const texturePath = path.join(textureDirectory, fileName);
    const png = fs.readFileSync(texturePath);
    if (png.toString('latin1', 1, 4) !== 'PNG') throw new Error(`${texturePath} is not a PNG image.`);
    const appended = appendBinary(document, binary, png);
    binary = appended.binary;
    document.images[imageIndex] = {
      name: path.basename(fileName, '.png'),
      bufferView: appended.bufferView,
      mimeType: 'image/png',
    };
  });
  return binary;
}

function tuneMaterials(document) {
  for (const material of document.materials ?? []) {
    const isOpacityMaterial = material.name?.toLowerCase().includes('opacity') ?? false;
    material.pbrMetallicRoughness ??= {};
    material.pbrMetallicRoughness.metallicFactor = 0;
    material.pbrMetallicRoughness.roughnessFactor = isOpacityMaterial ? 0.84 : 0.72;
    material.pbrMetallicRoughness.baseColorFactor = [1, 1, 1, 1];
    if (material.normalTexture) material.normalTexture.scale = 0.52;
    if (isOpacityMaterial) {
      material.alphaMode = 'MASK';
      material.alphaCutoff = 0.36;
      material.doubleSided = true;
      delete material.normalTexture;
    } else {
      material.alphaMode = 'OPAQUE';
      material.doubleSided = false;
    }
  }
}

function collectAccessorReferences(document) {
  const references = new Set();
  for (const mesh of document.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if (primitive.indices !== undefined) references.add(primitive.indices);
      Object.values(primitive.attributes ?? {}).forEach((index) => references.add(index));
      for (const target of primitive.targets ?? []) {
        Object.values(target).forEach((index) => references.add(index));
      }
    }
  }
  for (const skin of document.skins ?? []) {
    if (skin.inverseBindMatrices !== undefined) references.add(skin.inverseBindMatrices);
  }
  return [...references].sort((left, right) => left - right);
}

function pruneAccessors(document) {
  const used = collectAccessorReferences(document);
  const remap = new Map(used.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  const remapIndex = (oldIndex) => {
    const newIndex = remap.get(oldIndex);
    if (newIndex === undefined) throw new Error(`Accessor ${oldIndex} was not retained.`);
    return newIndex;
  };

  for (const mesh of document.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if (primitive.indices !== undefined) primitive.indices = remapIndex(primitive.indices);
      for (const name of Object.keys(primitive.attributes ?? {})) {
        primitive.attributes[name] = remapIndex(primitive.attributes[name]);
      }
      for (const target of primitive.targets ?? []) {
        for (const name of Object.keys(target)) target[name] = remapIndex(target[name]);
      }
    }
  }
  for (const skin of document.skins ?? []) {
    if (skin.inverseBindMatrices !== undefined) skin.inverseBindMatrices = remapIndex(skin.inverseBindMatrices);
  }
  document.accessors = used.map((index) => document.accessors[index]);
}

function collectBufferViewReferences(document) {
  const references = new Set();
  for (const accessor of document.accessors ?? []) {
    if (accessor.bufferView !== undefined) references.add(accessor.bufferView);
    if (accessor.sparse?.indices?.bufferView !== undefined) references.add(accessor.sparse.indices.bufferView);
    if (accessor.sparse?.values?.bufferView !== undefined) references.add(accessor.sparse.values.bufferView);
  }
  for (const image of document.images ?? []) {
    if (image.bufferView !== undefined) references.add(image.bufferView);
  }
  return [...references].sort((left, right) => left - right);
}

function compactBufferViews(document, sourceBinary) {
  const used = collectBufferViewReferences(document);
  const remap = new Map();
  const chunks = [];
  let byteLength = 0;

  used.forEach((oldIndex, newIndex) => {
    const view = document.bufferViews[oldIndex];
    const start = view.byteOffset ?? 0;
    const end = start + view.byteLength;
    if ((view.buffer ?? 0) !== 0 || end > sourceBinary.length) {
      throw new Error(`Buffer view ${oldIndex} points outside the source GLB binary.`);
    }
    byteLength = align4(byteLength);
    remap.set(oldIndex, newIndex);
    chunks.push({ offset: byteLength, data: sourceBinary.subarray(start, end), view });
    byteLength += view.byteLength;
  });

  const binary = Buffer.alloc(byteLength);
  document.bufferViews = chunks.map(({ offset, data, view }) => {
    data.copy(binary, offset);
    return { ...view, buffer: 0, byteOffset: offset };
  });
  const remapIndex = (oldIndex) => {
    const newIndex = remap.get(oldIndex);
    if (newIndex === undefined) throw new Error(`Buffer view ${oldIndex} was not retained.`);
    return newIndex;
  };
  for (const accessor of document.accessors ?? []) {
    if (accessor.bufferView !== undefined) accessor.bufferView = remapIndex(accessor.bufferView);
    if (accessor.sparse?.indices?.bufferView !== undefined) {
      accessor.sparse.indices.bufferView = remapIndex(accessor.sparse.indices.bufferView);
    }
    if (accessor.sparse?.values?.bufferView !== undefined) {
      accessor.sparse.values.bufferView = remapIndex(accessor.sparse.values.bufferView);
    }
  }
  for (const image of document.images ?? []) {
    if (image.bufferView !== undefined) image.bufferView = remapIndex(image.bufferView);
  }
  document.buffers = [{ byteLength: binary.length }];
  return binary;
}

function main() {
  const [inputGlb, sourceFbx, textureDirectory, outputGlb] = process.argv.slice(2);
  if (!outputGlb) {
    throw new Error(
      'Usage: node scripts/prepare-rocketbox-avatar.cjs <converted.glb> <source.fbx> <texture-dir> <output.glb>',
    );
  }

  const input = path.resolve(inputGlb);
  const fbx = path.resolve(sourceFbx);
  const textures = path.resolve(textureDirectory);
  const output = path.resolve(outputGlb);
  const { document, binary: sourceBinary } = readGlb(input);
  const sourceNames = extractSourceMorphNames(fbx);
  prepareMorphTargets(document, sourceNames);
  tuneMaterials(document);
  let binary = embedTextures(document, sourceBinary, textures);
  pruneAccessors(document);
  binary = compactBufferViews(document, binary);
  document.asset.generator = 'KongMing Rocketbox mobile avatar pipeline';
  document.asset.copyright = 'Microsoft Rocketbox Avatar Library, MIT License';
  document.asset.extras = {
    sourceRepository: 'https://github.com/microsoft/Microsoft-Rocketbox',
    sourceCommit: '0943055db6ec570bcef9f2c8b41c9e5467c808f9',
    sourceAvatar: path.basename(fbx, path.extname(fbx)),
    runtimeStateDriver: 'ArkTS NativeDigitalInterviewer',
    runtimeStates: ['idle', 'listening', 'talking', 'greeting', 'thinking'],
  };
  writeGlb(output, document, binary);
  console.log(`Prepared ${TARGET_MAPPINGS.length} runtime morph targets in ${output}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
