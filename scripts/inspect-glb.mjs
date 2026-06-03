import { NodeIO } from '@gltf-transform/core';
import path from 'path';

const io = new NodeIO();
const doc = await io.read(path.resolve('assets/shop/hoodie.glb'));
const root = doc.getRoot();

// 1. All node names
const nodes = root.listNodes();
console.log('=== ALL NODES (' + nodes.length + ') ===');
nodes.forEach((n, i) => console.log('  [' + i + '] ' + (n.getName() || '(unnamed)')));

// 2. Joints — nodes referenced by any skin
const skins = root.listSkins();
const jointSet = new Set();
skins.forEach(skin => skin.listJoints().forEach(j => jointSet.add(j)));

console.log('\n=== JOINT (BONE) NODES (' + jointSet.size + ') ===');
jointSet.forEach(j => console.log('  - ' + (j.getName() || '(unnamed)')));

// 3. Meshes and Skins
const meshes = root.listMeshes();
console.log('\n=== MESHES (' + meshes.length + ') ===');
meshes.forEach((m, i) => console.log('  [' + i + '] ' + (m.getName() || '(unnamed)')));

console.log('\n=== SKINS (' + skins.length + ') ===');
skins.forEach((s, i) => {
  const skeleton = s.getSkeleton();
  console.log('  [' + i + '] ' + (s.getName() || '(unnamed)') + '  skeleton-root: ' + (skeleton ? skeleton.getName() : '(none)'));
});

// 4. Skeleton hierarchy via parent-child on nodes
console.log('\n=== SKELETON HIERARCHY ===');
const parentMap = new Map();
nodes.forEach(n => {
  n.listChildren().forEach(child => parentMap.set(child, n));
});

function printTree(node, indent) {
  const tag = jointSet.has(node) ? ' [BONE]' : '';
  console.log(indent + (node.getName() || '(unnamed)') + tag);
  node.listChildren().forEach(child => printTree(child, indent + '  '));
}

// Find root bones
const rootBones = new Set();
skins.forEach(skin => {
  const sk = skin.getSkeleton();
  if (sk) rootBones.add(sk);
});
jointSet.forEach(j => {
  const p = parentMap.get(j);
  if (!p || !jointSet.has(p)) rootBones.add(j);
});

if (rootBones.size > 0) {
  rootBones.forEach(rb => printTree(rb, '  '));
} else {
  const scenes = root.listScenes();
  scenes.forEach(scene => {
    scene.listChildren().forEach(child => printTree(child, '  '));
  });
}
