import { create } from 'zustand';

interface WalletState {
  connected: boolean;
  address: string;
  balance: number;
}

interface WalletActions {
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

type WalletStore = WalletState & WalletActions;

function generateMockAddress(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789';
  let addr = '';
  for (let i = 0; i < 44; i++) {
    addr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return addr;
}

export const useWalletStore = create<WalletStore>((set) => ({
  connected: false,
  address: '',
  balance: 0,

  connectWallet: async () => {
    await new Promise((r) => setTimeout(r, 1000));
    set({
      connected: true,
      address: generateMockAddress(),
      balance: 50,
    });
  },

  disconnectWallet: () => {
    set({ connected: false, address: '', balance: 0 });
  },
}));
