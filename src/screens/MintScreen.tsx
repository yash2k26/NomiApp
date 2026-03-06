import { View, Text, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useWalletStore } from '../store/walletStore';
import { usePetStore } from '../store/petStore';
import { useXpStore } from '../store/xpStore';
import { useAdventureStore } from '../store/adventureStore';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { mintPetNFT } from '../lib/nftMint';
import { getSolscanTxUrl } from '../lib/solanaClient';

type MintState = 'idle' | 'confirming' | 'minting' | 'success' | 'error';

export function MintScreen() {
  const balance = useWalletStore((s) => s.balance);
  const authToken = useWalletStore((s) => s.authToken);
  const refreshBalance = useWalletStore((s) => s.refreshBalance);
  const mintPet = usePetStore((s) => s.mintPet);
  const petName = usePetStore((s) => s.name);
  const ownerName = usePetStore((s) => s.ownerName);
  const streakDays = usePetStore((s) => s.streakDays);
  const level = useXpStore((s) => s.level);
  const evolutionStage = useAdventureStore((s) => s.evolutionStage);

  const [mintState, setMintState] = useState<MintState>('idle');
  const [mintError, setMintError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const handleMint = async () => {
    console.log('[MintScreen] handleMint triggered');
    console.log('[MintScreen] authToken present:', !!authToken);
    console.log('[MintScreen] balance:', balance, 'SOL');
    console.log('[MintScreen] petName:', petName, 'ownerName:', ownerName);
    console.log('[MintScreen] level:', level, 'evolutionStage:', evolutionStage, 'streakDays:', streakDays);

    if (!authToken) {
      console.error('[MintScreen] No authToken — wallet not connected');
      setMintError('Wallet not connected. Please reconnect.');
      setMintState('error');
      return;
    }

    setMintState('confirming');
    setMintError(null);

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
      console.log('[MintScreen] Mint SUCCESS — refreshing balance...');

      // Refresh balance to reflect SOL spent on fees
      await refreshBalance();
      console.log('[MintScreen] Balance refreshed');
    } catch (error: any) {
      const elapsed = Date.now() - mintStart;
      const msg = error?.message || 'Minting failed';
      console.error('[MintScreen] ========== MINT FAILED ==========');
      console.error('[MintScreen] Error after', elapsed, 'ms:', msg);
      console.error('[MintScreen] Error type:', error?.constructor?.name);
      console.error('[MintScreen] Error stack:', error?.stack);
      console.error('[MintScreen] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error || {})));
      setMintError(msg);
      setMintState('error');
    }
  };

  const openSolscan = () => {
    if (txSignature) {
      Linking.openURL(getSolscanTxUrl(txSignature));
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
        <ScreenHeader
          eyebrow="Genesis Companion"
          title="Mint Nomi"
          subtitle="Create your first companion NFT on Solana."
          badge="On-Chain NFT · Mainnet"
          rightSlot={(
            <View className="bg-white/20 rounded-xl px-3 py-1.5 border border-white/35">
              <Text className="text-white text-[10px] font-black">{balance.toFixed(2)} SOL</Text>
            </View>
          )}
        />

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
              <Text className="text-[13px] font-black text-pet-blue-dark">Solana Mainnet</Text>
            </View>
            <View className="flex-row justify-between py-3 border-b border-gray-100">
              <Text className="text-[12px] font-bold uppercase tracking-[0.8px] text-gray-500">Standard</Text>
              <Text className="text-[13px] font-black text-gray-800">Metaplex Token Metadata</Text>
            </View>
            <View className="flex-row justify-between py-3 border-b border-gray-100">
              <Text className="text-[12px] font-bold uppercase tracking-[0.8px] text-gray-500">Est. Cost</Text>
              <Text className="text-[16px] font-black text-pet-blue-dark">~0.01 SOL</Text>
            </View>
            <View className="flex-row justify-between py-3">
              <Text className="text-[12px] font-bold uppercase tracking-[0.8px] text-gray-500">Your Balance</Text>
              <Text className="text-[13px] font-black text-gray-800">{balance.toFixed(4)} SOL</Text>
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
              <Text className="ml-2 text-[12px] text-gray-600 font-medium">Verifiable on Solscan</Text>
            </View>
          </View>

          {/* Error message */}
          {mintState === 'error' && mintError && (
            <View className="mt-4 bg-red-50 rounded-2xl p-4 border border-red-200">
              <Text className="text-red-600 text-[12px] font-bold text-center">{mintError}</Text>
              <TouchableOpacity onPress={() => { setMintState('idle'); setMintError(null); }} className="mt-2">
                <Text className="text-red-400 text-[11px] font-bold text-center underline">Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Success: View on Solscan */}
          {mintState === 'success' && txSignature && (
            <TouchableOpacity onPress={openSolscan} className="mt-4" activeOpacity={0.8}>
              <View className="bg-green-50 rounded-2xl p-4 border border-green-200 flex-row items-center justify-center">
                <MaterialCommunityIcons name="open-in-new" size={16} color="#16a34a" />
                <Text className="text-green-600 text-[12px] font-black ml-2">View on Solscan</Text>
              </View>
            </TouchableOpacity>
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
      </View>
    </View>
  );
}
