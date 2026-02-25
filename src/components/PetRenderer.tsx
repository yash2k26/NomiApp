import React, { useRef, memo, useState, Suspense, useEffect, useCallback } from 'react';
import { View, Text, Platform, LogBox, ActivityIndicator, Animated } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useGLTF, OrbitControls } from '@react-three/drei/native';
import * as THREE from 'three';
import type { GLTF } from 'three-stdlib';

LogBox.ignoreLogs(['EXGL: gl.pixelStorei()', 'THREE.THREE.Clock']);

const MODEL_BREATHING = require('../../assets/pets/breathing2.glb');
const MODEL_EXCITED = require('../../assets/pets/excited2.glb');
const MODEL_SAD = require('../../assets/pets/Sad.glb');
const MODEL_FALLINGDOWN = require('../../assets/pets/fall.glb');

useGLTF.preload(MODEL_BREATHING);
useGLTF.preload(MODEL_EXCITED);
useGLTF.preload(MODEL_SAD);
useGLTF.preload(MODEL_FALLINGDOWN);

type GLTFResult = GLTF & {
  nodes: Record<string, THREE.Object3D>;
  materials: Record<string, THREE.Material>;
};

export type ActiveModel = 'breathing' | 'excited' | 'sad' | 'falling';

const MODEL_MAP: Record<ActiveModel, any> = {
  breathing: MODEL_BREATHING,
  excited: MODEL_EXCITED,
  sad: MODEL_SAD,
  falling: MODEL_FALLINGDOWN,
};

// Pick the right animation clip for each model type.
// All GLB files share the same base mesh — they only differ in baked animations.
// breathing2.glb: [0]=excited-like(6s), [1]=idle/breathing(10s) → use longest
// excited2.glb:   [0]=excited(6s) → use [0]
// Sad.glb:        [0]=sad(3s) → use [0]
// fall.glb:       [0]=excited-like(6s), [1]=idle(10s), [2]=fall(2s) → use LAST (shortest unique)
function pickClip(animations: THREE.AnimationClip[], activeModel: ActiveModel): THREE.AnimationClip {
  if (activeModel === 'breathing') {
    // Use the longest clip (idle/breathing)
    return [...animations].sort((a, b) => b.duration - a.duration)[0];
  }
  if (activeModel === 'falling') {
    // Use the LAST clip (the unique fall animation, shortest)
    return animations[animations.length - 1];
  }
  // excited, sad: use first clip
  return animations[0];
}

interface PetModelProps {
  modelAsset: any;
  activeModel: ActiveModel;
  onAnimationDone?: () => void;
}

function PetModel({ modelAsset, activeModel, onAnimationDone }: PetModelProps) {
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const gltf = useGLTF(modelAsset) as GLTFResult;
  const { scene, animations } = gltf;

  useEffect(() => {
    console.log(`[PetModel] mount activeModel=${activeModel} clips=${animations?.length} names=[${animations?.map(a => `${a.name}(${a.duration.toFixed(1)}s)`).join(', ')}]`);

    if (!animations || animations.length === 0) {
      console.log(`[PetModel] No animations for ${activeModel}`);
      if (activeModel === 'excited' || activeModel === 'falling') {
        const t = setTimeout(() => onAnimationDone?.(), 1500);
        return () => clearTimeout(t);
      }
      return;
    }

    const mixer = new THREE.AnimationMixer(scene);
    mixerRef.current = mixer;

    const clip = pickClip(animations, activeModel);
    console.log(`[PetModel] Playing "${clip.name}" (${clip.duration.toFixed(1)}s) for ${activeModel}`);

    const action = mixer.clipAction(clip);
    action.reset();

    if (activeModel === 'excited') {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
    }

    action.play();

    const onFinished = () => {
      console.log(`[PetModel] Animation finished for ${activeModel}`);
      onAnimationDone?.();
    };

    if (activeModel === 'excited') {
      mixer.addEventListener('finished', onFinished);
    }

    return () => {
      console.log(`[PetModel] cleanup ${activeModel}`);
      if (activeModel === 'excited') {
        mixer.removeEventListener('finished', onFinished);
      }
      mixer.stopAllAction();
      mixerRef.current = null;
    };
  }, [scene, animations, activeModel, onAnimationDone]);

  useFrame((_state, delta) => {
    if (mixerRef.current) mixerRef.current.update(delta);
  });

  return (
    <group position={[0, -1, 0]}>
      <primitive object={scene} />
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

const FADE_MS = 120;

interface PetRendererProps {
  activeModel?: ActiveModel;
  onExcitedFinished?: () => void;
}

export const PetRenderer = memo(function PetRenderer({ activeModel = 'breathing', onExcitedFinished }: PetRendererProps) {
  const [canvasReady, setCanvasReady] = useState(false);
  const [renderedModel, setRenderedModel] = useState<ActiveModel>(activeModel);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isFirstRender = useRef(true);

  const excitedCallbackRef = useRef(onExcitedFinished);
  excitedCallbackRef.current = onExcitedFinished;
  const stableOnDone = useCallback(() => {
    excitedCallbackRef.current?.();
  }, []);

  // When activeModel changes: fade → swap → reveal
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setRenderedModel(activeModel);
      return;
    }

    console.log(`[PetRenderer] activeModel changed to "${activeModel}", starting fade swap`);

    // Immediately cancel anything in flight
    fadeAnim.stopAnimation();

    // Fade in overlay, swap, fade out — all in sequence
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start(() => {
      // Always swap — don't check `finished` flag, the stopAnimation above
      // ensures only the latest effect's animation runs
      console.log(`[PetRenderer] Fade in done, swapping to "${activeModel}"`);
      setRenderedModel(activeModel);

      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: FADE_MS,
          useNativeDriver: true,
        }).start();
      }, 80);
    });
  }, [activeModel, fadeAnim]);

  if (Platform.OS === 'web') return <FallbackView />;

  const modelAsset = MODEL_MAP[renderedModel] ?? MODEL_BREATHING;

  console.log(`[PetRenderer] render: activeModel=${activeModel} renderedModel=${renderedModel}`);

  return (
    <View className="flex-1 bg-sky-200">
      {!canvasReady && <ModelLoadingFallback />}

      <Canvas
        key={renderedModel}
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
            key={renderedModel}
            modelAsset={modelAsset}
            activeModel={renderedModel}
            onAnimationDone={renderedModel === 'excited' ? stableOnDone : undefined}
          />
        </Suspense>
      </Canvas>

      <Animated.View
        pointerEvents="none"
        style={{ opacity: fadeAnim }}
        className="absolute inset-0 bg-[#bae6fd]"
      />
    </View>
  );
});
