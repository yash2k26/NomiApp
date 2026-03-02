/**
 * Merge external animation clips into nomi-combined.glb
 *
 * Extracts animation data from GangamStyle.glb, FallOver.glb, Punch.glb, backflip.glb
 * and bakes them into nomi-combined.glb so the app loads a single file.
 */

import { NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization } from '@gltf-transform/extensions';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const BASE_GLB = path.join(ROOT, 'assets/pets/nomi-combined.glb');
const OUTPUT_GLB = path.join(ROOT, 'assets/pets/nomi-combined-merged.glb');

// Animation sources: [file, rename map]
// Each animation GLB may have multiple clips named mixamo.com, mixamo.com.001, etc.
// We pick the longest clip (main animation) and give it a descriptive name.
const ANIM_SOURCES = [
  {
    file: path.join(ROOT, 'assets/animation/GangamStyle.glb'),
    // The longer clip (mixamo.com.001 at ~12s) is the main dance
    pickStrategy: 'longest',
    name: 'Gangnam',
  },
  {
    file: path.join(ROOT, 'assets/animation/FallOver.glb'),
    pickStrategy: 'longest',
    name: 'FallOver',
  },
  {
    file: path.join(ROOT, 'assets/animation/Punch.glb'),
    pickStrategy: 'longest',
    name: 'Punch',
  },
  {
    file: path.join(ROOT, 'assets/animation/backflip.glb'),
    pickStrategy: 'longest',
    name: 'Backflip',
  },
];

async function main() {
  const io = new NodeIO().registerExtensions([KHRMeshQuantization]);

  // Read base document
  console.log('Reading base GLB:', BASE_GLB);
  const baseDoc = await io.read(BASE_GLB);
  const baseRoot = baseDoc.getRoot();

  console.log('Existing animations in base:');
  for (const anim of baseRoot.listAnimations()) {
    console.log(`  - "${anim.getName()}" (${anim.listChannels().length} channels)`);
  }

  for (const source of ANIM_SOURCES) {
    console.log(`\nProcessing: ${path.basename(source.file)} → "${source.name}"`);

    const animDoc = await io.read(source.file);
    const animRoot = animDoc.getRoot();
    const animations = animRoot.listAnimations();

    if (animations.length === 0) {
      console.warn(`  No animations found, skipping.`);
      continue;
    }

    // Pick the longest animation clip
    let bestAnim = animations[0];
    let bestDuration = 0;
    for (const anim of animations) {
      let maxTime = 0;
      for (const sampler of anim.listSamplers()) {
        const input = sampler.getInput();
        if (input) {
          const arr = input.getArray();
          if (arr && arr.length > 0) {
            maxTime = Math.max(maxTime, arr[arr.length - 1]);
          }
        }
      }
      console.log(`  Clip "${anim.getName()}" duration: ${maxTime.toFixed(2)}s, channels: ${anim.listChannels().length}`);
      if (maxTime > bestDuration) {
        bestDuration = maxTime;
        bestAnim = anim;
      }
    }

    console.log(`  Selected: "${bestAnim.getName()}" (${bestDuration.toFixed(2)}s)`);

    // We need to copy the animation data manually since documents can't share properties.
    // Strategy: copy samplers (input/output accessors) and channels, retarget node references by bone name.

    // Build a bone-name map from the base document
    const baseBoneMap = new Map();
    for (const node of baseRoot.listNodes()) {
      const name = node.getName();
      if (name) baseBoneMap.set(name, node);
    }

    // Create new animation in base document
    const newAnim = baseDoc.createAnimation(source.name);

    let copiedChannels = 0;
    let skippedChannels = 0;

    for (const channel of bestAnim.listChannels()) {
      const sampler = channel.getSampler();
      const targetNode = channel.getTargetNode();
      const targetPath = channel.getTargetPath();

      if (!sampler || !targetNode || !targetPath) {
        skippedChannels++;
        continue;
      }

      const boneName = targetNode.getName();
      const baseNode = baseBoneMap.get(boneName);

      if (!baseNode) {
        // Try without prefix — some mixamo exports have paths like "Armature/mixamorig:Hips"
        // We already strip paths in PetRenderer, but here we need exact node name matches
        skippedChannels++;
        continue;
      }

      // Copy input accessor (keyframe times)
      const inputAcc = sampler.getInput();
      const outputAcc = sampler.getOutput();
      if (!inputAcc || !outputAcc) {
        skippedChannels++;
        continue;
      }

      const newInput = baseDoc.createAccessor()
        .setType(inputAcc.getType())
        .setArray(inputAcc.getArray().slice());

      const newOutput = baseDoc.createAccessor()
        .setType(outputAcc.getType())
        .setArray(outputAcc.getArray().slice());

      const newSampler = baseDoc.createAnimationSampler()
        .setInput(newInput)
        .setOutput(newOutput)
        .setInterpolation(sampler.getInterpolation());

      const newChannel = baseDoc.createAnimationChannel()
        .setSampler(newSampler)
        .setTargetNode(baseNode)
        .setTargetPath(targetPath);

      newAnim.addSampler(newSampler);
      newAnim.addChannel(newChannel);
      copiedChannels++;
    }

    console.log(`  Copied ${copiedChannels} channels, skipped ${skippedChannels}`);
  }

  // Summary
  console.log('\n=== Final animations in merged GLB ===');
  for (const anim of baseRoot.listAnimations()) {
    console.log(`  - "${anim.getName()}" (${anim.listChannels().length} channels)`);
  }

  // Write output
  console.log(`\nWriting merged GLB to: ${OUTPUT_GLB}`);
  await io.write(OUTPUT_GLB, baseDoc);
  console.log('Done!');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
