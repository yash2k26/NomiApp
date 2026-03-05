type SoundName =
  | 'feed'
  | 'play'
  | 'rest'
  | 'tap'
  | 'happy'
  | 'sad'
  | 'excited'
  | 'mint'
  | 'purchase'
  | 'spin'
  | 'reward'
  | 'levelup'
  | 'equip';

type MusicName = 'headphones';

// Looping background music tracks — asset references
const MUSIC_ASSETS: Record<MusicName, any> = {
  headphones: require('../../assets/Audio/Headphones_music.mp3'),
};

let Audio: any = null;
let audioReady = false;
const loadedSounds = new Map<SoundName, any>();
let currentMusic: any = null;
let currentMusicName: MusicName | null = null;
let muted = false;
let volume = 1.0;

/**
 * Try to load expo-av Audio. Returns true if successful.
 */
function ensureAudio(): boolean {
  if (audioReady) return true;
  if (Audio === false) return false; // already tried and failed

  try {
    const mod = require('expo-av');
    Audio = mod.Audio;
    if (Audio) {
      audioReady = true;
      return true;
    }
    Audio = false;
    return false;
  } catch {
    Audio = false;
    return false;
  }
}

/**
 * Configure audio mode and preload all sound assets.
 * Call once at app startup.
 */
export async function initSounds(): Promise<void> {
  if (!ensureAudio()) return;

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  } catch {}

}

/**
 * Play a named sound effect. No-op if muted, sound not loaded, or expo-av unavailable.
 */
export async function playSound(name: SoundName): Promise<void> {
  if (!audioReady || muted) return;

  const sound = loadedSounds.get(name);
  if (!sound) return;

  try {
    await sound.setPositionAsync(0);
    await sound.setVolumeAsync(volume);
    await sound.playAsync();
  } catch {
    // Sound may have been unloaded — ignore
  }
}

/**
 * Play a looping background music track. Stops any previously playing music.
 */
export async function playMusic(name: MusicName): Promise<void> {
  if (!ensureAudio()) return;

  // Already playing this track
  if (currentMusicName === name && currentMusic) return;

  await stopMusic();

  const asset = MUSIC_ASSETS[name];
  if (!asset) return;

  try {
    const { sound } = await Audio.Sound.createAsync(asset, {
      shouldPlay: true,
      isLooping: true,
      volume: muted ? 0 : volume,
    });
    currentMusic = sound;
    currentMusicName = name;
  } catch {}
}

/**
 * Stop the currently playing background music and unload it.
 */
export async function stopMusic(): Promise<void> {
  if (currentMusic) {
    try {
      await currentMusic.stopAsync();
      await currentMusic.unloadAsync();
    } catch {}
    currentMusic = null;
    currentMusicName = null;
  }
}

/**
 * Stop all currently playing sounds (SFX only).
 */
export async function stopAll(): Promise<void> {
  for (const sound of loadedSounds.values()) {
    try {
      await sound.stopAsync();
    } catch {}
  }
}

export function setVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
}

export function setMuted(m: boolean): void {
  muted = m;
}

export function isMuted(): boolean {
  return muted;
}

/**
 * Unload all sounds and music.
 */
export async function unloadSounds(): Promise<void> {
  await stopMusic();
  for (const sound of loadedSounds.values()) {
    try {
      await sound.unloadAsync();
    } catch {}
  }
  loadedSounds.clear();
}

export type { SoundName, MusicName };
