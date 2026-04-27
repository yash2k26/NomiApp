import React, { useRef, memo, useState, Suspense, useEffect, useCallback } from 'react';
import { View, Text, Platform, LogBox, ActivityIndicator, Image } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useGLTF, OrbitControls, useTexture } from '@react-three/drei/native';
import * as THREE from 'three';
import type { GLTF } from 'three-stdlib';

LogBox.ignoreLogs(['EXGL: gl.pixelStorei()', 'THREE.THREE.Clock']);

// App logo / loading image
const ME_IMG = require('../../assets/Icons/Me.png');

// Single GLB with pet + accessories + ALL animations baked in.
const MODEL = require('../../assets/pets/nomi-combined.glb');

type GLTFResult = GLTF & {
  nodes: Record<string, THREE.Object3D>;
  materials: Record<string, THREE.Material>;
};

export type ActiveModel = 'breathing' | 'excited' | 'sad' | 'falling' | 'dancing' | 'backflip' | 'punch' | 'fallover';

// All clips are baked into nomi-combined.glb.
// "dancing" remaps to the Excited clip (no Dance clip in current GLB), so headphones loop the Excited animation.
const CLIP_NAME_MAP: Record<ActiveModel, string> = {
  breathing: 'Breathing',
  excited: 'Excited',
  sad: 'Sad',
  dancing: 'Excited',
  falling: 'FallOver',
  backflip: 'Backflip',
  punch: 'Punch',
  fallover: 'FallOver',
};

// One-shot animations (play once then done). 'dancing' is excluded so headphones loop forever.
const ONE_SHOT: Set<ActiveModel> = new Set(['excited', 'falling', 'backflip', 'fallover']);

const HEAD_BONE_NAME = 'mixamorig:Head';

// Accessory node names matching the merge script output
const ACCESSORY_NODES = {
  headphones: 'Accessory_Headphones',
  crown: 'Accessory_Crown',
  hoodie: 'Accessory_Hoodie',
  shoes: 'Accessory_Shoes',
  hair: 'Accessory_Hair',
  'hair-beatrice': 'Accessory_HairBeatrice',
  'hair-kink': 'Accessory_HairKink',
} as const;

// Outfit textures — full-body texture swaps. Map shop skinKey → asset.
// Each is a UV-mapped diffuse texture that replaces the default.
// Add new outfits by dropping a PNG/JPG in assets/textures/ and adding an entry here.
// NOTE: keys here must match shop item skinKeys exactly.
// 'default' is the canonical original body texture — used to restore on unequip.
// We load it here (not from GLB cache) so it's immune to mutation across hot reloads.
const DEFAULT_TEXTURE_KEY = '__default__';
const OUTFIT_TEXTURE_REQUIRES: Record<string, number> = {
  [DEFAULT_TEXTURE_KEY]: require('../../assets/textures/default-shaded.jpg'),
  'red-jersey': require('../../assets/textures/red-shaded.png'),
};
const OUTFIT_KEYS = Object.keys(OUTFIT_TEXTURE_REQUIRES).filter((k) => k !== DEFAULT_TEXTURE_KEY);

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
  // Cache of the body mesh's original (default) material map so we can restore it on unequip
  const defaultBodyMapRef = useRef<THREE.Texture | null>(null);
  const bodyMaterialsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  const gltf = useGLTF(MODEL) as GLTFResult;
  const { scene, animations } = gltf;

  // Pre-load all outfit textures up front. drei's useTexture handles RN-specific image loading.
  // Cast: drei's TS types only document string URIs but at runtime it accepts require() module IDs (numbers).
  const outfitTextures = useTexture(OUTFIT_TEXTURE_REQUIRES as any) as Record<string, THREE.Texture>;

  // Setup: mixer, bones, accessories
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
        node.traverse((child) => { child.visible = false; });
        accessoryRefsRef.current[key] = node;
        if (key === 'crown') setCrownNode(node);
      }
    }

    // Find the body's main material(s) — the mesh with the most vertices is the character body.
    let bodyMesh: THREE.Mesh | null = null;
    let maxVerts = 0;
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        const isAccessory = Object.values(ACCESSORY_NODES).some((name) => {
          let p: THREE.Object3D | null = m;
          while (p) { if (p.name === name) return true; p = p.parent; }
          return false;
        });
        if (isAccessory) return;
        const positionAttr = (m.geometry as THREE.BufferGeometry).attributes.position;
        const verts = positionAttr ? positionAttr.count : 0;
        if (verts > maxVerts) {
          maxVerts = verts;
          bodyMesh = m;
        }
      }
    });
    if (bodyMesh) {
      const mat = (bodyMesh as THREE.Mesh).material;
      const mats = Array.isArray(mat) ? mat : [mat];
      // Accept ANY material that has a `map` property — covers Standard/Physical/Lambert/Phong/Basic
      bodyMaterialsRef.current = mats.filter((m): m is THREE.MeshStandardMaterial => !!m && 'map' in (m as any));
      const firstMap = bodyMaterialsRef.current[0]?.map ?? null;
      defaultBodyMapRef.current = firstMap;
    } else {
      console.warn('[PetRenderer] no body mesh found');
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
      // Walk all descendants — SkinnedMesh children sometimes don't inherit parent.visible
      node.visible = isEquipped;
      node.traverse((child) => {
        child.visible = isEquipped;
        // Defensive: stale bounding spheres after scale change can cull the mesh out
        child.frustumCulled = false;
      });

      // ─── HEADPHONES position + scale (TWEAK THESE) ──────────────────
      // Headphones source GLB wasn't re-baked, so it still needs the runtime
      // transform override. The other head accessories (crown + 3 hairs) were
      // baked into the GLB by scripts/bake_all_accessories.py with positions
      // computed against the head bone — they render correctly with no runtime
      // override and just toggle visibility above.
      if (isEquipped && headBone && key === 'headphones') {
        if (node.parent !== headBone) {
          node.parent?.remove(node);
          headBone.add(node);
        }
        node.scale.set(0.04, 0.04, 0.04);
        node.position.set(0, 0.06, 0.01);
        node.rotation.set(0, 0, 0);
      }
      // ────────────────────────────────────────────────────────────────

      // ────────────────────────────────────────────────────────────────
    }
  }, [equippedSkin, headBone, scene]);

  // Outfit texture swap — drei's useTexture pre-loaded everything, just pick + apply
  useEffect(() => {
    const materials = bodyMaterialsRef.current;
    if (materials.length === 0) return;

    // Pick which texture to apply: an outfit, or the canonical default
    const targetKey = OUTFIT_KEYS.includes(equippedSkin) ? equippedSkin : DEFAULT_TEXTURE_KEY;
    const tex = outfitTextures[targetKey];
    if (!tex) return;
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    for (const mat of materials) {
      mat.map = tex;
      mat.color = new THREE.Color(0xffffff);
      mat.emissive = new THREE.Color(0x000000);
      mat.needsUpdate = true;
    }
  }, [equippedSkin, outfitTextures]);

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
    if (!clip) {
      console.warn(`[PetRenderer] clip "${clipName}" not found`);
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
    <group position={[0, -0.75, 0]} scale={0.95}>
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
        camera={{ position: [0, 0.3, 5.5], fov: 45 }}
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
