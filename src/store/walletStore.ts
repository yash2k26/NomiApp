import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBalance } from '../lib/solanaClient';
import { getSkrBalance } from '../lib/skrToken';
import {
  connectMobileWallet,
  reauthorizeMobileWallet,
  disconnectMobileWallet,
} from '../lib/mobileWalletAdapter';

const WALLET_STORAGE_KEY = 'oracle-pet-wallet';

interface WalletState {
  connected: boolean;
  address: string;
  balance: number;
  skrBalance: number;
  authToken: string;
  isConnecting: boolean;
  error: string | null;
}

interface WalletActions {
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshBalance: () => Promise<void>;
  refreshSkrBalance: () => Promise<void>;
  hydrateWallet: () => Promise<void>;
  deductBalance: (amount: number) => void;
  addBalance: (amount: number) => void;
  deductSkr: (amount: number) => void;
  addSkr: (amount: number) => void;
}

type WalletStore = WalletState & WalletActions;

async function saveWalletState(address: string, authToken: string) {
  try {
    await AsyncStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify({ address, authToken }));
  } catch {}
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  connected: false,
  address: '',
  balance: 0,
  skrBalance: 0,
  authToken: '',
  isConnecting: false,
  error: null,

  connectWallet: async () => {
    set({ isConnecting: true, error: null });
    try {
      const result = await connectMobileWallet();

      // Fetch real balance from devnet
      const balance = await getBalance(result.address);
      const skrBalance = await getSkrBalance(result.address).catch(() => 0);

      set({
        connected: true,
        address: result.address,
        authToken: result.authToken,
        balance,
        skrBalance,
        isConnecting: false,
      });

      await saveWalletState(result.address, result.authToken);
    } catch (error: any) {
      const code = error?.code;
      let message = 'Failed to connect wallet';

      if (code === 'ERROR_WALLET_NOT_FOUND') {
        message = 'No Solana wallet found. Install Phantom or Solflare.';
      } else if (code === 'ERROR_AUTHORIZATION_FAILED' || code === -1) {
        message = 'Connection rejected by wallet.';
      } else if (code === 'ERROR_SESSION_TIMEOUT') {
        message = 'Wallet connection timed out. Try again.';
      } else if (error?.message) {
        message = error.message;
      }

      set({ isConnecting: false, error: message });
    }
  },

  disconnectWallet: () => {
    const { authToken } = get();
    if (authToken) {
      disconnectMobileWallet(authToken).catch(() => {});
    }
    set({ connected: false, address: '', balance: 0, skrBalance: 0, authToken: '', error: null });
    AsyncStorage.removeItem(WALLET_STORAGE_KEY).catch(() => {});
  },

  refreshBalance: async () => {
    const { connected, address } = get();
    if (!connected || !address) return;
    try {
      const balance = await getBalance(address);
      set({ balance });
    } catch {}
  },

  refreshSkrBalance: async () => {
    const { connected, address } = get();
    if (!connected || !address) return;
    try {
      const skrBalance = await getSkrBalance(address);
      set({ skrBalance });
    } catch {}
  },

  deductBalance: (amount: number) => {
    const { balance } = get();
    set({ balance: Math.max(0, balance - amount) });
  },

  addBalance: (amount: number) => {
    const { balance } = get();
    set({ balance: Math.round((balance + amount) * 10000) / 10000 });
  },

  deductSkr: (amount: number) => {
    const { skrBalance } = get();
    set({ skrBalance: Math.max(0, Math.round((skrBalance - amount) * 1000000) / 1000000) });
  },

  addSkr: (amount: number) => {
    const { skrBalance } = get();
    set({ skrBalance: Math.round((skrBalance + amount) * 1000000) / 1000000 });
  },

  hydrateWallet: async () => {
    try {
      const stored = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
      if (!stored) return;
      const { address, authToken } = JSON.parse(stored);
      if (!address || !authToken) return;

      // Try to reauthorize with stored auth token
      const result = await reauthorizeMobileWallet(authToken);
      const balance = await getBalance(result.address);
      const skrBal = await getSkrBalance(result.address).catch(() => 0);

      set({
        connected: true,
        address: result.address,
        authToken: result.authToken,
        balance,
        skrBalance: skrBal,
      });

      await saveWalletState(result.address, result.authToken);
    } catch {
      // Reauth failed — user needs to connect again
      await AsyncStorage.removeItem(WALLET_STORAGE_KEY).catch(() => {});
    }
  },
}));
