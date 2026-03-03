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
  txLabels: Record<string, string>; // signature → human-readable label
}

interface TxHistoryActions {
  fetchHistory: (address: string) => Promise<void>;
  labelTransaction: (signature: string, label: string) => void;
  hydrateTxLabels: () => Promise<void>;
}

type TxHistoryStore = TxHistoryState & TxHistoryActions;

async function saveTxLabels(labels: Record<string, string>) {
  try {
    await AsyncStorage.setItem(TX_LABELS_KEY, JSON.stringify(labels));
  } catch {}
}

export const useTxHistoryStore = create<TxHistoryStore>((set, get) => ({
  transactions: [],
  isLoading: false,
  txLabels: {},

  fetchHistory: async (address: string) => {
    set({ isLoading: true });
    try {
      const raw = await getTransactionHistory(address, 15);
      const { txLabels } = get();

      const labeled: LabeledTransaction[] = raw.map((tx) => ({
        ...tx,
        label: txLabels[tx.signature] || (tx.memo ? 'Memo' : 'Transaction'),
      }));

      set({ transactions: labeled, isLoading: false });
    } catch {
      set({ isLoading: false });
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
