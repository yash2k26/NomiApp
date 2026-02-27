/**
 * Merges accessory GLBs into the main nomi-all.glb as named child nodes.
 *
 * Result: a single nomi-combined.glb with:
 *   - Main pet mesh + skeleton + animations (scene root)
 *   - "Accessory_Headphones" node (all headphones meshes)
 *   - "Accessory_Crown" node (all crown meshes)
 *   - "Accessory_Hoodie" node (all hoodie meshes)
 *
 * Animations loaded separately at runtime live in assets/animation/.
 * At runtime, find accessory nodes by name and toggle .visible
 */

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune } from '@gltf-transform/functions';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(__dirname, '..');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// Load all GLBs
const mainDoc = await io.read(path.join(ASSETS, 'assets/pets/nomi-all.glb'));
const headphonesDoc = await io.read(path.join(ASSETS, 'assets/shop/headphones.glb'));
const crownDoc = await io.read(path.join(ASSETS, 'assets/shop/fall_guys_crown.glb'));
const hoodieDoc = await io.read(path.join(ASSETS, 'assets/shop/hoodie_black.glb'));

const mainScene = mainDoc.getRoot().getDefaultScene() || mainDoc.getRoot().listScenes()[0];

// ── Remove Fall animation (will be loaded at runtime from assets/animation/fall.glb) ──
for (const anim of mainDoc.getRoot().listAnimations()) {
  if (anim.getName() === 'Fall') {
    anim.dispose();
    console.log('Removed "Fall" animation (loaded at runtime from animation/fall.glb)');
  }
}

// ── Merge accessories ──

async function mergeAccessory(accessoryDoc, groupName) {
  await mergeDocuments(mainDoc, accessoryDoc);

  const scenes = mainDoc.getRoot().listScenes();
  const accessoryScene = scenes[scenes.length - 1];

  const wrapperNode = mainDoc.createNode(groupName);

  for (const child of accessoryScene.listChildren()) {
    accessoryScene.removeChild(child);
    wrapperNode.addChild(child);
  }

  mainScene.addChild(wrapperNode);
  accessoryScene.dispose();
}

await mergeAccessory(headphonesDoc, 'Accessory_Headphones');
await mergeAccessory(crownDoc, 'Accessory_Crown');
await mergeAccessory(hoodieDoc, 'Accessory_Hoodie');

// ── Verify ──
console.log('Scenes:', mainDoc.getRoot().listScenes().length);
console.log('Root children:');
for (const child of mainScene.listChildren()) {
  console.log(`  - ${child.getName()}`);
}
console.log('Animations:');
for (const anim of mainDoc.getRoot().listAnimations()) {
  console.log(`  - ${anim.getName()} (${anim.listChannels().length} channels)`);
}

// ── Prune orphaned data ──
await mainDoc.transform(prune());
console.log('Pruned orphaned data');

// ── Consolidate buffers ──
const buffers = mainDoc.getRoot().listBuffers();
if (buffers.length > 1) {
  const keepBuffer = buffers[0];
  for (let i = 1; i < buffers.length; i++) {
    for (const accessor of mainDoc.getRoot().listAccessors()) {
      if (accessor.getBuffer() === buffers[i]) {
        accessor.setBuffer(keepBuffer);
      }
    }
    buffers[i].dispose();
  }
  console.log(`Consolidated ${buffers.length} buffers → 1`);
}

// ── Write combined GLB ──
const outPath = path.join(ASSETS, 'assets/pets/nomi-combined.glb');
await io.write(outPath, mainDoc);
console.log(`\nWritten to: ${outPath}`);
