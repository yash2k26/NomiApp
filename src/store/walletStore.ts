import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WALLET_STORAGE_KEY = 'oracle-pet-wallet';

// Mock wallet address for demo (Expo Go doesn't support native modules)
const MOCK_ADDRESS = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const MOCK_BALANCE = 50;

interface WalletState {
  connected: boolean;
  address: string;
  balance: number;
  isConnecting: boolean;
  error: string | null;
}

interface WalletActions {
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshBalance: () => Promise<void>;
  hydrateWallet: () => Promise<void>;
  deductBalance: (amount: number) => void;
  addBalance: (amount: number) => void;
}

type WalletStore = WalletState & WalletActions;

export const useWalletStore = create<WalletStore>((set, get) => ({
  connected: false,
  address: '',
  balance: 0,
  isConnecting: false,
  error: null,

  connectWallet: async () => {
    set({ isConnecting: true, error: null });
    try {
      // Simulate wallet connection delay
      await new Promise((r) => setTimeout(r, 800));

      set({
        connected: true,
        address: MOCK_ADDRESS,
        balance: MOCK_BALANCE,
        isConnecting: false,
      });

      await AsyncStorage.setItem(
        WALLET_STORAGE_KEY,
        JSON.stringify({ address: MOCK_ADDRESS })
      );
    } catch (error: any) {
      set({ isConnecting: false, error: error?.message || 'Failed to connect wallet' });
    }
  },

  disconnectWallet: () => {
    set({ connected: false, address: '', balance: 0, error: null });
    AsyncStorage.removeItem(WALLET_STORAGE_KEY).catch(() => {});
  },

  refreshBalance: async () => {
    // Mock — balance stays the same
    const { connected } = get();
    if (!connected) return;
    set({ balance: MOCK_BALANCE });
  },

  deductBalance: (amount: number) => {
    const { balance } = get();
    set({ balance: Math.max(0, balance - amount) });
  },

  addBalance: (amount: number) => {
    const { balance } = get();
    set({ balance: Math.round((balance + amount) * 10000) / 10000 });
  },

  hydrateWallet: async () => {
    try {
      const stored = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
      if (!stored) return;
      const { address } = JSON.parse(stored);
      if (!address) return;
      set({ connected: true, address, balance: MOCK_BALANCE });
    } catch {
      // Silently fail
    }
  },
}));
