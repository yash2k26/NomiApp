import type { DiaryContext, PersonalityTraits, PetMemory } from '../store/personalityStore';

/*
 * LLM-powered diary entry generator.
 *
 * Calls a backend proxy (Cloudflare Worker) that holds the Anthropic API key.
 * The Anthropic key MUST NEVER ship in the client bundle — anyone with the APK
 * can extract EXPO_PUBLIC_* vars. The worker is the security boundary.
 *
 * Endpoint contract (POST EXPO_PUBLIC_DIARY_API_URL):
 *   request:  { traits, recentMemories[], mood, hunger, happiness, energy,
 *               timeOfDay, ownerName?, equippedSkin?, activeAdventureZone? }
 *   response: { text: string, illustration: string }
 *
 * If EXPO_PUBLIC_DIARY_API_URL is unset OR the call fails, returns null and the
 * caller falls back to the local template generator. So the app still works
 * without the worker deployed; it just keeps the old diary voice.
 */

export interface LLMDiaryRequest {
  traits: PersonalityTraits;
  recentMemories: { type: string; detail?: string; daysAgo: number }[];
  mood: string;
  hunger: number;
  happiness: number;
  energy: number;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  ownerName?: string;
  equippedSkin?: string;
  activeAdventureZone?: string;
  hoursAway: number;
}

export interface LLMDiaryResponse {
  text: string;
  illustration: string;
}

const REQUEST_TIMEOUT_MS = 8000;

export async function generateLLMDiaryEntry(
  ctx: DiaryContext,
  traits: PersonalityTraits,
  memories: PetMemory[],
): Promise<LLMDiaryResponse | null> {
  // Strip trailing slashes for consistency with the other worker URLs.
  const url = process.env.EXPO_PUBLIC_DIARY_API_URL?.replace(/\/+$/, '');
  if (!url) return null;

  const recentMemories = memories
    .slice(-8)
    .map((m) => ({
      type: m.type,
      detail: m.detail,
      daysAgo: Math.max(0, Math.floor((Date.now() - m.timestamp) / (1000 * 60 * 60 * 24))),
    }));

  const body: LLMDiaryRequest = {
    traits,
    recentMemories,
    mood: ctx.mood,
    hunger: ctx.hunger,
    happiness: ctx.happiness,
    energy: ctx.energy,
    timeOfDay: getTimeOfDay(),
    ownerName: ctx.ownerName,
    equippedSkin: ctx.equippedSkin,
    activeAdventureZone: ctx.activeAdventureZone,
    hoursAway: ctx.hoursAway,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const token = process.env.EXPO_PUBLIC_STATE_API_TOKEN;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['X-App-Token'] = token;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn('[diary] LLM endpoint returned', res.status);
      return null;
    }
    const data = (await res.json()) as Partial<LLMDiaryResponse>;
    if (!data.text || typeof data.text !== 'string') return null;
    return {
      text: data.text.trim(),
      illustration: data.illustration ?? '\u{1F4D6}',
    };
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      console.warn('[diary] LLM call failed:', err?.message ?? err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = new Date().getHours();
  if (h < 5) return 'night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}
