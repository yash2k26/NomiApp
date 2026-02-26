import React, { useRef, memo, useState, Suspense, useEffect, useCallback } from 'react';
import { View, Text, Platform, LogBox, ActivityIndicator } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useGLTF, OrbitControls } from '@react-three/drei/native';
import * as THREE from 'three';
import type { GLTF } from 'three-stdlib';

LogBox.ignoreLogs(['EXGL: gl.pixelStorei()', 'THREE.THREE.Clock']);

const MODEL = require('../../assets/pets/nomi-all.glb');
const ACCESSORY_HEADPHONES = require('../../assets/shop/headphones.glb');
const ACCESSORY_HOODIE = require('../../assets/shop/hoodie_black.glb');

type GLTFResult = GLTF & {
  nodes: Record<string, THREE.Object3D>;
  materials: Record<string, THREE.Material>;
};

export type ActiveModel = 'breathing' | 'excited' | 'sad' | 'falling' | 'dancing';

const CLIP_NAME_MAP: Record<ActiveModel, string> = {
  breathing: 'Breathing',
  excited: 'Excited',
  sad: 'Sad',
  falling: 'Fall',
  dancing: 'Dance',
};

const HEAD_BONE_NAME = 'mixamorig:Head';

// ── Accessory components — only mount when equipped ──
function HeadphonesAccessory({ parentBone }: { parentBone: THREE.Object3D }) {
  const gltf = useGLTF(ACCESSORY_HEADPHONES) as GLTFResult;

  useEffect(() => {
    const wrapper = new THREE.Group();
    wrapper.scale.set(0.26, 0.14, 0.16);
    wrapper.position.set(0, 0.1, 0);
    wrapper.add(gltf.scene);
    parentBone.add(wrapper);

    return () => {
      parentBone.remove(wrapper);
      wrapper.remove(gltf.scene);
    };
  }, [parentBone, gltf.scene]);

  return null;
}

function HoodieAccessory() {
  const gltf = useGLTF(ACCESSORY_HOODIE) as GLTFResult;
  return <primitive object={gltf.scene} scale={0.5} position={[0, 0, 0]} />;
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
  const gltf = useGLTF(MODEL) as GLTFResult;
  const { scene, animations } = gltf;

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(scene);
    mixerRef.current = mixer;

    let headBoneFound = scene.getObjectByName(HEAD_BONE_NAME);
    if (!headBoneFound) {
      scene.traverse((child: THREE.Object3D) => {
        if (!headBoneFound && child.name.toLowerCase().includes('head')) {
          headBoneFound = child;
        }
      });
    }
    if (headBoneFound) setHeadBone(headBoneFound);

    return () => {
      mixer.stopAllAction();
      mixerRef.current = null;
    };
  }, [scene]);

  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer || !animations || animations.length === 0) {
      if (activeModel === 'excited' || activeModel === 'falling') {
        const t = setTimeout(() => onAnimationDone?.(), 1500);
        return () => clearTimeout(t);
      }
      return;
    }

    const clipName = CLIP_NAME_MAP[activeModel];
    const clip = animations.find(c => c.name === clipName);
    if (!clip) {
      console.warn(`[PetModel] clip "${clipName}" not found`);
      return;
    }

    if (activeActionRef.current) {
      activeActionRef.current.fadeOut(0.15);
    }

    const action = mixer.clipAction(clip);
    action.reset();

    if (activeModel === 'excited') {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
    }

    action.fadeIn(0.15).play();
    activeActionRef.current = action;

    const onFinished = () => onAnimationDone?.();

    if (activeModel === 'excited') {
      mixer.addEventListener('finished', onFinished);
    }

    return () => {
      if (activeModel === 'excited') {
        mixer.removeEventListener('finished', onFinished);
      }
    };
  }, [activeModel, animations, onAnimationDone]);

  useFrame((_state, delta) => {
    mixerRef.current?.update(delta);
  });

  return (
    <group position={[0, -1, 0]}>
      <primitive object={scene} />
      {/* Accessories only load their GLB when mounted */}
      {equippedSkin === 'headphones' && headBone && (
        <HeadphonesAccessory parentBone={headBone} />
      )}
      {equippedSkin === 'hoodie' && (
        <HoodieAccessory />
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
