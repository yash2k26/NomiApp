/**
 * Strips mesh/texture data from animation GLBs, keeping only skeleton + animations.
 * This reduces 23MB files down to ~50-100KB (animation data only).
 *
 * Usage: node scripts/strip-anim.mjs
 */

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ANIM_DIR = path.resolve(__dirname, '..', 'assets', 'animation');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const files = fs.readdirSync(ANIM_DIR).filter(f => f.endsWith('.glb'));

for (const file of files) {
  const filePath = path.join(ANIM_DIR, file);
  const doc = await io.read(filePath);

  // Strip meshes, materials, textures (keep skeleton nodes + animations)
  for (const mesh of doc.getRoot().listMeshes()) mesh.dispose();
  for (const mat of doc.getRoot().listMaterials()) mat.dispose();
  for (const tex of doc.getRoot().listTextures()) tex.dispose();
  for (const skin of doc.getRoot().listSkins()) skin.dispose();

  // Prune orphaned accessors/buffers
  await doc.transform(prune());

  // Consolidate buffers
  const buffers = doc.getRoot().listBuffers();
  if (buffers.length > 1) {
    const keep = buffers[0];
    for (let i = 1; i < buffers.length; i++) {
      for (const acc of doc.getRoot().listAccessors()) {
        if (acc.getBuffer() === buffers[i]) acc.setBuffer(keep);
      }
      buffers[i].dispose();
    }
  }

  // List animations
  const anims = doc.getRoot().listAnimations();
  const animNames = anims.map(a => `${a.getName()} (${a.listChannels().length}ch)`).join(', ');

  await io.write(filePath, doc);

  const stat = fs.statSync(filePath);
  const sizeKB = (stat.size / 1024).toFixed(1);
  console.log(`${file}: ${sizeKB} KB — animations: ${animNames}`);
}

console.log('\nDone! All animation GLBs stripped to skeleton + animation data only.');
