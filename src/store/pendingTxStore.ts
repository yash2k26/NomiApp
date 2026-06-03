import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/*
 * Persistent log of every chain-touching transaction the user has initiated
 * from this device. Visible to the user via the Profile screen so they have
 * an auditable list of "what I paid for, when, with what tx hash."
 *
 * Motivation: bug reports almost always start with "I paid but didn't get
 * anything." Without this log, the user has no way to point at a specific
 * tx to verify. They reinstall, the toast notification is gone, support
 * has nothing to work with. Now there's a permanent local record.
 *
 * Not a replacement for the server ledger (purchasesService) — different
 * scope:
 *   - This: local UX, every initiated tx (including failures, cancellations)
 *   - Ledger: server-side, only successful confirmed purchases
 *
 * Entries persist across app restarts. Capped to MAX_ENTRIES so the storage
 * row stays bounded.
 */

export type TxKind = 'mint' | 'premium' | 'shop' | 'spin' | 'care' | 'streak-repair' | 'other';
export type TxStatus = 'pending' | 'confirmed' | 'failed';

export interface PendingTxEntry {
  id: string;
  kind: TxKind;
  /** Human-readable label, e.g. "Pro Premium", "Crown" */
  label: string;
  /** Optional amount + currency for display, e.g. "0.45 SOL" */
  amountDisplay?: string;
  /** On-chain signature once we have one. Pending entries created
   *  pre-submission may not have this yet. */
  signature?: string;
  status: TxStatus;
  /** Failure reason when status === 'failed'. Display-only. */
  failureMessage?: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'oracle-pet-pending-tx';
const MAX_ENTRIES = 50;

interface PendingTxState {
  entries: PendingTxEntry[];
  addEntry: (input: { kind: TxKind; label: string; amountDisplay?: string; signature?: string; status?: TxStatus }) => string;
  updateEntry: (id: string, patch: Partial<Pick<PendingTxEntry, 'signature' | 'status' | 'failureMessage' | 'amountDisplay' | 'label'>>) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;
  hydrate: () => Promise<void>;
}

function generateId(): string {
  return `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function save(entries: PendingTxEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

export const usePendingTxStore = create<PendingTxState>((set, get) => ({
  entries: [],

  addEntry: (input) => {
    const id = generateId();
    const now = Date.now();
    const entry: PendingTxEntry = {
      id,
      kind: input.kind,
      label: input.label,
      amountDisplay: input.amountDisplay,
      signature: input.signature,
      status: input.status ?? 'pending',
      createdAt: now,
      updatedAt: now,
    };
    const next = [entry, ...get().entries].slice(0, MAX_ENTRIES);
    set({ entries: next });
    save(next);
    return id;
  },

  updateEntry: (id, patch) => {
    const next = get().entries.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e));
    set({ entries: next });
    save(next);
  },

  removeEntry: (id) => {
    const next = get().entries.filter((e) => e.id !== id);
    set({ entries: next });
    save(next);
  },

  clearAll: () => {
    set({ entries: [] });
    save([]);
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      // Defensive — drop anything malformed during hydration to avoid a
      // single bad entry from a future-version row breaking the whole list.
      const clean: PendingTxEntry[] = parsed.filter((e) => e && typeof e.id === 'string' && typeof e.label === 'string');
      set({ entries: clean.slice(0, MAX_ENTRIES) });
    } catch {}
  },
}));
