import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTransactionHistory, type OnChainTransaction } from '../lib/transactionHistory';

const TX_LABELS_KEY = 'oracle-pet-tx-labels';

export interface LabeledTransaction extends OnChainTransaction {
  label: string;
}

interface TxHistoryState {
  transactions: LabeledTransaction[];
  isLoading: boolean;
  /** True while a "load more" page is in flight. Distinct from initial fetch
   *  so the screen can show a footer spinner without obscuring already-loaded
   *  rows. */
  isLoadingMore: boolean;
  /** True when the last fetch returned a full page — there might be more
   *  history older than what's loaded. False when we hit the tail. */
  hasMore: boolean;
  txLabels: Record<string, string>; // signature → human-readable label
}

interface TxHistoryActions {
  fetchHistory: (address: string) => Promise<void>;
  fetchMore: (address: string) => Promise<void>;
  labelTransaction: (signature: string, label: string) => void;
  hydrateTxLabels: () => Promise<void>;
}

type TxHistoryStore = TxHistoryState & TxHistoryActions;

async function saveTxLabels(labels: Record<string, string>) {
  try {
    await AsyncStorage.setItem(TX_LABELS_KEY, JSON.stringify(labels));
  } catch {}
}

// Page size for tx history. Previously hard-coded to 15 — power users with
// frequent activity hit that ceiling and never saw older transactions.
const PAGE_SIZE = 30;

export const useTxHistoryStore = create<TxHistoryStore>((set, get) => ({
  transactions: [],
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,
  txLabels: {},

  fetchHistory: async (address: string) => {
    set({ isLoading: true });
    try {
      const raw = await getTransactionHistory(address, PAGE_SIZE);
      const { txLabels } = get();

      const labeled: LabeledTransaction[] = raw.map((tx) => ({
        ...tx,
        label: txLabels[tx.signature] || (tx.memo ? 'Memo' : 'Transaction'),
      }));

      set({
        transactions: labeled,
        isLoading: false,
        // If we got a full page, assume there's more behind it.
        hasMore: raw.length >= PAGE_SIZE,
      });
    } catch {
      set({ isLoading: false, hasMore: false });
    }
  },

  fetchMore: async (address: string) => {
    const { transactions, isLoadingMore, hasMore } = get();
    if (isLoadingMore || !hasMore || transactions.length === 0) return;
    set({ isLoadingMore: true });
    try {
      const before = transactions[transactions.length - 1].signature;
      const raw = await getTransactionHistory(address, PAGE_SIZE, before);
      const { txLabels } = get();
      const labeled: LabeledTransaction[] = raw.map((tx) => ({
        ...tx,
        label: txLabels[tx.signature] || (tx.memo ? 'Memo' : 'Transaction'),
      }));
      set({
        transactions: [...transactions, ...labeled],
        isLoadingMore: false,
        hasMore: raw.length >= PAGE_SIZE,
      });
    } catch {
      set({ isLoadingMore: false });
    }
  },

  labelTransaction: (signature: string, label: string) => {
    const labels = { ...get().txLabels, [signature]: label };
    set({ txLabels: labels });
    saveTxLabels(labels);
  },

  hydrateTxLabels: async () => {
    try {
      const raw = await AsyncStorage.getItem(TX_LABELS_KEY);
      if (raw) {
        set({ txLabels: JSON.parse(raw) });
      }
    } catch {}
  },
}));

/**
 * Convenience function to label a transaction from outside the store.
 */
export function labelTransaction(signature: string, label: string) {
  useTxHistoryStore.getState().labelTransaction(signature, label);
}
