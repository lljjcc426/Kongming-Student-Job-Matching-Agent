const fs = require('node:fs');
const path = require('node:path');

const JSON_CHUNK_TYPE = 0x4e4f534a;
const REQUIRED_VISEMES = [
  'viseme_sil',
  'viseme_PP',
  'viseme_FF',
  'viseme_TH',
  'viseme_DD',
  'viseme_kk',
  'viseme_CH',
  'viseme_SS',
  'viseme_nn',
  'viseme_RR',
  'viseme_aa',
  'viseme_E',
  'viseme_I',
  'viseme_O',
  'viseme_U',
];

function readGlbJson(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error(`${filePath} is not a valid binary glTF file.`);
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > buffer.length) throw new Error(`${filePath} contains an invalid GLB chunk.`);
    if (chunkType === JSON_CHUNK_TYPE) {
      const text = buffer.subarray(chunkStart, chunkEnd).toString('utf8').replace(/\u0000/g, '').trim();
      return { document: JSON.parse(text), bytes: buffer.length };
    }
    offset = chunkEnd;
  }

  throw new Error(`${filePath} does not contain a JSON chunk.`);
}

function accessorCount(document, index) {
  if (typeof index !== 'number') return 0;
  return document.accessors?.[index]?.count ?? 0;
}

function collectMorphTargetNames(document) {
  const names = new Set();
  for (const mesh of document.meshes ?? []) {
    for (const name of mesh.extras?.targetNames ?? []) names.add(name);
    for (const primitive of mesh.primitives ?? []) {
      for (const name of primitive.extras?.targetNames ?? []) names.add(name);
    }
  }
  return [...names];
}

function countMorphTargetSlots(document) {
  let total = 0;
  for (const mesh of document.meshes ?? []) {
    const largestPrimitiveTargetCount = Math.max(
      0,
      ...(mesh.primitives ?? []).map((primitive) => primitive.targets?.length ?? 0),
    );
    total += largestPrimitiveTargetCount;
  }
  return total;
}

function countTriangles(document) {
  let total = 0;
  for (const mesh of document.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if (primitive.mode !== undefined && primitive.mode !== 4) continue;
      const vertexCount = primitive.indices !== undefined
        ? accessorCount(document, primitive.indices)
        : accessorCount(document, primitive.attributes?.POSITION);
      total += Math.floor(vertexCount / 3);
    }
  }
  return total;
}

function inspect(filePath) {
  const absolutePath = path.resolve(filePath);
  const { document, bytes } = readGlbJson(absolutePath);
  const morphTargetNames = collectMorphTargetNames(document);
  const missingVisemes = REQUIRED_VISEMES.filter((name) => !morphTargetNames.includes(name));
  const animationNames = (document.animations ?? []).map((animation) => animation.name ?? 'unnamed');
  const normalizedAnimationNames = animationNames.map((name) => name.toLowerCase());
  const runtimeStates = Array.isArray(document.asset?.extras?.runtimeStates)
    ? document.asset.extras.runtimeStates.map((state) => String(state).toLowerCase())
    : [];
  const stateAnimationCoverage = {
    idle: runtimeStates.includes('idle') || normalizedAnimationNames.some((name) => name.includes('idle')),
    listening: runtimeStates.includes('listening') || normalizedAnimationNames.some((name) => name.includes('listen')),
    talking: runtimeStates.includes('talking')
      || normalizedAnimationNames.some((name) => name.includes('talk') || name.includes('speak')),
    greeting: normalizedAnimationNames.some((name) => (
      name.includes('greet') || name.includes('wave') || name.includes('salute')
    )) || runtimeStates.includes('greeting'),
    thinking: runtimeStates.includes('thinking') || normalizedAnimationNames.some((name) => name.includes('think')),
  };
  const triangleCount = countTriangles(document);
  const jointCount = Math.max(0, ...(document.skins ?? []).map((skin) => skin.joints?.length ?? 0));
  const withinMobileBudget = bytes <= 20 * 1024 * 1024 && triangleCount <= 100000;
  const hasRequiredStateAnimations = (
    stateAnimationCoverage.idle && stateAnimationCoverage.listening && stateAnimationCoverage.talking
  );

  return {
    file: absolutePath,
    generator: document.asset?.generator ?? 'unknown',
    byteSize: bytes,
    triangleCount,
    nodeCount: document.nodes?.length ?? 0,
    meshCount: document.meshes?.length ?? 0,
    materialCount: document.materials?.length ?? 0,
    skinCount: document.skins?.length ?? 0,
    jointCount,
    animationNames,
    runtimeStateDriver: document.asset?.extras?.runtimeStateDriver ?? '',
    stateAnimationCoverage,
    morphTargetSlotCount: countMorphTargetSlots(document),
    morphTargetNames,
    requiredVisemeCount: REQUIRED_VISEMES.length,
    missingVisemes,
    withinMobileBudget,
    facialRigReady: jointCount > 0 && missingVisemes.length === 0,
    interviewReady: withinMobileBudget
      && jointCount > 0
      && missingVisemes.length === 0
      && hasRequiredStateAnimations,
  };
}

function printSummary(result) {
  console.log(`Avatar: ${result.file}`);
  console.log(`Generator: ${result.generator}`);
  console.log(`Size: ${(result.byteSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Triangles: ${result.triangleCount.toLocaleString('en-US')}`);
  console.log(`Skeleton: ${result.skinCount} skin(s), ${result.jointCount} joints`);
  console.log(`Animations: ${result.animationNames.length} (${result.animationNames.join(', ') || 'none'})`);
  if (result.runtimeStateDriver) console.log(`Runtime state driver: ${result.runtimeStateDriver}`);
  console.log(`State coverage: ${Object.entries(result.stateAnimationCoverage)
    .map(([state, covered]) => `${state}=${covered ? 'yes' : 'no'}`)
    .join(', ')}`);
  console.log(`Morph targets: ${result.morphTargetNames.length} named / ${result.morphTargetSlotCount} slots`);
  console.log(`Visemes: ${result.requiredVisemeCount - result.missingVisemes.length}/${result.requiredVisemeCount}`);
  if (result.missingVisemes.length > 0) console.log(`Missing visemes: ${result.missingVisemes.join(', ')}`);
  console.log(`Mobile budget: ${result.withinMobileBudget ? 'pass' : 'fail'}`);
  console.log(`Facial rig ready: ${result.facialRigReady ? 'yes' : 'no'}`);
  console.log(`Interview ready: ${result.interviewReady ? 'yes' : 'no'}`);
}

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const strict = args.includes('--strict');
const files = args.filter((arg) => !arg.startsWith('--'));

if (files.length === 0) {
  console.error('Usage: node scripts/inspect-avatar-glb.cjs <avatar.glb> [more.glb] [--json] [--strict]');
  process.exit(1);
}

let failed = false;
const results = [];
for (const file of files) {
  try {
    const result = inspect(file);
    results.push(result);
    if (strict && !result.interviewReady) failed = true;
  } catch (error) {
    failed = true;
    console.error(error instanceof Error ? error.message : String(error));
  }
}

if (jsonOutput) {
  console.log(JSON.stringify(results, null, 2));
} else {
  results.forEach((result, index) => {
    if (index > 0) console.log('');
    printSummary(result);
  });
}

if (failed) process.exit(1);
