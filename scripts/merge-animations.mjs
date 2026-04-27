/**
 * Merge external animation clips into nomi-combined.glb (in place).
 *
 * Drop Mixamo-rigged GLBs into assets/animation/ matching the names below,
 * then run: node scripts/merge-animations.mjs
 *
 * Missing source files are skipped with a warning, so you can add one at a time.
 */

import { NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization } from '@gltf-transform/extensions';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const BASE_GLB = path.join(ROOT, 'assets/pets/nomi-combined.glb');
// Overwrite the runtime asset directly (matches the bake_all_accessories.py pattern).
const OUTPUT_GLB = BASE_GLB;

// Animation sources. For each entry, drop a Mixamo-rigged GLB at `file`.
// `name` must match the values in CLIP_NAME_MAP inside src/components/PetRenderer.tsx.
// Pick strategy:
//   - pickClipName: import the clip with this exact name (best for multi-clip Mixamo bundles)
//   - pickStrategy: 'longest' picks the clip with the largest duration (fallback only)
// If both are set, pickClipName wins. If pickClipName misses, falls back to longest with a warning.
const ANIM_SOURCES = [
  {
    file: path.join(ROOT, 'assets/pets/sources/gubu-dance.glb'),
    pickClipName: 'Armature.001|mixamo.com|Layer0',  // 6.13s — third attempt
    name: 'Dance',
  },
  {
    file: path.join(ROOT, 'assets/pets/sources/gubu-backflip.glb'),
    pickClipName: 'Armature|mixamo.com|Layer0.004',  // 2.27s — second attempt (Layer0.003 may be wrong)
    name: 'Backflip',
  },
  {
    file: path.join(ROOT, 'assets/animation/Punch.glb'),
    pickStrategy: 'longest',
    name: 'Punch',
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

    if (!existsSync(source.file)) {
      console.warn(`  Source file not found, skipping. Drop one at: ${source.file}`);
      continue;
    }

    const animDoc = await io.read(source.file);
    const animRoot = animDoc.getRoot();
    const animations = animRoot.listAnimations();

    if (animations.length === 0) {
      console.warn(`  No animations found, skipping.`);
      continue;
    }

    // Pick the target clip — by explicit name if specified, else by longest duration
    const clipDuration = (anim) => {
      let maxTime = 0;
      for (const sampler of anim.listSamplers()) {
        const arr = sampler.getInput()?.getArray();
        if (arr && arr.length > 0) maxTime = Math.max(maxTime, arr[arr.length - 1]);
      }
      return maxTime;
    };

    for (const anim of animations) {
      console.log(`  Clip "${anim.getName()}" duration: ${clipDuration(anim).toFixed(2)}s, channels: ${anim.listChannels().length}`);
    }

    let bestAnim = null;
    if (source.pickClipName) {
      bestAnim = animations.find((a) => a.getName() === source.pickClipName) ?? null;
      if (!bestAnim) {
        console.warn(`  pickClipName "${source.pickClipName}" not found, falling back to longest`);
      }
    }
    if (!bestAnim) {
      bestAnim = animations.reduce((acc, a) => (clipDuration(a) > clipDuration(acc) ? a : acc), animations[0]);
    }
    const bestDuration = clipDuration(bestAnim);

    console.log(`  Selected: "${bestAnim.getName()}" (${bestDuration.toFixed(2)}s)`);

    // We need to copy the animation data manually since documents can't share properties.
    // Strategy: copy samplers (input/output accessors) and channels, retarget node references by bone name.

    // Build a bone-name map from the base document
    const baseBoneMap = new Map();
    for (const node of baseRoot.listNodes()) {
      const name = node.getName();
      if (name) baseBoneMap.set(name, node);
    }

    // Remove existing animation with the same name (avoid duplicates on re-run)
    for (const existing of baseRoot.listAnimations()) {
      if (existing.getName() === source.name) {
        console.log(`  Removing existing "${source.name}" clip before replacing`);
        existing.dispose();
        break;
      }
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
