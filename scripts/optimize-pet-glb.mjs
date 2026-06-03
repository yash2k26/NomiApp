// Safe, UV-preserving optimization of the Nomi pet GLB.
//
// IMPORTANT: this deliberately does NOT use quantize / draco / meshopt /
// simplify — those change vertex precision or topology and previously broke
// the model's UVs. Everything here is lossless for geometry/UVs:
//   - textureCompress(resize): shrinks oversized textures. Texture resolution
//     has NOTHING to do with UV coordinates, so this is UV-safe. The four
//     4096x4096 textures each decode to ~67 MB of GPU memory; capping at 1024
//     cuts that ~16x and is the single biggest load-time + VRAM win.
//   - weld(tolerance 0): merges only bitwise-identical vertices. Zero visual
//     change.
//   - resample: drops redundant animation keyframes. Zero visual change.
//   - dedup / prune: remove duplicate + unused resources. Zero visual change.
//
// Usage: node scripts/optimize-pet-glb.mjs [maxTexture]
import { NodeIO } from '@gltf-transform/core';
import { dedup, prune, weld, resample, textureCompress } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';

const SRC = 'assets/pets/nomi-combined.glb';
const OUT = 'assets/pets/nomi-combined.optimized.glb';
const MAX_TEX = parseInt(process.argv[2] || '1024', 10);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function vertCount(doc) {
  let v = 0;
  for (const m of doc.getRoot().listMeshes())
    for (const p of m.listPrimitives()) {
      const pos = p.getAttribute('POSITION');
      if (pos) v += pos.getCount();
    }
  return v;
}

const doc = await io.read(SRC);
const beforeVerts = vertCount(doc);
const beforeTex = doc.getRoot().listTextures().map((t) => t.getSize()?.join('x')).join(', ');

await doc.transform(
  dedup(),
  resample(),
  weld({ tolerance: 0 }),
  textureCompress({ encoder: sharp, resize: [MAX_TEX, MAX_TEX] }),
  prune(),
);

await io.write(OUT, doc);

const afterVerts = vertCount(doc);
const afterTex = doc.getRoot().listTextures().map((t) => t.getSize()?.join('x')).join(', ');
console.log('maxTexture cap   :', MAX_TEX);
console.log('vertices  before :', beforeVerts, '-> after:', afterVerts, (afterVerts === beforeVerts ? '(UNCHANGED — geometry untouched)' : '(welded exact dupes)'));
console.log('texture sizes after:', afterTex);
