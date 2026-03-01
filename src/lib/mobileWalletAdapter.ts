import { transact, type Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { PublicKey } from '@solana/web3.js';
import { APP_IDENTITY } from './solanaClient';

// Decode base64 address → base58 Solana address
function toBase58Address(base64Address: string): string {
  const bytes = Uint8Array.from(atob(base64Address), (c) => c.charCodeAt(0));
  return new PublicKey(bytes).toBase58();
}

export interface WalletAuthResult {
  address: string;       // base58 Solana address
  authToken: string;     // for reauthorization
  walletUriBase: string; // deep-link URI of the wallet app
}

/**
 * Open Phantom/Solflare via MWA and authorize this app.
 */
export async function connectMobileWallet(): Promise<WalletAuthResult> {
  return await transact(async (wallet: Web3MobileWallet) => {
    const auth = await wallet.authorize({
      identity: APP_IDENTITY,
      chain: 'solana:devnet',
    });

    const address = toBase58Address(auth.accounts[0].address);

    return {
      address,
      authToken: auth.auth_token,
      walletUriBase: auth.wallet_uri_base,
    };
  });
}

/**
 * Reauthorize using a stored auth token (for app restarts).
 */
export async function reauthorizeMobileWallet(authToken: string): Promise<WalletAuthResult> {
  return await transact(async (wallet: Web3MobileWallet) => {
    const auth = await wallet.reauthorize({
      auth_token: authToken,
      identity: APP_IDENTITY,
    });

    const address = toBase58Address(auth.accounts[0].address);

    return {
      address,
      authToken: auth.auth_token,
      walletUriBase: auth.wallet_uri_base,
    };
  });
}

/**
 * Deauthorize — disconnect from the wallet.
 */
export async function disconnectMobileWallet(authToken: string): Promise<void> {
  await transact(async (wallet: Web3MobileWallet) => {
    await wallet.deauthorize({ auth_token: authToken });
  });
}

/**
 * Run a callback inside a MWA session with reauthorization.
 * Use this for signing transactions in later phases.
 */
export async function withWallet<T>(
  authToken: string,
  callback: (wallet: Web3MobileWallet, address: string) => Promise<T>,
): Promise<T> {
  return await transact(async (wallet: Web3MobileWallet) => {
    const auth = await wallet.reauthorize({
      auth_token: authToken,
      identity: APP_IDENTITY,
    });
    const address = toBase58Address(auth.accounts[0].address);
    return callback(wallet, address);
  });
}
