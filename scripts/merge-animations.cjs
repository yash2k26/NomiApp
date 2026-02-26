/**
 * Merges animations from multiple GLB files into a single GLB.
 * All files must share the same skeleton (bone names).
 * The base file provides the mesh + skeleton, other files contribute animations only.
 */
const { NodeIO } = require('@gltf-transform/core');

const ANIMATION_SOURCES = [
  // [file, animationIndex, newName]
  // breathing2.glb has 2 anims: [0]=excited-like(6s), [1]=breathing(10s)
  ['assets/pets/breathing2.glb', 1, 'Breathing'],
  ['assets/pets/excited2.glb', 0, 'Excited'],
  ['assets/pets/Sad.glb', 0, 'Sad'],
  // fall.glb has 3 anims: [0]=excited-like(6s), [1]=idle(10s), [2]=fall(2s)
  ['assets/pets/fall.glb', 2, 'Fall'],
  ['assets/pets/Dance.glb', 0, 'Dance'],
];

const BASE_FILE = 'assets/pets/breathing2.glb';
const OUTPUT_FILE = 'assets/pets/nomi-all.glb';

(async () => {
  const io = new NodeIO();

  // Read base document (mesh + skeleton + textures)
  console.log(`Reading base: ${BASE_FILE}`);
  const baseDoc = await io.read(BASE_FILE);
  const baseRoot = baseDoc.getRoot();

  // Build a map: bone name → node reference in base document
  const baseNodeMap = new Map();
  baseRoot.listNodes().forEach(node => {
    if (node.getName()) baseNodeMap.set(node.getName(), node);
  });

  // Remove all existing animations from base
  baseRoot.listAnimations().forEach(anim => anim.dispose());
  console.log('Cleared existing animations from base.');

  // For each source, read the file, extract the animation, and recreate it in the base doc
  for (const [file, animIndex, name] of ANIMATION_SOURCES) {
    console.log(`\nImporting "${name}" from ${file} [index ${animIndex}]...`);
    const srcDoc = await io.read(file);
    const srcAnims = srcDoc.getRoot().listAnimations();

    if (animIndex >= srcAnims.length) {
      console.error(`  ERROR: ${file} only has ${srcAnims.length} animations, index ${animIndex} out of range`);
      continue;
    }

    const srcAnim = srcAnims[animIndex];
    const channels = srcAnim.listChannels();
    const samplers = srcAnim.listSamplers();

    console.log(`  Source: "${srcAnim.getName()}" — ${channels.length} channels, ${samplers.length} samplers`);

    // Create new animation in base document
    const newAnim = baseDoc.createAnimation(name);

    // Copy each channel: recreate sampler + channel targeting the base node
    for (const srcChannel of channels) {
      const srcSampler = srcChannel.getSampler();
      const targetNode = srcChannel.getTargetNode();
      const targetPath = srcChannel.getTargetPath();

      if (!targetNode || !srcSampler) continue;

      const boneName = targetNode.getName();
      const baseNode = baseNodeMap.get(boneName);

      if (!baseNode) {
        console.warn(`  WARN: bone "${boneName}" not found in base, skipping channel`);
        continue;
      }

      // Copy sampler data (input = times, output = values)
      const srcInput = srcSampler.getInput();
      const srcOutput = srcSampler.getOutput();
      if (!srcInput || !srcOutput) continue;

      // Create accessors in base document
      const inputAcc = baseDoc.createAccessor()
        .setType(srcInput.getType())
        .setArray(srcInput.getArray().slice());

      const outputAcc = baseDoc.createAccessor()
        .setType(srcOutput.getType())
        .setArray(srcOutput.getArray().slice());

      // Create sampler
      const newSampler = baseDoc.createAnimationSampler()
        .setInput(inputAcc)
        .setOutput(outputAcc)
        .setInterpolation(srcSampler.getInterpolation());

      // Create channel
      const newChannel = baseDoc.createAnimationChannel()
        .setSampler(newSampler)
        .setTargetNode(baseNode)
        .setTargetPath(targetPath);

      newAnim.addSampler(newSampler);
      newAnim.addChannel(newChannel);
    }

    console.log(`  Created "${name}" with ${newAnim.listChannels().length} channels`);
  }

  // List final animations
  console.log('\n=== Final animations ===');
  baseRoot.listAnimations().forEach(a => {
    console.log(`  ${a.getName()} — ${a.listChannels().length} channels`);
  });

  // Write output
  console.log(`\nWriting ${OUTPUT_FILE}...`);
  await io.write(OUTPUT_FILE, baseDoc);

  const fs = require('fs');
  const stat = fs.statSync(OUTPUT_FILE);
  console.log(`Done! ${OUTPUT_FILE} — ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
})();
