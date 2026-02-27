import React, { useRef, memo, useState, Suspense, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Platform, LogBox, ActivityIndicator } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useGLTF, OrbitControls } from '@react-three/drei/native';
import * as THREE from 'three';
import type { GLTF } from 'three-stdlib';

LogBox.ignoreLogs(['EXGL: gl.pixelStorei()', 'THREE.THREE.Clock']);

// Single combined GLB with pet + all accessories baked in
const MODEL = require('../../assets/pets/nomi-combined.glb');

// External animation GLB for falling-back on double-tap
const FALLING_BACK_ANIM = require('../../assets/animation/fallingback.glb');

type GLTFResult = GLTF & {
  nodes: Record<string, THREE.Object3D>;
  materials: Record<string, THREE.Material>;
};

export type ActiveModel = 'breathing' | 'excited' | 'sad' | 'falling' | 'dancing';

// Clips baked into nomi-combined.glb
const CLIP_NAME_MAP: Partial<Record<ActiveModel, string>> = {
  breathing: 'Breathing',
  excited: 'Excited',
  sad: 'Sad',
  dancing: 'Dance',
};

const HEAD_BONE_NAME = 'mixamorig:Head';

// Accessory node names matching the merge script output
const ACCESSORY_NODES = {
  headphones: 'Accessory_Headphones',
  crown: 'Accessory_Crown',
  hoodie: 'Accessory_Hoodie',
} as const;

// Preload the falling-back animation GLB
useGLTF.preload(FALLING_BACK_ANIM);

// ── Crown spin component (needs useFrame) ──
function CrownSpinner({ crownNode }: { crownNode: THREE.Object3D }) {
  useFrame((_state, delta) => {
    crownNode.rotation.y += delta * 1.5;
  });
  return null;
}

interface PetModelProps {
  activeModel: ActiveModel;
  onAnimationDone?: () => void;
  equippedSkin: string;
}

function PetModel({ activeModel, onAnimationDone, equippedSkin }: PetModelProps) {
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);
  const [headBone, setHeadBone] = useState<THREE.Object3D | null>(null);
  const [crownNode, setCrownNode] = useState<THREE.Object3D | null>(null);
  const accessoryRefsRef = useRef<Record<string, THREE.Object3D | null>>({});

  const gltf = useGLTF(MODEL) as GLTFResult;
  const { scene, animations } = gltf;

  // Load external animation GLB
  const fallingBackGltf = useGLTF(FALLING_BACK_ANIM) as GLTFResult;

  // Merge all animation clips into one array
  const allAnimations = useMemo(() => {
    const clips = [...animations];

    // Debug: log baked clip names and track prefixes
    console.log('[PetModel] baked clips:', animations.map(c => c.name));
    if (animations[0]?.tracks[0]) {
      console.log('[PetModel] baked track sample:', animations[0].tracks[0].name);
    }

    // fallingback.glb has multiple baked clips — log all to identify the right one
    const fbClips = fallingBackGltf.animations;
    console.log('[PetModel] fallingback clips:', fbClips.map((c, i) => `[${i}] "${c.name}" ${c.duration.toFixed(2)}s tracks:${c.tracks.length}`));
    if (fbClips.length > 0 && fbClips[fbClips.length - 1].tracks[0]) {
      console.log('[PetModel] fallingback last clip track sample:', fbClips[fbClips.length - 1].tracks[0].name);
    }

    // Add ALL fallingback clips so we can test each one
    for (let i = 0; i < fbClips.length; i++) {
      const renamed = fbClips[i].clone();

      // Retarget: strip path prefix so tracks bind to bones by name
      // e.g. "Armature/mixamorig:Hips.position" → "mixamorig:Hips.position"
      for (const track of renamed.tracks) {
        const lastSlash = track.name.lastIndexOf('/');
        if (lastSlash !== -1) {
          track.name = track.name.substring(lastSlash + 1);
        }
      }

      renamed.name = i === fbClips.length - 1 ? 'FallingBack' : `FallingBack_${i}`;
      clips.push(renamed);
    }

    return clips;
  }, [animations, fallingBackGltf.animations]);

  // Setup: find bones, find accessory groups, hide all accessories initially
  useEffect(() => {
    const mixer = new THREE.AnimationMixer(scene);
    mixerRef.current = mixer;

    // Find head bone
    let headBoneFound = scene.getObjectByName(HEAD_BONE_NAME);
    if (!headBoneFound) {
      scene.traverse((child: THREE.Object3D) => {
        if (!headBoneFound && child.name.toLowerCase().includes('head')) {
          headBoneFound = child;
        }
      });
    }
    if (headBoneFound) setHeadBone(headBoneFound);

    // Find and initially hide all accessory groups
    for (const [key, nodeName] of Object.entries(ACCESSORY_NODES)) {
      const node = scene.getObjectByName(nodeName);
      if (node) {
        node.visible = false;
        accessoryRefsRef.current[key] = node;
        if (key === 'crown') setCrownNode(node);
      }
    }

    return () => {
      mixer.stopAllAction();
      mixerRef.current = null;
    };
  }, [scene]);

  // Toggle accessory visibility + re-parent head accessories to head bone
  useEffect(() => {
    const refs = accessoryRefsRef.current;

    for (const [key] of Object.entries(ACCESSORY_NODES)) {
      const node = refs[key];
      if (!node) continue;

      const isEquipped = equippedSkin === key;
      node.visible = isEquipped;

      if (isEquipped && headBone && (key === 'headphones' || key === 'crown')) {
        // Re-parent to head bone if not already
        if (node.parent !== headBone) {
          node.parent?.remove(node);

          if (key === 'headphones') {
            node.scale.set(0.26, 0.14, 0.16);
            node.position.set(0, 0.1, 0);
          } else if (key === 'crown') {
            node.scale.set(0.2, 0.2, 0.2);
            node.position.set(0, 0.85, 0);
          }

          headBone.add(node);
        }
      }
    }
  }, [equippedSkin, headBone]);

  // Animation switching — uses both baked clips and external animation clips
  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer || allAnimations.length === 0) {
      if (activeModel === 'excited' || activeModel === 'falling') {
        const t = setTimeout(() => onAnimationDone?.(), 1500);
        return () => clearTimeout(t);
      }
      return;
    }

    // Resolve clip name: baked clips use CLIP_NAME_MAP, falling uses 'FallingBack' from external
    const clipName = activeModel === 'falling' ? 'FallingBack' : CLIP_NAME_MAP[activeModel];
    if (!clipName) return;

    const clip = allAnimations.find(c => c.name === clipName);
    if (!clip) {
      console.warn(`[PetModel] clip "${clipName}" not found in:`, allAnimations.map(c => c.name));
      return;
    }

    console.log(`[PetModel] playing "${clipName}" duration=${clip.duration.toFixed(2)}s tracks=${clip.tracks.length}`);

    if (activeActionRef.current) {
      activeActionRef.current.fadeOut(0.15);
    }

    const action = mixer.clipAction(clip);
    action.reset();

    if (activeModel === 'excited' || activeModel === 'falling') {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
    }

    action.fadeIn(0.15).play();
    activeActionRef.current = action;

    const onFinished = () => onAnimationDone?.();

    if (activeModel === 'excited' || activeModel === 'falling') {
      mixer.addEventListener('finished', onFinished);
    }

    return () => {
      if (activeModel === 'excited' || activeModel === 'falling') {
        mixer.removeEventListener('finished', onFinished);
      }
    };
  }, [activeModel, allAnimations, onAnimationDone]);

  useFrame((_state, delta) => {
    mixerRef.current?.update(delta);
  });

  return (
    <group position={[0, -1, 0]}>
      <primitive object={scene} />
      {/* Crown spin — only active when crown is equipped & node found */}
      {equippedSkin === 'crown' && crownNode && (
        <CrownSpinner crownNode={crownNode} />
      )}
    </group>
  );
}

function FallbackView() {
  return (
    <View className="flex-1 items-center justify-center bg-sky-200">
      <View className="w-32 h-32 bg-white rounded-3xl items-center justify-center shadow-lg">
        <Text className="text-6xl">{'\u{1F43E}'}</Text>
      </View>
    </View>
  );
}

function ModelLoadingFallback() {
  return (
    <View className="absolute inset-0 items-center justify-center z-10 bg-sky-200">
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text className="text-blue-400 text-xs mt-3 font-bold">Loading Nomi...</Text>
    </View>
  );
}

interface PetRendererProps {
  activeModel?: ActiveModel;
  onExcitedFinished?: () => void;
  equippedSkin?: string;
}

export const PetRenderer = memo(function PetRenderer({ activeModel = 'breathing', onExcitedFinished, equippedSkin = 'default' }: PetRendererProps) {
  const [canvasReady, setCanvasReady] = useState(false);

  const excitedCallbackRef = useRef(onExcitedFinished);
  excitedCallbackRef.current = onExcitedFinished;
  const stableOnDone = useCallback(() => {
    excitedCallbackRef.current?.();
  }, []);

  if (Platform.OS === 'web') return <FallbackView />;

  return (
    <View className="flex-1 bg-sky-200">
      {!canvasReady && <ModelLoadingFallback />}

      <Canvas
        camera={{ position: [0, 1, 5], fov: 50 }}
        gl={{ antialias: false, powerPreference: 'low-power' }}
        onCreated={() => setCanvasReady(true)}
      >
        <color attach="background" args={['#bae6fd']} />
        <ambientLight intensity={2} />
        <directionalLight position={[5, 10, 5]} intensity={1.8} />
        <directionalLight position={[-5, 5, -5]} intensity={1} />
        <pointLight position={[0, 5, 5]} intensity={1.2} color="#ffffff" />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.5}
          rotateSpeed={0.5}
        />

        <Suspense fallback={null}>
          <PetModel
            activeModel={activeModel}
            onAnimationDone={activeModel === 'excited' ? stableOnDone : undefined}
            equippedSkin={equippedSkin}
          />
        </Suspense>
      </Canvas>
    </View>
  );
});
