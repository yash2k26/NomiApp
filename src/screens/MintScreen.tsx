import { View, Text, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useWalletStore } from '../store/walletStore';
import { usePetStore } from '../store/petStore';
import { useXpStore } from '../store/xpStore';
import { useAdventureStore } from '../store/adventureStore';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { mintPetNFT } from '../lib/nftMint';
import { SOLANA_NETWORK, getSolscanAddressUrl } from '../lib/solanaClient';
import { parseTxError, type ParsedTxError } from '../lib/transactionErrors';
import { events, captureError } from '../lib/analytics';
import { restorePurchases } from '../lib/purchaseRestore';
import { notify, truncateMid } from '../lib/notify';

// Persisted across app restarts so a user who backgrounded the app during a
// failed mint sees the error breadcrumb on relaunch instead of a clean Mint
// button — preventing them from unknowingly paying twice for the same NFT.
const MINT_ERROR_STORAGE_KEY = 'oracle-pet-mint-error';

type MintState = 'idle' | 'confirming' | 'minting' | 'success' | 'error';

export function MintScreen() {
  const balance = useWalletStore((s) => s.balance);
  const address = useWalletStore((s) => s.address);
  const walletBrand = useWalletStore((s) => s.walletBrand);
  const authToken = useWalletStore((s) => s.authToken);
  const refreshBalance = useWalletStore((s) => s.refreshBalance);
  const mintPet = usePetStore((s) => s.mintPet);
  const petName = usePetStore((s) => s.name);
  const ownerName = usePetStore((s) => s.ownerName);
  const streakDays = usePetStore((s) => s.streakDays);
  const level = useXpStore((s) => s.level);
  const evolutionStage = useAdventureStore((s) => s.evolutionStage);

  const setOwnerName = usePetStore((s) => s.setOwnerName);

  const [mintState, setMintState] = useState<MintState>('idle');
  const [mintError, setMintError] = useState<ParsedTxError | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Rehydrate any persisted error from a prior session. If the user
  // backgrounded the app during 'minting' or 'confirming', we couldn't
  // confirm tx outcome — show that ambiguity explicitly so they don't blindly
  // mint again.
  useEffect(() => {
    AsyncStorage.getItem(MINT_ERROR_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as ParsedTxError;
          setMintError(parsed);
          setMintState('error');
        } catch {}
      })
      .catch(() => {});
  }, []);

  const persistMintError = (err: ParsedTxError | null) => {
    if (err) {
      AsyncStorage.setItem(MINT_ERROR_STORAGE_KEY, JSON.stringify(err)).catch(() => {});
    } else {
      AsyncStorage.removeItem(MINT_ERROR_STORAGE_KEY).catch(() => {});
    }
  };

  const handleRestoreFromChain = async () => {
    if (!address || restoring) return;
    setRestoring(true);
    try {
      const result = await restorePurchases(address);
      if (result.petRestored) {
        // Pet identity is now set; the App.tsx gate will route to HomeScreen
        // automatically once usePetStore.hasPet flips true.
        notify.success(
          'Welcome back!',
          result.petRestoredFromHoldings
            ? 'Found your Nomi NFT on-chain. Restoring now…'
            : 'Restored your pet from chain.',
          { category: 'restore' },
        );
      } else {
        notify.warning(
          'No pet found in this wallet',
          walletBrand
            ? `We checked ${walletBrand}. If your pet was minted with a different wallet, disconnect and reconnect with that one.`
            : 'If your pet was minted with a different wallet, disconnect and reconnect with that one.',
          { category: 'restore' },
        );
      }
    } catch (err: any) {
      captureError(err, { surface: 'manual_restore' });
      notify.error('Restore failed', err?.message ?? 'Could not reach the chain. Try again in a moment.');
    } finally {
      setRestoring(false);
    }
  };

  const openHelp = () => {
    Linking.openURL('mailto:team@talkamore.com?subject=Nomi%20app%20help').catch(() => {});
  };

  const handleBack = () => {
    // Clearing ownerName routes the App gate back to NameInputScreen. That
    // path destroys the entered name silently — confirm so users who tap
    // here expecting a "go back to a previous step" don't lose the name
    // they just typed without realizing it.
    Alert.alert(
      'Change your name?',
      `You'll go back to the name screen and re-enter it. Your wallet stays connected.`,
      [
        { text: 'Stay here', style: 'cancel' },
        { text: 'Change name', style: 'destructive', onPress: () => setOwnerName('') },
      ],
    );
  };

  const handleMint = async () => {
    console.log('[MintScreen] handleMint triggered');
    console.log('[MintScreen] authToken present:', !!authToken);
    console.log('[MintScreen] balance:', balance, 'SOL');
    console.log('[MintScreen] petName:', petName, 'ownerName:', ownerName);
    console.log('[MintScreen] level:', level, 'evolutionStage:', evolutionStage, 'streakDays:', streakDays);

    if (!authToken) {
      console.error('[MintScreen] No authToken — wallet not connected');
      const err: ParsedTxError = { title: 'Wallet Not Connected', message: 'Please reconnect your wallet and try again.', type: 'generic' };
      setMintError(err);
      persistMintError(err);
      setMintState('error');
      return;
    }

    // Pre-check balance before opening Phantom
    // 0.15 SOL mint fee + ~0.01 SOL on-chain rent/fees buffer
    if (balance < 0.16) {
      const err: ParsedTxError = {
        title: 'Not Enough SOL',
        message: `Minting costs 0.15 SOL plus ~0.01 SOL in network fees, but you only have ${balance.toFixed(4)} SOL. Please add more SOL to your wallet.`,
        type: 'insufficient_funds',
      };
      setMintError(err);
      persistMintError(err);
      setMintState('error');
      return;
    }

    setMintState('confirming');
    setMintError(null);
    persistMintError(null);

    const mintStart = Date.now();
    try {
      setMintState('minting');
      console.log('[MintScreen] Calling mintPetNFT...');
      const result = await mintPetNFT(authToken, petName || 'Nomi', {
        ownerName,
        level,
        stage: evolutionStage,
        streak: streakDays,
      });
      console.log('[MintScreen] mintPetNFT returned in', Date.now() - mintStart, 'ms');
      console.log('[MintScreen] mintAddress:', result.mintAddress);
      console.log('[MintScreen] txSignature:', result.txSignature);

      // Store real on-chain mint address and tx signature
      mintPet(result.mintAddress, result.txSignature);
      setTxSignature(result.txSignature);
      setMintState('success');
      persistMintError(null);
      events.petMinted({ mint_address: result.mintAddress, cost_sol: 0.15 });
      notify.success(
        `${petName || 'Nomi'} is yours!`,
        '0.15 SOL paid. Your pet is minted on Solana.',
        {
          category: 'tx',
          details: [
            { label: 'Pet name', value: petName || 'Nomi' },
            { label: 'Cost', value: '0.15 SOL' },
            { label: 'Mint address', value: truncateMid(result.mintAddress, 6, 6) },
            { label: 'Transaction', value: truncateMid(result.txSignature, 8, 8) },
          ],
          solscanTxSignature: result.txSignature,
        },
      );
      console.log('[MintScreen] Mint SUCCESS — refreshing balance...');

      // Record mint with the server ledger so future reinstalls / wallet
      // reconnects resolve identity via the fast path instead of waiting
      // for a chain memo scan. Best-effort — chain is still the audit log.
      try {
        const { confirmPurchase } = require('../lib/purchasesService');
        confirmPurchase({
          wallet: address ?? '',
          kind: 'mint',
          payload: result.mintAddress,
          signature: result.txSignature,
          currency: 'SOL',
          amount: 0.15,
        }).catch(() => {});
      } catch {}
      // Local pending-tx log entry (always visible in Profile).
      try {
        const { usePendingTxStore } = require('../store/pendingTxStore');
        usePendingTxStore.getState().addEntry({
          kind: 'mint',
          label: `Minted ${petName || 'Nomi'}`,
          amountDisplay: '0.15 SOL',
          signature: result.txSignature,
          status: 'confirmed',
        });
      } catch {}

      // Refresh balance to reflect SOL spent on fees
      await refreshBalance();
      console.log('[MintScreen] Balance refreshed');

      // Write a mint memo so future reinstalls can recover the pet's identity
      // from chain. Best-effort; failure here shouldn't block the success UI
      // since the NFT itself is already minted.
      try {
        const { writeMemo } = require('../lib/solanaTransactions');
        const mintMemoPayload = JSON.stringify({
          mintAddress: result.mintAddress,
          txSignature: result.txSignature,
          name: petName || 'Nomi',
          ownerName,
        });
        await writeMemo(authToken!, `oracle-pet:mint|${mintMemoPayload}`);
      } catch (memoErr: any) {
        console.warn('[MintScreen] Mint memo failed (non-fatal):', memoErr?.message ?? memoErr);
      }
    } catch (error: any) {
      const elapsed = Date.now() - mintStart;
      console.error('[MintScreen] Mint failed after', elapsed, 'ms:', error?.message);
      const parsed = parseTxError(error);
      setMintError(parsed);
      // Only persist non-cancellation errors — a user-cancelled mint isn't
      // ambiguous, so it doesn't need a breadcrumb on next launch.
      if (parsed.type !== 'cancelled') {
        persistMintError(parsed);
        setMintState('error');
        captureError(error, { surface: 'mint', elapsed_ms: elapsed });
      } else {
        setMintState('idle');
        persistMintError(null);
      }
    }
  };

  const buttonContent = () => {
    switch (mintState) {
      case 'confirming':
        return (
          <View className="flex-row items-center">
            <ActivityIndicator color="#FFF" size="small" />
            <Text className="text-white text-[16px] font-black ml-2">Confirm in Phantom...</Text>
          </View>
        );
      case 'minting':
        return (
          <View className="flex-row items-center">
            <ActivityIndicator color="#FFF" size="small" />
            <Text className="text-white text-[16px] font-black ml-2">Minting on Solana...</Text>
          </View>
        );
      case 'success':
        return (
          <View className="flex-row items-center">
            <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
            <Text className="text-white text-[16px] font-black ml-2">Minted Successfully!</Text>
          </View>
        );
      default:
        return (
          <Text className="text-white text-[16px] font-black tracking-[0.6px] uppercase">Mint Nomi NFT</Text>
        );
    }
  };

  const isBusy = mintState === 'confirming' || mintState === 'minting';

  return (
    <View className="flex-1">
      <LinearGradient
        colors={['#E7F6FF', '#D7EEFF', '#EAF8FF']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />

      <View className="absolute top-12 -right-10 w-44 h-44 rounded-full bg-pet-blue-light/35" />
      <View className="absolute top-80 -left-10 w-40 h-40 rounded-full bg-pet-blue-light/35" />

      <View className="flex-1 px-6 pt-6 pb-8">
        {!isBusy && mintState !== 'success' && (
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.85}
            style={{ alignSelf: 'flex-start', marginBottom: 14 }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
                borderRadius: 22,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderWidth: 1,
                borderColor: '#9FD2E0',
                shadowColor: '#1E3A5F',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.12,
                shadowRadius: 6,
                elevation: 4,
              }}
            >
              <MaterialCommunityIcons name="arrow-left" size={16} color="#2D6B90" style={{ marginRight: 6 }} />
              <Text style={{ color: '#2D6B90', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 }}>Change Name</Text>
            </View>
          </TouchableOpacity>
        )}

        <ScreenHeader
          eyebrow="Genesis Companion"
          title="Mint Nomi"
          subtitle="Create your first companion NFT on Solana."
          badge={`On-Chain NFT · ${SOLANA_NETWORK === 'mainnet' ? 'Mainnet' : SOLANA_NETWORK === 'devnet' ? 'Devnet' : 'Testnet'}`}
          rightSlot={(
            <View className="bg-white/20 rounded-xl px-3 py-1.5 border border-white/35">
              <Text className="text-white text-[10px] font-black">{balance.toFixed(2)} SOL</Text>
            </View>
          )}
        />

        {/* Promoted recovery banner. The existing "Already minted? Restore"
            button below was buried under the mint card — users who landed
            here after a wallet swap, reinstall, or chain-scan timeout would
            pay for a duplicate mint instead of trying restore. This banner
            sits above the mint card so it's the first thing the user sees.
            Auto-restore is best-effort but not perfect; the manual button
            is the safety net. */}
        {mintState === 'idle' && (
          <TouchableOpacity
            onPress={handleRestoreFromChain}
            disabled={restoring || !address}
            activeOpacity={0.9}
            style={{ marginBottom: 12 }}
          >
            <View
              style={{
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 14,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFF7E6',
                borderWidth: 1,
                borderColor: '#F4D27A',
              }}
            >
              <View style={{ marginRight: 10 }}>
                <MaterialCommunityIcons name="cloud-download" size={20} color="#B37514" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#B37514', fontSize: 12, fontWeight: '900', letterSpacing: 0.3 }}>
                  Already minted with this wallet?
                </Text>
                <Text style={{ color: '#7A4F0D', fontSize: 11, fontWeight: '600', marginTop: 1 }}>
                  {restoring ? 'Scanning chain for your Nomi…' : 'Tap to restore from chain — no new payment.'}
                </Text>
              </View>
              {restoring ? (
                <ActivityIndicator size="small" color="#B37514" />
              ) : (
                <MaterialCommunityIcons name="chevron-right" size={20} color="#B37514" />
              )}
            </View>
          </TouchableOpacity>
        )}

        <View className="flex-1 justify-center">
          <View
            className="w-full bg-white rounded-[28px] p-5 border border-gray-100"
            style={{
              shadowColor: '#22314A',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.07,
              shadowRadius: 14,
              elevation: 4,
            }}
          >
            <View className="flex-row justify-between py-3 border-b border-gray-100">
              <Text className="text-[12px] font-bold uppercase tracking-[0.8px] text-gray-500">Type</Text>
              <Text className="text-[13px] font-black text-gray-800">Companion NFT (1/1)</Text>
            </View>
            <View className="flex-row justify-between py-3 border-b border-gray-100">
              <Text className="text-[12px] font-bold uppercase tracking-[0.8px] text-gray-500">Network</Text>
              <Text className="text-[13px] font-black text-pet-blue-dark">Solana {SOLANA_NETWORK === 'mainnet' ? 'Mainnet' : SOLANA_NETWORK === 'devnet' ? 'Devnet' : 'Testnet'}</Text>
            </View>
            <View className="flex-row justify-between py-3 border-b border-gray-100">
              <Text className="text-[12px] font-bold uppercase tracking-[0.8px] text-gray-500">Standard</Text>
              <Text className="text-[13px] font-black text-gray-800">Metaplex Token Metadata</Text>
            </View>
            <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
              <View>
                <Text className="text-[12px] font-bold uppercase tracking-[0.8px] text-gray-500">Mint Price</Text>
                <View className="flex-row items-center mt-1">
                  <View className="bg-pink-100 px-1.5 py-0.5 rounded-md border border-pink-200">
                    <Text className="text-[9px] font-black text-pink-600 tracking-[0.5px]">EARLY BIRD</Text>
                  </View>
                  <Text className="text-[10px] font-semibold text-gray-400 ml-2">limited drop</Text>
                </View>
              </View>
              <View className="items-end">
                <Text className="text-[13px] font-bold text-gray-400 line-through" style={{ textDecorationLine: 'line-through' }}>0.3 SOL</Text>
                <Text className="text-[18px] font-black text-pet-blue-dark mt-0.5">0.15 SOL</Text>
              </View>
            </View>
            <View className="flex-row justify-between py-3 items-center">
              <Text className="text-[12px] font-bold uppercase tracking-[0.8px] text-gray-500">Your Balance</Text>
              <View className="flex-row items-center">
                <Text className="text-[13px] font-black text-gray-800 mr-2">{balance.toFixed(4)} SOL</Text>
                <TouchableOpacity onPress={() => refreshBalance().catch(() => {})} activeOpacity={0.6}>
                  <MaterialCommunityIcons name="refresh" size={16} color="#3792A6" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View className="w-full mt-5">
            <View className="flex-row items-center mb-2.5">
              <MaterialCommunityIcons name="cube-outline" size={16} color="#3792A6" />
              <Text className="ml-2 text-[12px] text-gray-600 font-medium">Real NFT minted on Solana blockchain</Text>
            </View>
            <View className="flex-row items-center mb-2.5">
              <MaterialCommunityIcons name="star-four-points" size={16} color="#3792A6" />
              <Text className="ml-2 text-[12px] text-gray-600 font-medium">Mood-based 3D reactions & animations</Text>
            </View>
            <View className="flex-row items-center mb-2.5">
              <MaterialCommunityIcons name="hanger" size={16} color="#4FB0C6" />
              <Text className="ml-2 text-[12px] text-gray-600 font-medium">On-chain outfits and accessories</Text>
            </View>
            <View className="flex-row items-center">
              <MaterialCommunityIcons name="shield-star" size={16} color="#3792A6" />
              <Text className="ml-2 text-[12px] text-gray-600 font-medium">Verifiable on-chain</Text>
            </View>
          </View>

          {/* Error message */}
          {mintState === 'error' && mintError && (
            <View
              className="mt-4 rounded-2xl p-5 border"
              style={{
                backgroundColor: mintError.type === 'insufficient_funds' ? '#FFF7ED' : '#FEF2F2',
                borderColor: mintError.type === 'insufficient_funds' ? '#FDBA74' : '#FECACA',
              }}
            >
              <View className="items-center mb-2">
                <MaterialCommunityIcons
                  name={
                    mintError.type === 'insufficient_funds' ? 'wallet-outline' :
                    mintError.type === 'network' ? 'wifi-off' :
                    mintError.type === 'timeout' ? 'clock-alert-outline' :
                    'alert-circle-outline'
                  }
                  size={28}
                  color={mintError.type === 'insufficient_funds' ? '#EA580C' : '#DC2626'}
                />
              </View>
              <Text
                className="text-[14px] font-black text-center mb-1"
                style={{ color: mintError.type === 'insufficient_funds' ? '#C2410C' : '#DC2626' }}
              >
                {mintError.title}
              </Text>
              <Text className="text-[12px] font-medium text-gray-600 text-center leading-[18px]">
                {mintError.message}
              </Text>
              {/* When the error is "did the mint actually go through?" type
                  ambiguity (network/timeout), give the user a way to verify
                  on chain BEFORE they retry and pay twice. Insufficient
                  funds doesn't need this — it's clear the mint never started. */}
              {address && mintError.type !== 'insufficient_funds' && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(getSolscanAddressUrl(address))}
                  className="mt-3 bg-white rounded-xl py-2.5 items-center border border-blue-200"
                  activeOpacity={0.85}
                >
                  <Text className="text-[12px] font-black text-blue-600">Check My Wallet on Solscan</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => { setMintState('idle'); setMintError(null); persistMintError(null); }}
                className="mt-2 bg-white/80 rounded-xl py-2.5 items-center border border-gray-200"
              >
                <Text className="text-[12px] font-black text-gray-700">Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Success — see notifications for details */}
          {mintState === 'success' && txSignature && (
            <View className="mt-4 bg-green-50 rounded-2xl p-4 border border-green-200 flex-row items-center justify-center">
              <MaterialCommunityIcons name="check-circle-outline" size={16} color="#16a34a" />
              <Text className="text-green-700 text-[12px] font-black ml-2">Minted on Solana — tap the bell for details</Text>
            </View>
          )}
        </View>

        <TouchableOpacity onPress={handleMint} disabled={isBusy || mintState === 'success'} activeOpacity={0.9} className="w-full">
          <LinearGradient
            colors={mintState === 'success' ? ['#16a34a', '#22c55e'] : mintState === 'error' ? ['#dc2626', '#ef4444'] : ['#3792A6', '#4FB0C6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="py-4 items-center"
            style={{
              borderRadius: 9999,
              overflow: 'hidden',
              opacity: isBusy ? 0.75 : 1,
              shadowColor: '#3792A6',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.28,
              shadowRadius: 10,
              elevation: 6,
            }}
          >
            {buttonContent()}
          </LinearGradient>
        </TouchableOpacity>

        {/* Already-minted recovery path. Clickable on the idle state so users
            who get to MintScreen by mistake (auto-restore couldn't find their
            NFT, wrong wallet, fresh install, etc.) have a one-tap way out
            before paying for a duplicate mint. */}
        {mintState === 'idle' && (
          <TouchableOpacity
            onPress={handleRestoreFromChain}
            disabled={restoring || !address}
            activeOpacity={0.85}
            style={{ marginTop: 14 }}
          >
            <View
              style={{
                paddingVertical: 12,
                borderRadius: 9999,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#9FD2E0',
              }}
            >
              {restoring ? (
                <>
                  <ActivityIndicator size="small" color="#2D6B90" />
                  <Text style={{ color: '#2D6B90', fontSize: 12, fontWeight: '800', letterSpacing: 0.4, marginLeft: 8 }}>
                    Checking chain…
                  </Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="cloud-download-outline" size={14} color="#2D6B90" />
                  <Text style={{ color: '#2D6B90', fontSize: 12, fontWeight: '800', letterSpacing: 0.4, marginLeft: 6 }}>
                    Already minted? Restore from chain
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* Wallet-mismatch hint — soft, only when the user is on idle and a
            wallet brand is known. Most users with the bug we're fixing are
            connected to one wallet but their NFT is in another. */}
        {mintState === 'idle' && walletBrand && walletBrand !== 'unknown' && (
          <Text
            style={{
              marginTop: 10,
              fontSize: 11,
              color: '#6B7C8E',
              textAlign: 'center',
              lineHeight: 15,
              paddingHorizontal: 8,
            }}
          >
            Connected to {walletBrand.charAt(0).toUpperCase() + walletBrand.slice(1)}.
            If your pet was minted with a different wallet, disconnect and reconnect with that one.
          </Text>
        )}

        {/* Bottom support link — reduces the support-loop angst that produced
            the bug report we're fixing now. */}
        <TouchableOpacity onPress={openHelp} activeOpacity={0.7} style={{ marginTop: 14, alignSelf: 'center' }}>
          <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '600', letterSpacing: 0.3 }}>
            Having trouble? Get help →
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
