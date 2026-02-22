import React, { useRef, memo, useState, Suspense, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Platform, LogBox, ActivityIndicator } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useGLTF, OrbitControls } from '@react-three/drei/native';
import * as THREE from 'three';
import type { GLTF } from 'three-stdlib';
import { usePetStore, type PetMood, getModelForMood } from '../store/petStore';

LogBox.ignoreLogs(['EXGL: gl.pixelStorei()']);

// --- All model assets (static requires for Metro) ---
const MODEL_BREATHING = require('../../assets/pets/breathing.glb');
const MODEL_SAD = require('../../assets/pets/Sad.glb');
const MODEL_EXCITED = require('../../assets/pets/Excited.glb');

// Preload all models at module level so they're cached in memory
// This prevents lag when switching moods
useGLTF.preload(MODEL_BREATHING);
useGLTF.preload(MODEL_SAD);
useGLTF.preload(MODEL_EXCITED);

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

  // Build the effective animation cycle based on what the model actually has
  const effectiveCycle = useMemo(() => {
    if (!animations || animations.length === 0) return [];
    const animNames = new Set(animations.map((c) => c.name));
    // Try curated cycle first, filtering to available animations
    const filtered = ANIMATION_CYCLE.filter((a) => animNames.has(a.name));
    if (filtered.length > 0) return filtered;
    // Fallback: cycle through all available animations with longer durations
    return animations.map((clip) => ({ name: clip.name, duration: 4000 }));
  }, [animations]);

  // Setup animation mixer
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

    // Start first animation
    const idleAction = actions['CharacterArmature|Idle'] || actions['Armature|Idle'] || actions['Idle'];
    if (idleAction) {
      idleAction.play();
    } else {
      // For Mixamo models, just play the first animation
      const firstAnim = animations[0];
      if (firstAnim) {
        actions[firstAnim.name]?.play();
      }
    }

    setIsReady(true);

    return () => {
      mixer.stopAllAction();
    };
  }, [scene, animations]);

  // Handle animation transitions
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

  // Animation cycling
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
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }

    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();

    // Subtle breathing effect
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
    <View className="flex-1 items-center justify-center bg-black">
      <View className="absolute w-48 h-48 rounded-full bg-violet-500/20" />
      <View className="w-32 h-32 bg-neutral-800 rounded-full items-center justify-center">
        <Text className="text-6xl">{'\u{1F43E}'}</Text>
      </View>
      <Text className="text-2xl mt-3">{moodEmojis[mood]}</Text>
    </View>
  );
}

function LoadingView() {
  return (
    <View className="flex-1 items-center justify-center bg-black">
      <ActivityIndicator size="large" color="#8b5cf6" />
    </View>
  );
}

interface PetRendererProps {
  skin?: string;
  mood: PetMood;
}

export const PetRenderer = memo(function PetRenderer({ skin, mood }: PetRendererProps) {
  if (Platform.OS === 'web') {
    return <FallbackView />;
  }

  const modelAsset = getModelForMood(mood);

  // Key by the actual model asset, NOT by mood name.
  // Multiple moods can share the same GLB (e.g. hungry/tired/sad all use Sad.glb)
  // This prevents unnecessary remounts when mood changes but model stays the same.
  const modelKey = modelAsset === MODEL_SAD ? 'sad' :
                   modelAsset === MODEL_EXCITED ? 'excited' : 'default';

  return (
    <View className="flex-1 bg-black">
      <View
        className="absolute rounded-full bg-violet-500/15"
        style={{
          width: 160,
          height: 160,
          top: '35%',
          left: '50%',
          marginLeft: -80,
        }}
      />

      <Canvas
        camera={{ position: [0, 1, 5], fov: 50 }}
        gl={{
          antialias: false,
          powerPreference: 'low-power',
        }}
      >
        <color attach="background" args={['#000000']} />

        <ambientLight intensity={1.5} />
        <directionalLight position={[5, 10, 5]} intensity={1.5} />
        <directionalLight position={[-5, 5, -5]} intensity={0.8} />
        <pointLight position={[0, 5, 5]} intensity={1} color="#ffffff" />

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
  );
});
