import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/*
 * Unified in-app notification center.
 *
 * Every meaningful event (tx success/fail, reward earned, restore happened,
 * cap hit, push registered, etc.) flows through pushNotification(). The flow:
 *   1. Toast appears for a few seconds (transient, top of screen)
 *   2. Same notification persists in the notification center for later review
 *   3. User can tap the bell anywhere to see history
 *
 * This replaces scattered Alert.alert calls and silent catch{} blocks across
 * the app. Solscan links are intentionally NOT stored — the user shouldn't
 * need to leave the app to understand what happened.
 *
 * Persistence: AsyncStorage, capped at MAX_NOTIFICATIONS (oldest dropped).
 */

const STORAGE_KEY = 'oracle-pet-notifications-v1';
const MAX_NOTIFICATIONS = 50;
// Toast queue is in-memory only — transient by design.

export type NotificationSeverity = 'success' | 'error' | 'warning' | 'info';

export interface NotificationDetailRow {
  label: string;
  value: string;
}

export interface AppNotification {
  id: string;
  severity: NotificationSeverity;
  title: string;
  body?: string;
  /** Structured details surfaced when the user taps the notification (tx
   *  signatures, amounts, etc.). No external links — values are display-only
   *  / copyable. */
  details?: NotificationDetailRow[];
  /** Optional category — lets the notification center filter or group later. */
  category?: 'tx' | 'reward' | 'system' | 'streak' | 'cap' | 'restore' | 'social' | 'premium';
  /** Optional "View on Solscan" link. When set, the notification renders a
   *  tappable link below the body. Critical trust signal for crypto users —
   *  they want immediate proof their tx landed on chain. Pair with the
   *  category 'tx' for purchases/transfers. */
  solscanTxSignature?: string;
  createdAt: number;
  read: boolean;
  /** If true the notification is shown as a toast and persisted. If false
   *  it's persisted but no toast fires (rarely needed). */
  toast: boolean;
}

interface NotificationCenterState {
  notifications: AppNotification[];
  /** Currently-displayed toast id (singleton). The renderer subscribes to this
   *  and shows/hides accordingly. Null when no toast active. */
  activeToastId: string | null;
  /** Queue of pending toasts when one is already showing. */
  toastQueue: string[];
}

interface NotificationCenterActions {
  pushNotification: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & Partial<Pick<AppNotification, 'toast'>>) => string;
  dismissActiveToast: () => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  remove: (id: string) => void;
  clearAll: () => void;
  hydrate: () => Promise<void>;
}

type NotificationCenterStore = NotificationCenterState & NotificationCenterActions;

let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(state: NotificationCenterState) {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.notifications)).catch(() => {});
  }, 200);
}

function generateId(): string {
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useNotificationCenter = create<NotificationCenterStore>((set, get) => ({
  notifications: [],
  activeToastId: null,
  toastQueue: [],

  pushNotification: (input) => {
    const id = generateId();
    const notification: AppNotification = {
      id,
      severity: input.severity,
      title: input.title,
      body: input.body,
      details: input.details,
      category: input.category,
      solscanTxSignature: input.solscanTxSignature,
      toast: input.toast ?? true,
      createdAt: Date.now(),
      read: false,
    };

    set((state) => {
      // Newest first; cap to MAX_NOTIFICATIONS.
      const next = [notification, ...state.notifications].slice(0, MAX_NOTIFICATIONS);
      const updated: NotificationCenterState = {
        ...state,
        notifications: next,
        activeToastId: notification.toast && !state.activeToastId ? id : state.activeToastId,
        toastQueue: notification.toast && state.activeToastId ? [...state.toastQueue, id] : state.toastQueue,
      };
      scheduleSave(updated);
      return updated;
    });

    return id;
  },

  dismissActiveToast: () => {
    set((state) => {
      const [nextId, ...remaining] = state.toastQueue;
      return {
        ...state,
        activeToastId: nextId ?? null,
        toastQueue: remaining,
      };
    });
  },

  markAllRead: () => {
    set((state) => {
      const next = state.notifications.map((n) => (n.read ? n : { ...n, read: true }));
      const updated = { ...state, notifications: next };
      scheduleSave(updated);
      return updated;
    });
  },

  markRead: (id) => {
    set((state) => {
      const next = state.notifications.map((n) => (n.id === id && !n.read ? { ...n, read: true } : n));
      const updated = { ...state, notifications: next };
      scheduleSave(updated);
      return updated;
    });
  },

  remove: (id) => {
    set((state) => {
      const next = state.notifications.filter((n) => n.id !== id);
      const updated = {
        ...state,
        notifications: next,
        activeToastId: state.activeToastId === id ? null : state.activeToastId,
        toastQueue: state.toastQueue.filter((qid) => qid !== id),
      };
      scheduleSave(updated);
      return updated;
    });
  },

  clearAll: () => {
    set({ notifications: [], activeToastId: null, toastQueue: [] });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as AppNotification[];
      if (!Array.isArray(parsed)) return;
      // Don't re-fire toasts on hydration — show only in the center.
      set({ notifications: parsed, activeToastId: null, toastQueue: [] });
    } catch {}
  },
}));

/**
 * Convenience selector — total unread count for the bell badge.
 */
export function selectUnreadCount(s: NotificationCenterState): number {
  let n = 0;
  for (const note of s.notifications) if (!note.read) n++;
  return n;
}
