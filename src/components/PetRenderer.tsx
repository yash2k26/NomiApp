import React, { useRef, memo, useState, Suspense, useEffect, useCallback } from 'react';
import { View, Text, Platform, LogBox } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useGLTF, OrbitControls } from '@react-three/drei/native';
import * as THREE from 'three';
import type { GLTF } from 'three-stdlib';
import { usePetStore, type PetMood } from '../store/petStore';

LogBox.ignoreLogs(['EXGL: gl.pixelStorei()']);

const modelAsset = require('../../assets/pets/nomi3.glb');

type GLTFResult = GLTF & {
  nodes: Record<string, THREE.Object3D>;
  materials: Record<string, THREE.Material>;
};

interface PetModelProps {
  skin?: string;
}

function PetModel({ skin }: PetModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const animationNamesRef = useRef<string[]>([]);
  const [cycleIndex, setCycleIndex] = useState(0);
  const [isReady, setIsReady] = useState(false);
  
  const gltf = useGLTF(modelAsset) as GLTFResult;
  const { scene, animations } = gltf;
  
  const energy = usePetStore((s) => s.energy);
  const animSpeed = 0.5 + (energy / 100) * 0.5;

  // Setup animation mixer
  useEffect(() => {
    // Log model structure once
    console.log('=== nomi3.glb MODEL STRUCTURE ===');
    console.log('Animations count:', animations?.length || 0);
    if (animations && animations.length > 0) {
      animations.forEach((clip: THREE.AnimationClip, i: number) => {
        console.log(`Anim ${i}: ${clip.name}`);
      });
    }
    
    if (!animations || animations.length === 0) {
      console.log('No animations - rendering static model');
      setIsReady(true);
      return;
    }
    
    const mixer = new THREE.AnimationMixer(scene);
    mixerRef.current = mixer;
    
    const actions: Record<string, THREE.AnimationAction> = {};
    const animNames: string[] = [];
    
    animations.forEach((clip: THREE.AnimationClip) => {
      const action = mixer.clipAction(clip);
      actions[clip.name] = action;
      animNames.push(clip.name);
    });
    
    actionsRef.current = actions;
    animationNamesRef.current = animNames;

    // Start with idle if available, or first animation
    const idleAction = actions['CharacterArmature|Idle'] || actions['Armature|Idle'] || actions['Idle'];
    if (idleAction) {
      idleAction.play();
    } else if (animNames.length > 0) {
      actions[animNames[0]].play();
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

  // Curated animation cycle with varied durations
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

  useEffect(() => {
    if (!isReady) return;
    
    const animNames = animationNamesRef.current;
    if (animNames.length === 0) return;

    const currentCycle = ANIMATION_CYCLE[cycleIndex % ANIMATION_CYCLE.length];
    
    // Only play if the animation exists in the model
    if (actionsRef.current[currentCycle.name]) {
      fadeToAction(currentCycle.name);
    } else {
      // Skip to next if animation not found
      setCycleIndex((prev) => (prev + 1) % ANIMATION_CYCLE.length);
      return;
    }

    const timer = setTimeout(() => {
      setCycleIndex((prev) => (prev + 1) % ANIMATION_CYCLE.length);
    }, currentCycle.duration);

    return () => clearTimeout(timer);
  }, [cycleIndex, fadeToAction, isReady]);

  useFrame((state, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }

    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    
    // Subtle breathing effect
    const breathe = 1 + Math.sin(t * animSpeed * 1.5) * 0.008;
    const baseScale = 1;
    groupRef.current.scale.set(baseScale * breathe, baseScale * breathe, baseScale * breathe);
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
    happy: '😊',
    content: '🙂',
    tired: '😴',
    hungry: '🥺',
    sad: '😢',
  };

  return (
    <View className="flex-1 items-center justify-center bg-black">
      <View className="absolute w-48 h-48 rounded-full bg-violet-500/20" />
      <View className="w-32 h-32 bg-neutral-800 rounded-full items-center justify-center">
        <Text className="text-6xl">🐾</Text>
      </View>
      <Text className="text-2xl mt-3">{moodEmojis[mood]}</Text>
    </View>
  );
}

interface PetRendererProps {
  skin?: string;
}

export const PetRenderer = memo(function PetRenderer({ skin }: PetRendererProps) {
  if (Platform.OS === 'web') {
    return <FallbackView />;
  }

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
          <PetModel skin={skin} />
        </Suspense>
      </Canvas>
    </View>
  );
});
