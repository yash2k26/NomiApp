import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/*
 * Server-side push pipeline (real push that survives OS killing the app).
 *
 * Flow:
 *   1. App requests permission (existing flow in notificationStore)
 *   2. App calls registerForServerPush() once permission granted — fetches the
 *      Expo push token and POSTs it (along with wallet/petName) to the worker.
 *   3. App calls sendHeartbeat() on every foreground transition. Worker uses
 *      this to know who is "away" and ripe for a return push.
 *   4. Worker cron (hourly) finds devices inactive 18-25 hrs and sends a
 *      personalized "your Nomi misses you" push via the Expo Push API.
 *
 * Endpoint: EXPO_PUBLIC_PUSH_API_URL (the deployed worker URL).
 * If unset, all calls become no-ops — local notifications continue to work.
 */

const TOKEN_STORAGE_KEY = 'oracle-pet-push-token';

interface RegisterPayload {
  push_token: string;
  wallet: string;
  pet_name?: string;
  owner_name?: string;
}

interface HeartbeatPayload {
  push_token: string;
  wallet: string;
  // Snapshots that personalize push copy (cheap to send; worker picks from these)
  hunger?: number;
  happiness?: number;
  energy?: number;
  level?: number;
  streak_days?: number;
}

async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // emulators don't have push tokens
  try {
    const projectId = (Device as any).expoConfig?.extra?.eas?.projectId;
    const result = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return result.data ?? null;
  } catch (err: any) {
    console.warn('[push] getExpoPushTokenAsync failed:', err?.message ?? err);
    return null;
  }
}

async function postJson(path: string, body: unknown): Promise<boolean> {
  // Strip trailing slashes — `${base}/register` would otherwise produce
  // `...workers.dev//register` which Cloudflare routes as 404.
  const base = process.env.EXPO_PUBLIC_PUSH_API_URL?.replace(/\/+$/, '');
  if (!base) return false;
  try {
    const appToken = process.env.EXPO_PUBLIC_STATE_API_TOKEN;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (appToken) headers['X-App-Token'] = appToken;
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (err: any) {
    console.warn(`[push] ${path} failed:`, err?.message ?? err);
    return false;
  }
}

/**
 * One-time-per-install registration. Idempotent — safe to call on every app
 * launch. The worker upserts by push_token.
 */
export async function registerForServerPush(payload: Omit<RegisterPayload, 'push_token'>): Promise<void> {
  if (Platform.OS === 'web') return;

  let token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) {
    token = await getExpoPushToken();
    if (!token) return;
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  await postJson('/register', { push_token: token, ...payload } as RegisterPayload);
}

/**
 * Lightweight ping that updates last_active_at on the worker. Call on app
 * foreground transitions (not on every screen change).
 */
export async function sendHeartbeat(payload: Omit<HeartbeatPayload, 'push_token'>): Promise<void> {
  if (Platform.OS === 'web') return;

  const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) return;

  await postJson('/heartbeat', { push_token: token, ...payload } as HeartbeatPayload);
}

/**
 * Best-effort unregister from the worker, then wipe the saved push token.
 * Use on wallet disconnect or test/debug. Safe to call without a token.
 */
export async function clearPushToken(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    await postJson('/unregister', { push_token: token });
  }
  await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
}
