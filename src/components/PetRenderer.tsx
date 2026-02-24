import React, { useRef, memo, useState, Suspense, useEffect } from 'react';
import { View, Text, Platform, LogBox, ActivityIndicator } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useGLTF, OrbitControls } from '@react-three/drei/native';
import * as THREE from 'three';
import type { GLTF } from 'three-stdlib';
import { usePetStore } from '../store/petStore';

LogBox.ignoreLogs(['EXGL: gl.pixelStorei()']);

const MODEL_BREATHING = require('../../assets/pets/breathing.glb');
const MODEL_SAD = require('../../assets/pets/Sad.glb');
const MODEL_EXCITED = require('../../assets/pets/Excited.glb');
const MODEL_FALLINGDOWN = require('../../assets/pets/fallingdown.glb');

useGLTF.preload(MODEL_BREATHING);
useGLTF.preload(MODEL_SAD);
useGLTF.preload(MODEL_EXCITED);
useGLTF.preload(MODEL_FALLINGDOWN);

type GLTFResult = GLTF & {
  nodes: Record<string, THREE.Object3D>;
  materials: Record<string, THREE.Material>;
};

// Which model to show — passed as a simple string from HomeScreen
export type ActiveModel = 'breathing' | 'excited' | 'sad' | 'falling';

const MODEL_MAP: Record<ActiveModel, any> = {
  breathing: MODEL_BREATHING,
  excited: MODEL_EXCITED,
  sad: MODEL_BREATHING,
  falling: MODEL_FALLINGDOWN,
};

interface PetModelProps {
  modelAsset: any;
}

function PetModel({ modelAsset }: PetModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const gltf = useGLTF(modelAsset) as GLTFResult;
  const { scene, animations } = gltf;

  const energy = usePetStore((s) => s.energy);
  const animSpeed = 0.5 + (energy / 100) * 0.5;

  // Setup: play the first animation on loop
  useEffect(() => {
    if (!animations || animations.length === 0) return;

    const mixer = new THREE.AnimationMixer(scene);
    mixerRef.current = mixer;

    // Prefer Idle, otherwise play the first clip
    const idle = animations.find((c) => c.name.includes('Idle'));
    const clip = idle ?? animations[0];
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();

    return () => { mixer.stopAllAction(); };
  }, [scene, animations]);

  useFrame((state, delta) => {
    if (mixerRef.current) mixerRef.current.update(delta);
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    const breathe = 1 + Math.sin(t * animSpeed * 1.5) * 0.008;
    groupRef.current.scale.set(breathe, breathe, breathe);
  });

  return (
    <group ref={groupRef} position={[0, -1, 0]}>
      <primitive object={scene} />
    </group>
  );
}

function FallbackView() {
  return (
    <View className="flex-1 items-center justify-center bg-violet-50">
      <View className="absolute w-48 h-48 rounded-full bg-violet-200/40" />
      <View className="w-32 h-32 bg-white rounded-full items-center justify-center shadow-lg">
        <Text className="text-6xl">{'\u{1F43E}'}</Text>
      </View>
    </View>
  );
}

function ModelLoadingFallback() {
  return (
    <View className="absolute inset-0 items-center justify-center z-10 bg-violet-50">
      <ActivityIndicator size="large" color="#8b5cf6" />
      <Text className="text-violet-400 text-xs mt-3">Loading Nomi...</Text>
    </View>
  );
}

interface PetRendererProps {
  activeModel: ActiveModel;
}

export const PetRenderer = memo(function PetRenderer({ activeModel }: PetRendererProps) {
  const [canvasReady, setCanvasReady] = useState(false);

  if (Platform.OS === 'web') return <FallbackView />;

  const modelAsset = MODEL_MAP[activeModel];

  return (
    <View className="flex-1 bg-violet-50">
      <View
        className="absolute rounded-full bg-pink-200/30"
        style={{ width: 220, height: 220, top: '28%', left: '50%', marginLeft: -110 }}
      />

      {!canvasReady && <ModelLoadingFallback />}

      <Canvas
        camera={{ position: [0, 1, 5], fov: 50 }}
        gl={{ antialias: false, powerPreference: 'low-power' }}
        onCreated={() => setCanvasReady(true)}
      >
        <color attach="background" args={['#f5f0ff']} />
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
          <PetModel key={activeModel} modelAsset={modelAsset} />
        </Suspense>
      </Canvas>
    </View>
  );
});
