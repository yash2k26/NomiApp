import { transact, type Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { PublicKey } from '@solana/web3.js';
import { APP_IDENTITY } from './solanaClient';

// Decode base64 address → base58 Solana address
function toBase58Address(base64Address: string): string {
  console.log('[MWA] toBase58Address — base64 input length:', base64Address?.length);
  const bytes = Uint8Array.from(atob(base64Address), (c) => c.charCodeAt(0));
  const address = new PublicKey(bytes).toBase58();
  console.log('[MWA] toBase58Address — decoded:', address);
  return address;
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
  console.log('[MWA] connectMobileWallet — starting...');
  console.log('[MWA] APP_IDENTITY:', JSON.stringify(APP_IDENTITY));
  const startTime = Date.now();

  try {
    const result = await transact(async (wallet: Web3MobileWallet) => {
      console.log('[MWA] transact session opened in', Date.now() - startTime, 'ms');
      console.log('[MWA] Calling wallet.authorize — chain: solana:mainnet');

      const authStart = Date.now();
      const auth = await wallet.authorize({
        identity: APP_IDENTITY,
        chain: 'solana:mainnet',
      });
      console.log('[MWA] wallet.authorize returned in', Date.now() - authStart, 'ms');
      console.log('[MWA] auth_token present:', !!auth.auth_token, 'length:', auth.auth_token?.length);
      console.log('[MWA] wallet_uri_base:', auth.wallet_uri_base);
      console.log('[MWA] accounts count:', auth.accounts?.length);

      if (!auth.accounts?.length) {
        console.error('[MWA] No accounts returned by wallet!');
        throw new Error('No accounts returned by wallet');
      }

      console.log('[MWA] Raw account[0]:', JSON.stringify(auth.accounts[0]));
      const address = toBase58Address(auth.accounts[0].address);

      return {
        address,
        authToken: auth.auth_token,
        walletUriBase: auth.wallet_uri_base,
      };
    });

    console.log('[MWA] connectMobileWallet SUCCESS in', Date.now() - startTime, 'ms — address:', result.address);
    return result;
  } catch (err: any) {
    console.error('[MWA] connectMobileWallet FAILED after', Date.now() - startTime, 'ms');
    console.error('[MWA] Error:', err.message);
    console.error('[MWA] Error type:', err.constructor?.name);
    console.error('[MWA] Stack:', err.stack);
    throw err;
  }
}

/**
 * Reauthorize using a stored auth token (for app restarts).
 */
export async function reauthorizeMobileWallet(authToken: string): Promise<WalletAuthResult> {
  console.log('[MWA] reauthorizeMobileWallet — starting, authToken length:', authToken?.length);
  const startTime = Date.now();

  try {
    const result = await transact(async (wallet: Web3MobileWallet) => {
      console.log('[MWA] reauthorize transact session opened in', Date.now() - startTime, 'ms');

      const auth = await wallet.reauthorize({
        auth_token: authToken,
        identity: APP_IDENTITY,
      });
      console.log('[MWA] wallet.reauthorize returned, accounts:', auth.accounts?.length);

      if (!auth.accounts?.length) {
        console.error('[MWA] Reauthorize returned no accounts!');
        throw new Error('No accounts returned by wallet');
      }

      const address = toBase58Address(auth.accounts[0].address);
      return {
        address,
        authToken: auth.auth_token,
        walletUriBase: auth.wallet_uri_base,
      };
    });

    console.log('[MWA] reauthorizeMobileWallet SUCCESS in', Date.now() - startTime, 'ms — address:', result.address);
    return result;
  } catch (err: any) {
    console.error('[MWA] reauthorizeMobileWallet FAILED after', Date.now() - startTime, 'ms');
    console.error('[MWA] Error:', err.message);
    console.error('[MWA] Stack:', err.stack);
    throw err;
  }
}

/**
 * Deauthorize — disconnect from the wallet.
 */
export async function disconnectMobileWallet(authToken: string): Promise<void> {
  console.log('[MWA] disconnectMobileWallet — starting');
  try {
    await transact(async (wallet: Web3MobileWallet) => {
      await wallet.deauthorize({ auth_token: authToken });
    });
    console.log('[MWA] disconnectMobileWallet SUCCESS');
  } catch (err: any) {
    console.error('[MWA] disconnectMobileWallet FAILED:', err.message);
    throw err;
  }
}

/**
 * Run a callback inside a MWA session with reauthorization.
 * Use this for signing transactions in later phases.
 */
export async function withWallet<T>(
  authToken: string,
  callback: (wallet: Web3MobileWallet, address: string) => Promise<T>,
): Promise<T> {
  console.log('[MWA] withWallet — starting session, authToken length:', authToken?.length);
  const startTime = Date.now();

  try {
    const result = await transact(async (wallet: Web3MobileWallet) => {
      console.log('[MWA] withWallet transact session opened in', Date.now() - startTime, 'ms');
      console.log('[MWA] withWallet — calling wallet.reauthorize...');

      const reauthStart = Date.now();
      const auth = await wallet.reauthorize({
        auth_token: authToken,
        identity: APP_IDENTITY,
      });
      console.log('[MWA] withWallet reauthorize returned in', Date.now() - reauthStart, 'ms');
      console.log('[MWA] withWallet accounts:', auth.accounts?.length);

      if (!auth.accounts?.length) {
        console.error('[MWA] withWallet — no accounts from reauthorize!');
        throw new Error('No accounts returned by wallet');
      }

      const address = toBase58Address(auth.accounts[0].address);
      console.log('[MWA] withWallet — address:', address, '— executing callback...');

      const callbackStart = Date.now();
      const callbackResult = await callback(wallet, address);
      console.log('[MWA] withWallet — callback completed in', Date.now() - callbackStart, 'ms');

      return callbackResult;
    });

    console.log('[MWA] withWallet completed in', Date.now() - startTime, 'ms');
    return result;
  } catch (err: any) {
    console.error('[MWA] withWallet FAILED after', Date.now() - startTime, 'ms');
    console.error('[MWA] withWallet error:', err.message);
    console.error('[MWA] withWallet error type:', err.constructor?.name);
    console.error('[MWA] withWallet stack:', err.stack);
    throw err;
  }
}
