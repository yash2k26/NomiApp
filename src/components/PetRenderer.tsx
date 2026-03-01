import React, { useRef, memo, useState, Suspense, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Platform, LogBox, ActivityIndicator } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useGLTF, OrbitControls } from '@react-three/drei/native';
import * as THREE from 'three';
import type { GLTF } from 'three-stdlib';

LogBox.ignoreLogs(['EXGL: gl.pixelStorei()', 'THREE.THREE.Clock']);

// Single combined GLB with pet + all accessories baked in
const MODEL = require('../../assets/pets/nomi-combined.glb');

// External animation GLB for Gangnam on double-tap
const GANGNAM_ANIM = require('../../assets/animation/Gangam.glb');

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

// Preload the punch animation GLB
useGLTF.preload(GANGNAM_ANIM);

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

  // Load external Gangnam animation GLB
  const gangnamGltf = useGLTF(GANGNAM_ANIM) as GLTFResult;

  // Merge all animation clips into one array
  const allAnimations = useMemo(() => {
    const clips = [...animations];

    // Gangam.glb — add all clips, use the last one as 'Gangnam'
    const gangnamClips = gangnamGltf.animations;
    for (let i = 0; i < gangnamClips.length; i++) {
      const renamed = gangnamClips[i].clone();

      // Retarget: strip path prefix so tracks bind to bones by name
      for (const track of renamed.tracks) {
        const lastSlash = track.name.lastIndexOf('/');
        if (lastSlash !== -1) {
          track.name = track.name.substring(lastSlash + 1);
        }
      }

      renamed.name = i === gangnamClips.length - 1 ? 'Gangnam' : `Gangnam_${i}`;
      clips.push(renamed);
    }

    return clips;
  }, [animations, gangnamGltf.animations]);

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

    // Resolve clip name: baked clips use CLIP_NAME_MAP, falling uses 'Gangnam' from external
    const clipName = activeModel === 'falling'
      ? (equippedSkin === 'headphones' ? 'Dance' : 'Gangnam')
      : CLIP_NAME_MAP[activeModel];
    if (!clipName) return;

    const clip = allAnimations.find(c => c.name === clipName);
    if (!clip) {
      console.warn(`[PetModel] clip "${clipName}" not found in:`, allAnimations.map(c => c.name));
      return;
    }

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
          rotateSpeed={1.2}
          enableDamping
          dampingFactor={0.12}
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
