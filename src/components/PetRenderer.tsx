import React, { useRef, memo, useState, Suspense, useEffect, useCallback } from 'react';
import { View, Text, Platform, LogBox, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
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

// Preload the model at startup so the heavy parse happens during the welcome
// / connect screens and the GLB is cached + ready by the time Home mounts.
// (On-device diagnostics confirmed the model parses fine — 83 nodes / 14
// meshes / 6 anims — it's just slow; warming it early is what makes it appear
// promptly. Removing this made the parse run cold on Home and is what caused
// the false "Couldn't load".)
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
  /** Force the active clip to LoopRepeat regardless of ONE_SHOT membership.
   *  Used when activeModel comes from an equipped shop animation — the user
   *  expects a continuous loop, not a play-once-and-freeze. */
  loopAnimation?: boolean;
  /** Fires once after the GLB is loaded and the model has mounted (post-Suspense).
   *  This is the real "Nomi is on screen" signal — Canvas onCreated fires earlier,
   *  before the model has loaded, so it can't be used for hiding the loading splash. */
  onModelMounted?: () => void;
}

function PetModel({ activeModel, onAnimationDone, equippedSkin, loopAnimation, onModelMounted }: PetModelProps) {
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

  // Fire once after the GLB is loaded and PetModel has mounted (post-Suspense).
  // This is the real "Nomi is on screen" signal for hiding the loading splash.
  const mountedFiredRef = useRef(false);
  const onModelMountedRef = useRef(onModelMounted);
  onModelMountedRef.current = onModelMounted;
  useEffect(() => {
    if (mountedFiredRef.current) return;
    mountedFiredRef.current = true;
    onModelMountedRef.current?.();
  }, []);

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
    // When loopAnimation is on, equipped one-shots (like backflip) loop
    // continuously instead of playing once and freezing.
    const playOnce = ONE_SHOT.has(activeModel) && !loopAnimation;
    const mixer = mixerRef.current;
    if (!mixer || animations.length === 0) {
      if (playOnce) {
        const t = setTimeout(() => onAnimationDone?.(), 1500);
        return () => clearTimeout(t);
      }
      return;
    }

    // 'dancing' prefers the real Dance clip if it's been merged in;
    // otherwise falls back to Excited (set in CLIP_NAME_MAP).
    let clipName = CLIP_NAME_MAP[activeModel];
    if (activeModel === 'dancing' && animations.some(c => c.name === 'Dance')) {
      clipName = 'Dance';
    }
    // Special case: falling with headphones uses Dance instead of FallOver
    if (activeModel === 'falling' && equippedSkin === 'headphones') {
      clipName = 'Dance';
    }

    const clip = animations.find(c => c.name === clipName);
    if (!clip) {
      console.warn(`[PetRenderer] clip "${clipName}" not found`);
      return;
    }

    const previousAction = activeActionRef.current;
    if (previousAction) {
      previousAction.fadeOut(0.15);
    }

    const action = mixer.clipAction(clip);
    action.reset();

    if (playOnce) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
    }

    action.fadeIn(0.15).play();
    activeActionRef.current = action;

    // Hard-stop the faded-out action after the crossfade window completes.
    // Without this, the previous action stays at weight=0 forever and the
    // mixer keeps ticking it on every frame. Over a long session with many
    // animation swaps, the CPU+GPU cost adds up — explains "freezes after
    // 30 min" reports on slow Asian devices.
    let stopTimer: ReturnType<typeof setTimeout> | null = null;
    if (previousAction && previousAction !== action) {
      stopTimer = setTimeout(() => {
        try { previousAction.stop(); } catch {}
      }, 200);
    }

    const onFinished = () => onAnimationDone?.();

    if (playOnce) {
      mixer.addEventListener('finished', onFinished);
    }

    return () => {
      if (stopTimer) clearTimeout(stopTimer);
      if (playOnce) {
        mixer.removeEventListener('finished', onFinished);
      }
    };
  }, [activeModel, animations, equippedSkin, onAnimationDone, loopAnimation]);

  useFrame((_state, delta) => {
    mixerRef.current?.update(delta);
  });

  return (
    <group position={[0, -1.05, 0]} scale={1.25}>
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
  // Escalating reassurance: the GLB load can take a few seconds on first
  // launch (cold parse, GPU upload). Static "Loading Nomi..." text held for
  // 8s reads as "stuck" — a softer second-line message after 3s tells the
  // user we're still working without alarming them.
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 3000);
    const t2 = setTimeout(() => setPhase(2), 8000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  const subtitle =
    phase === 0 ? 'Loading Nomi...' :
    phase === 1 ? 'Just a moment — first launch is the slowest' :
    'Almost there — finishing up';
  return (
    <View className="absolute inset-0 items-center justify-center z-10 bg-sky-200">
      <Image source={ME_IMG} style={{ width: 100, height: 100, marginBottom: 12 }} resizeMode="contain" />
      <ActivityIndicator size="small" color="#3b82f6" />
      <Text className="text-blue-400 text-xs mt-3 font-bold">{subtitle}</Text>
    </View>
  );
}

function ModelLoadFailedFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="absolute inset-0 items-center justify-center z-10 bg-sky-200 px-6">
      <Image source={ME_IMG} style={{ width: 100, height: 100, marginBottom: 12, opacity: 0.6 }} resizeMode="contain" />
      <Text className="text-blue-700 text-sm font-black mb-1">Couldn't load Nomi's 3D model</Text>
      <Text className="text-blue-500 text-[11px] text-center mb-4 px-4">
        This usually clears with a quick retry. Check your connection or try restarting the app.
      </Text>
      <TouchableOpacity onPress={onRetry} activeOpacity={0.85} className="bg-pet-blue px-5 py-2.5 rounded-full border border-pet-blue-dark/40">
        <Text className="text-white text-[12px] font-black tracking-[0.5px] uppercase">Retry</Text>
      </TouchableOpacity>
    </View>
  );
}


interface PetRendererProps {
  activeModel?: ActiveModel;
  onExcitedFinished?: () => void;
  equippedSkin?: string;
  onReady?: () => void;
  /** True when the active animation comes from an equipped shop item — forces the
   *  clip to LoopRepeat so e.g. backflip keeps looping instead of freezing. */
  loopAnimation?: boolean;
  /** When true, the 3D render loop is stopped (Canvas frameloop="never").
   *  Set while the Home page is scrolled off-screen in the pager so the
   *  continuous useFrame loop doesn't keep burning CPU/GPU/battery on tabs
   *  where the pet isn't visible — that background loop was a lag source. */
  paused?: boolean;
}

export const PetRenderer = memo(function PetRenderer({ activeModel = 'breathing', onExcitedFinished, equippedSkin = 'default', onReady, loopAnimation, paused = false }: PetRendererProps) {
  const [canvasReady, setCanvasReady] = useState(false);
  const [modelMounted, setModelMounted] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // Bumping this remounts the Canvas + PetModel — used by the retry button
  // when GLB load times out, so we get a fresh attempt rather than a hung one.
  const [retryKey, setRetryKey] = useState(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  // Watchdog — VERY patient, and NO auto-reload. On-device diagnostics proved
  // the model parses fine; it's just slow on a cold parse. The old behaviour
  // (35s timeout + auto-reload) was catastrophic: it gave up before the slow
  // parse finished and then CLEARED + restarted it, so a load that needed ~40s
  // could never complete — it was thrown away and restarted every 35s. That
  // loop is exactly why "Couldn't load" showed even though the GLB was fine.
  // Now: we simply wait. The watchdog only exists for a genuine hang (90s),
  // and it just shows a manual Retry — it never auto-restarts a load in flight.
  useEffect(() => {
    if (modelMounted || loadFailed) return;
    const timer = setTimeout(() => {
      if (!modelMounted) setLoadFailed(true);
    }, 90000);
    return () => clearTimeout(timer);
  }, [modelMounted, loadFailed, retryKey]);

  const handleRetry = () => {
    // Manual retry only (user-initiated): clear the cache and remount for a
    // clean attempt. Never fires automatically.
    try {
      (useGLTF as any).clear?.(MODEL);
    } catch {}
    setLoadFailed(false);
    setModelMounted(false);
    setCanvasReady(false);
    setRetryKey((k) => k + 1);
  };

  const excitedCallbackRef = useRef(onExcitedFinished);
  excitedCallbackRef.current = onExcitedFinished;
  const stableOnDone = useCallback(() => {
    excitedCallbackRef.current?.();
  }, []);

  if (Platform.OS === 'web') return <FallbackView />;

  return (
    <View className="flex-1 bg-sky-200">
      {/* Keep the loading splash up until the GLB has actually mounted, not
          just until the Canvas has created. The Canvas creates in ~50ms but
          the 42 MB GLB takes seconds to read+parse+upload. Without this,
          the splash disappears immediately and the user stares at a blue
          canvas with just a shadow disc — looks broken even though loading
          is progressing fine. */}
      {!modelMounted && !loadFailed && <ModelLoadingFallback />}
      {loadFailed && <ModelLoadFailedFallback onRetry={handleRetry} />}

      <Canvas
        key={retryKey}
        // "never" fully stops the render loop while Home is off-screen in the
        // pager. We don't drop to "demand" until the GLB has mounted, so the
        // initial load still renders the frames it needs to appear.
        frameloop={paused && modelMounted ? 'never' : 'always'}
        camera={{ position: [0, 0.3, 5.5], fov: 45 }}
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

        {/* Ground / contact shadow — gives the impression Nomi is standing on a surface.
            Two stacked discs: outer soft platform tint + inner darker contact shadow. */}
        <mesh position={[0, -1.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.6, 48]} />
          <meshBasicMaterial color="#7fbcd0" transparent opacity={0.28} depthWrite={false} />
        </mesh>
        <mesh position={[0, -1.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.95, 48]} />
          <meshBasicMaterial color="#1e3a5f" transparent opacity={0.22} depthWrite={false} />
        </mesh>

        <Suspense fallback={null}>
          <PetModel
            activeModel={activeModel}
            onAnimationDone={activeModel === 'excited' ? stableOnDone : undefined}
            equippedSkin={equippedSkin}
            loopAnimation={loopAnimation}
            onModelMounted={() => {
              setModelMounted(true);
              onReadyRef.current?.();
            }}
          />
        </Suspense>
      </Canvas>
    </View>
  );
});
