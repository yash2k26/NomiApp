import React, { useRef, memo, useState, Suspense, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Platform, LogBox, ActivityIndicator } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useGLTF, OrbitControls } from '@react-three/drei/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as THREE from 'three';
import type { GLTF } from 'three-stdlib';
import * as Haptics from 'expo-haptics';
import { usePetStore, type PetMood, getModelForMood } from '../store/petStore';

LogBox.ignoreLogs(['EXGL: gl.pixelStorei()']);

// --- All model assets (static requires for Metro) ---
const MODEL_BREATHING = require('../../assets/pets/breathing.glb');
const MODEL_SAD = require('../../assets/pets/Sad.glb');
const MODEL_EXCITED = require('../../assets/pets/Excited.glb');
const MODEL_FALLINGDOWN = require('../../assets/pets/fallingdown.glb');

// Preload all optimized models at module level.
useGLTF.preload(MODEL_BREATHING);
useGLTF.preload(MODEL_SAD);
useGLTF.preload(MODEL_EXCITED);
useGLTF.preload(MODEL_FALLINGDOWN);

type GLTFResult = GLTF & {
  nodes: Record<string, THREE.Object3D>;
  materials: Record<string, THREE.Material>;
};

// Curated animation cycle for CharacterArmature-style models
const ANIMATION_CYCLE = [
  { name: 'CharacterArmature|Idle', duration: 4000 },
  { name: 'CharacterArmature|Wave', duration: 2500 },
  { name: 'CharacterArmature|Idle', duration: 3000 },
  { name: 'CharacterArmature|Yes', duration: 2000 },
  { name: 'CharacterArmature|Idle', duration: 3000 },
  { name: 'CharacterArmature|Walk', duration: 3000 },
  { name: 'CharacterArmature|Idle', duration: 3000 },
  { name: 'CharacterArmature|Jump', duration: 2000 },
  { name: 'CharacterArmature|Jump_Idle', duration: 1500 },
  { name: 'CharacterArmature|Jump_Land', duration: 1000 },
  { name: 'CharacterArmature|Idle', duration: 3000 },
  { name: 'CharacterArmature|Punch', duration: 2000 },
  { name: 'CharacterArmature|Idle', duration: 3000 },
  { name: 'CharacterArmature|Run', duration: 3000 },
  { name: 'CharacterArmature|Idle', duration: 3000 },
  { name: 'CharacterArmature|Duck', duration: 2000 },
  { name: 'CharacterArmature|Idle', duration: 3000 },
  { name: 'CharacterArmature|No', duration: 2000 },
  { name: 'CharacterArmature|Idle', duration: 4000 },
  { name: 'CharacterArmature|HitReact', duration: 1500 },
];

interface PetModelProps {
  skin?: string;
  modelAsset: any;
}

function PetModel({ skin, modelAsset }: PetModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const [cycleIndex, setCycleIndex] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const gltf = useGLTF(modelAsset) as GLTFResult;
  const { scene, animations } = gltf;

  const energy = usePetStore((s) => s.energy);
  const animSpeed = 0.5 + (energy / 100) * 0.5;

  const effectiveCycle = useMemo(() => {
    if (!animations || animations.length === 0) return [];
    const animNames = new Set(animations.map((c) => c.name));
    const filtered = ANIMATION_CYCLE.filter((a) => animNames.has(a.name));
    if (filtered.length > 0) return filtered;
    return animations.map((clip) => ({ name: clip.name, duration: 4000 }));
  }, [animations]);

  useEffect(() => {
    if (!animations || animations.length === 0) {
      setIsReady(true);
      return;
    }

    const mixer = new THREE.AnimationMixer(scene);
    mixerRef.current = mixer;

    const actions: Record<string, THREE.AnimationAction> = {};
    animations.forEach((clip: THREE.AnimationClip) => {
      const action = mixer.clipAction(clip);
      actions[clip.name] = action;
    });
    actionsRef.current = actions;

    const idleAction = actions['CharacterArmature|Idle'] || actions['Armature|Idle'] || actions['Idle'];
    if (idleAction) {
      idleAction.play();
    } else {
      const firstAnim = animations[0];
      if (firstAnim) actions[firstAnim.name]?.play();
    }

    setIsReady(true);
    return () => { mixer.stopAllAction(); };
  }, [scene, animations]);

  const fadeToAction = useCallback((actionName: string) => {
    const actions = actionsRef.current;
    const newAction = actions[actionName];
    if (!newAction) return;

    Object.entries(actions).forEach(([name, action]) => {
      if (name === actionName) {
        action.reset();
        action.fadeIn(0.3);
        action.play();
      } else {
        action.fadeOut(0.3);
      }
    });
  }, []);

  useEffect(() => {
    if (!isReady || effectiveCycle.length === 0) return;
    const currentCycle = effectiveCycle[cycleIndex % effectiveCycle.length];

    if (actionsRef.current[currentCycle.name]) {
      fadeToAction(currentCycle.name);
    } else {
      setCycleIndex((prev) => (prev + 1) % effectiveCycle.length);
      return;
    }

    const timer = setTimeout(() => {
      setCycleIndex((prev) => (prev + 1) % effectiveCycle.length);
    }, currentCycle.duration);

    return () => clearTimeout(timer);
  }, [cycleIndex, fadeToAction, isReady, effectiveCycle]);

  useFrame((state, delta) => {
    if (mixerRef.current) mixerRef.current.update(delta);
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    const breathe = 1 + Math.sin(t * animSpeed * 1.5) * 0.008;
    groupRef.current.scale.set(breathe, breathe, breathe);
  });

  return (
    <group ref={groupRef} position={[0, -1, 0]} scale={[1, 1, 1]}>
      <primitive object={scene} />
    </group>
  );
}

function FallbackView() {
  const getMood = usePetStore((s) => s.getMood);
  const mood = getMood();
  const moodEmojis: Record<PetMood, string> = {
    excited: '\u{1F929}',
    happy: '\u{1F60A}',
    content: '\u{1F642}',
    tired: '\u{1F634}',
    hungry: '\u{1F97A}',
    sad: '\u{1F622}',
  };

  return (
    <View className="flex-1 items-center justify-center bg-violet-50">
      <View className="absolute w-48 h-48 rounded-full bg-violet-200/40" />
      <View className="w-32 h-32 bg-white rounded-full items-center justify-center shadow-lg">
        <Text className="text-6xl">{'\u{1F43E}'}</Text>
      </View>
      <Text className="text-2xl mt-3">{moodEmojis[mood]}</Text>
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
  skin?: string;
  mood: PetMood;
  isFalling?: boolean;
  onDoubleTap?: () => void;
}

export const PetRenderer = memo(function PetRenderer({ skin, mood, isFalling, onDoubleTap }: PetRendererProps) {
  const [canvasReady, setCanvasReady] = useState(false);

  if (Platform.OS === 'web') return <FallbackView />;

  // Priority: falling > excited burst > mood-based model
  // excited burst is already encoded in mood via isExcitedBurst → 'excited'
  // but since we removed 'excited' from MOOD_MODELS, we handle it here
  const isExcitedBurst = usePetStore((s) => s.isExcitedBurst);

  let modelAsset: any;
  if (isFalling) {
    modelAsset = MODEL_FALLINGDOWN;
  } else if (isExcitedBurst) {
    modelAsset = MODEL_EXCITED;
  } else {
    modelAsset = getModelForMood(mood); // breathing.glb (default) or Sad.glb
  }

  const modelKey = modelAsset === MODEL_SAD ? 'sad' :
                   modelAsset === MODEL_EXCITED ? 'excited' :
                   modelAsset === MODEL_FALLINGDOWN ? 'falling' : 'default';

  // Double-tap gesture via RNGH — only fires on taps, lets drags pass to OrbitControls
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onEnd((_event, success) => {
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        onDoubleTap?.();
      }
    })
    .runOnJS(true);

  return (
    <GestureDetector gesture={doubleTapGesture}>
      <View className="flex-1 bg-violet-50">
        {/* Soft glow behind pet */}
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
            <PetModel key={modelKey} modelAsset={modelAsset} skin={skin} />
          </Suspense>
        </Canvas>
      </View>
    </GestureDetector>
  );
});
