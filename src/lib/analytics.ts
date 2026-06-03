import PostHog from 'posthog-react-native';

/*
 * Analytics + error capture abstraction.
 *
 * Single API regardless of provider — call sites use track/identify/screen/captureError.
 * PostHog is the current backend. Sentry can be added inside this file without
 * touching any caller.
 *
 * Configuration: set EXPO_PUBLIC_POSTHOG_KEY (and optionally EXPO_PUBLIC_POSTHOG_HOST)
 * in a .env file. If unset, all calls become no-ops so dev builds still work.
 */

type Props = Record<string, string | number | boolean | null | undefined>;

let posthog: PostHog | null = null;
let initialized = false;
let queue: Array<() => void> = [];
let identityFlushed = false;

export async function initAnalytics(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

  if (!key) {
    console.log('[analytics] EXPO_PUBLIC_POSTHOG_KEY not set — analytics disabled');
    return;
  }

  try {
    posthog = new PostHog(key, { host, flushAt: 20, flushInterval: 30000 });
    queue.forEach((fn) => fn());
    queue = [];
  } catch (err) {
    console.warn('[analytics] init failed:', err);
  }
}

function run(fn: () => void) {
  if (posthog) fn();
  else if (initialized) {
    /* analytics disabled (no key) — drop silently */
  } else queue.push(fn);
}

function clean(props?: Props): Record<string, unknown> | undefined {
  if (!props) return undefined;
  const out: Record<string, unknown> = {};
  for (const k in props) if (props[k] !== undefined) out[k] = props[k];
  return out;
}

export function track(event: string, props?: Props) {
  run(() => posthog?.capture(event, clean(props) as any));
}

export function identify(distinctId: string, traits?: Props) {
  identityFlushed = true;
  run(() => posthog?.identify(distinctId, clean(traits) as any));
}

export function screen(name: string, props?: Props) {
  run(() => posthog?.screen(name, clean(props) as any));
}

export function captureError(err: unknown, context?: Props) {
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : '';
  const type = err instanceof Error ? (err.name || 'Error') : 'Error';
  // PostHog's exception ingest now REQUIRES the $exception_list shape; the
  // old flat $exception_message / $exception_stack_trace_raw fields get
  // rejected at ingest with "missing field `$exception_list`" serde errors.
  // We still send the legacy fields too so older PostHog dashboards/queries
  // that grep for them keep working.
  run(() =>
    posthog?.capture('$exception', {
      $exception_list: [
        {
          type,
          value: msg,
          mechanism: { handled: true, type: 'generic' },
          stacktrace: stack ? { type: 'raw', frames: [{ raw: stack }] } : undefined,
        },
      ],
      $exception_message: msg,
      $exception_type: type,
      $exception_stack_trace_raw: stack,
      ...clean(context),
    } as any)
  );
}

export function reset() {
  identityFlushed = false;
  run(() => posthog?.reset());
}

export function hasIdentity(): boolean {
  return identityFlushed;
}

/*
 * ── Typed helpers for our core event taxonomy ──
 *
 * Add a helper here whenever a new event is instrumented across the app, so the
 * full event surface is discoverable in one file. Naming convention: snake_case
 * verb_object. Property names also snake_case.
 */

export const events = {
  appOpen: (props: { cold_start: boolean }) => track('app_open', props),
  appState: (state: 'active' | 'background' | 'inactive') => track('app_state_change', { state }),
  walletConnected: (props: { address: string; balance_sol: number; skr_balance: number }) =>
    track('wallet_connected', props),
  walletDisconnected: () => track('wallet_disconnected'),
  petMinted: (props: { mint_address: string; cost_sol: number }) => track('pet_minted', props),
  spinStarted: (props: { is_free: boolean; cost_sol: number }) => track('spin_started', props),
  spinResult: (props: { rarity: string; label: string; xp: number; is_free: boolean }) =>
    track('spin_result', props),
  shopPurchase: (props: { item_id: string; currency: 'SOL' | 'SKR' | 'coins'; amount: number; rarity?: string }) =>
    track('shop_purchase', props),
  premiumPurchase: (props: { tier: 'plus' | 'pro'; currency: 'SOL' | 'SKR'; amount: number }) =>
    track('premium_purchase', props),
  careAction: (props: { action: 'feed' | 'play' | 'rest' | 'reflect'; xp: number }) =>
    track('care_action', props),
  cooldownSkipped: (props: { action: 'feed' | 'play' | 'rest' | 'reflect'; cost_sol: number }) =>
    track('cooldown_skipped', props),
  levelUp: (props: { from_level: number; to_level: number }) => track('level_up', props),
  evolved: (props: { from_stage: string; to_stage: string; level: number }) => track('evolved', props),
  adventureStarted: (props: { zone: string; duration_min: number }) => track('adventure_started', props),
  adventureCompleted: (props: { zone: string; xp: number; coins: number; shards: number }) =>
    track('adventure_completed', props),
  miniGameStarted: (props: { game: string }) => track('mini_game_started', props),
  miniGameCompleted: (props: { game: string; score: number; xp: number }) => track('mini_game_completed', props),
  streakBroken: (props: { previous_streak: number }) => track('streak_broken', props),
  streakRepairUsed: (props: { days_repaired: number; cost_sol?: number; cost_skr?: number }) =>
    track('streak_repair_used', props),
  pushReceived: (props: { kind: string }) => track('push_received', props),
  pushOpened: (props: { kind: string }) => track('push_opened', props),
  shareTriggered: (props: { surface: 'pet_card' | 'referral' | 'auto_clip' }) =>
    track('share_triggered', props),
  coinCapHit: (props: {
    source: string;
    amount_requested: number;
    amount_granted: number;
    daily_total: number;
    cap_value: number;
    fully_capped: boolean;
  }) => track('coin_cap_hit', props),
  referralLinkOpened: (props: { referrer_address: string }) => track('referral_link_opened', props),
  referralRedeemed: (props: { referrer_address: string }) => track('referral_redeemed', props),
};
