import { NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization } from '@gltf-transform/extensions';

const io = new NodeIO().registerExtensions([KHRMeshQuantization]);
const doc = await io.read('assets/pets/nomi-all.glb');
const root = doc.getRoot();
const joints = [];
for (const skin of root.listSkins()) {
  for (const joint of skin.listJoints()) {
    joints.push(joint.getName());
  }
}
console.log('Character bones:', JSON.stringify(joints, null, 2));
