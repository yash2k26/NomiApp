import React, { useRef, memo, useState, Suspense, useEffect, useCallback } from 'react';
import { View, Text, Platform, LogBox, ActivityIndicator, Image } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useGLTF, OrbitControls } from '@react-three/drei/native';
import * as THREE from 'three';
import type { GLTF } from 'three-stdlib';

LogBox.ignoreLogs(['EXGL: gl.pixelStorei()', 'THREE.THREE.Clock']);

// App logo / loading image
const ME_IMG = require('../../assets/Icons/Me.png');

// Single GLB with pet + accessories + ALL animations baked in
const MODEL = require('../../assets/pets/nomi-combined.glb');

type GLTFResult = GLTF & {
  nodes: Record<string, THREE.Object3D>;
  materials: Record<string, THREE.Material>;
};

export type ActiveModel = 'breathing' | 'excited' | 'sad' | 'falling' | 'dancing' | 'backflip' | 'punch' | 'fallover';

// All clips are baked into nomi-combined.glb
const CLIP_NAME_MAP: Record<ActiveModel, string> = {
  breathing: 'Breathing',
  excited: 'Excited',
  sad: 'Sad',
  dancing: 'Dance',
  falling: 'FallOver',
  backflip: 'Backflip',
  punch: 'Punch',
  fallover: 'FallOver',
};

// One-shot animations (play once then done)
const ONE_SHOT: Set<ActiveModel> = new Set(['excited', 'falling', 'backflip', 'fallover']);

const HEAD_BONE_NAME = 'mixamorig:Head';

// Accessory node names matching the merge script output
const ACCESSORY_NODES = {
  headphones: 'Accessory_Headphones',
  crown: 'Accessory_Crown',
  hoodie: 'Accessory_Hoodie',
} as const;

// Preload the single model
useGLTF.preload(MODEL);

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

  // Setup: mixer, bones, accessories
  useEffect(() => {
    const mixer = new THREE.AnimationMixer(scene);
    mixerRef.current = mixer;

    // Debug: log all animation clip names baked into the GLB
    console.log('[PetRenderer] Available animation clips:', animations.map(c => `"${c.name}" (${c.duration.toFixed(2)}s)`).join(', '));

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

  // Animation switching — all clips are baked, just find by name
  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer || animations.length === 0) {
      if (ONE_SHOT.has(activeModel)) {
        const t = setTimeout(() => onAnimationDone?.(), 1500);
        return () => clearTimeout(t);
      }
      return;
    }

    // Special case: falling with headphones uses Dance instead of Gangnam
    let clipName = CLIP_NAME_MAP[activeModel];
    if (activeModel === 'falling' && equippedSkin === 'headphones') {
      clipName = 'Dance';
    }

    const clip = animations.find(c => c.name === clipName);

    console.log(`[PetRenderer] activeModel="${activeModel}" → clipName="${clipName}" → found=${!!clip}`);

    if (!clip) {
      console.warn(`[PetRenderer] Clip "${clipName}" NOT FOUND. Available:`, animations.map(c => c.name));
      return;
    }

    if (activeActionRef.current) {
      activeActionRef.current.fadeOut(0.15);
    }

    const action = mixer.clipAction(clip);
    action.reset();

    if (ONE_SHOT.has(activeModel)) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
    }

    action.fadeIn(0.15).play();
    activeActionRef.current = action;

    const onFinished = () => onAnimationDone?.();

    if (ONE_SHOT.has(activeModel)) {
      mixer.addEventListener('finished', onFinished);
    }

    return () => {
      if (ONE_SHOT.has(activeModel)) {
        mixer.removeEventListener('finished', onFinished);
      }
    };
  }, [activeModel, animations, equippedSkin, onAnimationDone]);

  useFrame((_state, delta) => {
    mixerRef.current?.update(delta);
  });

  return (
    <group position={[0, -1, 0]}>
      <primitive object={scene} />
      {equippedSkin === 'crown' && crownNode && (
        <CrownSpinner crownNode={crownNode} />
      )}
    </group>
  );
}

function FallbackView() {
  return (
    <View className="flex-1 items-center justify-center bg-sky-200">
      <Image source={ME_IMG} style={{ width: 120, height: 120 }} resizeMode="contain" />
    </View>
  );
}

function ModelLoadingFallback() {
  return (
    <View className="absolute inset-0 items-center justify-center z-10 bg-sky-200">
      <Image source={ME_IMG} style={{ width: 100, height: 100, marginBottom: 12 }} resizeMode="contain" />
      <ActivityIndicator size="small" color="#3b82f6" />
      <Text className="text-blue-400 text-xs mt-3 font-bold">Loading Nomi...</Text>
    </View>
  );
}

interface PetRendererProps {
  activeModel?: ActiveModel;
  onExcitedFinished?: () => void;
  equippedSkin?: string;
  onReady?: () => void;
}

export const PetRenderer = memo(function PetRenderer({ activeModel = 'breathing', onExcitedFinished, equippedSkin = 'default', onReady }: PetRendererProps) {
  const [canvasReady, setCanvasReady] = useState(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

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
        onCreated={() => { setCanvasReady(true); onReadyRef.current?.(); }}
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
