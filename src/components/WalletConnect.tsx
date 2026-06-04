import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Linking, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useWalletStore } from '../store/walletStore';
import { SOLANA_NETWORK } from '../lib/solanaClient';
import { petTypography } from '../theme/typography';

const HANGING_IMG = require('../../assets/Photos/hanging.png');
const HEADPHONE_GUY_IMG = require('../../assets/Photos/headphoneguy.png');

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export function WalletConnect() {
  const { connectWallet, isConnecting, error } = useWalletStore();

  // Show a "still waiting" hint after 8 seconds so the user knows the app
  // hasn't frozen — and a Cancel link they can use to escape a hung
  // Phantom approval without force-quitting NomiApp.
  const [showStillWaiting, setShowStillWaiting] = useState(false);
  useEffect(() => {
    if (!isConnecting) { setShowStillWaiting(false); return; }
    const t = setTimeout(() => setShowStillWaiting(true), 8_000);
    return () => clearTimeout(t);
  }, [isConnecting]);

  // Reusable: lets the user retry after errors AND get help when stuck.
  // Previously a "no wallet found" error was a dead-end if Phantom was
  // installed afterwards — they had to force-close. Now connectWallet is
  // re-callable from the error block.
  const retry = () => {
    if (isConnecting) return;
    connectWallet();
  };
  const cancelConnect = () => {
    // Soft cancel: flip the local isConnecting state by calling the store's
    // setter pattern. The walletStore doesn't expose a direct cancel, but
    // setting an error message clears isConnecting in connectWallet's catch.
    // Simplest cross-store approach: re-run hydrateWallet which resets state.
    try {
      const ws = useWalletStore.getState() as any;
      // Manually reset isConnecting so the spinner clears even if the
      // pending MWA transaction is still resolving in the background. The
      // background promise's .then/.catch will be a no-op against the new
      // state because connectWallet uses the store's own isConnecting flag
      // internally only at start, not as a tx-cancel signal.
      if (typeof ws.cancelConnect === 'function') {
        ws.cancelConnect();
      } else {
        useWalletStore.setState({ isConnecting: false, error: 'Cancelled. Tap to try again whenever you\'re ready.' });
      }
    } catch {}
  };
  const openHelp = () => {
    Linking.openURL('mailto:team@talkamore.com?subject=Nomi%20wallet%20connect%20help').catch(() => {});
  };

  return (
    <View className="flex-1">
      {/* Full-bleed gradient */}
      <LinearGradient
        colors={['#5BA3D9', '#6DB4E0', '#7EC2E5', '#6FAFD6']}
        locations={[0, 0.3, 0.65, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Soft ambient circles */}
      <View
        className="absolute rounded-full bg-white/10"
        style={{ width: 220, height: 220, top: -60, right: -50 }}
      />
      <View
        className="absolute rounded-full bg-white/8"
        style={{ width: 160, height: 160, top: SCREEN_H * 0.45, left: -60 }}
      />
      <View
        className="absolute rounded-full bg-white/6"
        style={{ width: 100, height: 100, bottom: 120, right: -20 }}
      />

      {/* Hanging character — top left */}
      <Image
        source={HANGING_IMG}
        resizeMode="contain"
        style={{
          position: 'absolute',
          top: -40,
          left: 0,
          width: SCREEN_W * 0.65,
          height: 220,
        }}
      />

      {/* Headphone guy — peeking from right, clipped */}
      <View style={{ position: 'absolute', top: 175, right: 0, width: 160, height: 260, overflow: 'hidden' }}>
        <Image
          source={HEADPHONE_GUY_IMG}
          resizeMode="contain"
          style={{
            width: 270,
            height: 220,
            position: 'absolute',
            right: -78,
            top: 20,
            transform: [{ rotate: '-90deg' }],
          }}
        />
      </View>

      {/* ─── Hero Copy ─── */}
      <View className="absolute left-0 right-0 px-8" style={{ top: SCREEN_H * 0.44 }}>
        {/* Pill badge */}
        <View className="self-start mb-4 px-3.5 py-1.5 rounded-full bg-white/20 border border-white/30">
          <Text
            className="text-white/95 text-[10px] uppercase tracking-[1.5px]"
            style={{ fontFamily: petTypography.strong }}
          >
            Your Pocket Companion
          </Text>
        </View>

        {/* Title */}
        <Text
          className="text-white text-[52px] leading-[52px]"
          style={{ fontFamily: petTypography.display }}
        >
          Nomi
        </Text>

        {/* Tagline — two lines, visual hierarchy */}
        <Text
          className="text-white/50 text-[15px] leading-[22px] mt-3"
          style={{ fontFamily: petTypography.body }}
        >
          Raise it. Bond with it. Own it forever.
        </Text>
        <Text
          className="text-white/85 text-[14px] leading-[20px] mt-2"
          style={{ fontFamily: petTypography.body }}
        >
          A living pet on the blockchain that grows{'\n'}with every moment you spend together.
        </Text>

        {/* Feature pills */}
        <View className="flex-row flex-wrap mt-5 gap-2">
          {['On-chain NFT', 'Real emotions', 'Daily rituals'].map((tag) => (
            <View
              key={tag}
              className="px-3 py-1.5 rounded-full border border-white/25 bg-white/10"
            >
              <Text
                className="text-white/90 text-[11px]"
                style={{ fontFamily: petTypography.heading }}
              >
                {tag}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ─── Bottom Section ─── */}
      <View className="absolute left-0 right-0 bottom-0 px-7 pb-10">
        {/* Error */}
        {!!error && (
          <View className="bg-white/95 rounded-2xl px-4 py-3 mb-4 border border-red-200/60">
            <Text className="text-[12px] text-red-600 font-semibold text-center">{error}</Text>
            {error.includes('No Solana wallet') && (
              <TouchableOpacity onPress={() => Linking.openURL('https://phantom.app/download')} className="mt-1.5">
                <Text className="text-[11px] text-blue-500 font-bold text-center underline">
                  Get Phantom Wallet
                </Text>
              </TouchableOpacity>
            )}
            <View className="flex-row items-center justify-center mt-2" style={{ gap: 14 }}>
              <TouchableOpacity onPress={retry} disabled={isConnecting}>
                <Text className="text-[11px] text-blue-600 font-bold underline">Try again</Text>
              </TouchableOpacity>
              <Text className="text-gray-300">·</Text>
              <TouchableOpacity onPress={openHelp}>
                <Text className="text-[11px] text-gray-500 font-bold">Get help</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* CTA button */}
        <TouchableOpacity onPress={connectWallet} disabled={isConnecting} activeOpacity={0.85}>
          <View
            className="rounded-[28px] py-[18px] items-center bg-white"
            style={{
              shadowColor: '#1A4E6E',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.2,
              shadowRadius: 20,
              elevation: 8,
              opacity: isConnecting ? 0.85 : 1,
            }}
          >
            {isConnecting ? (
              <View className="items-center">
                <View className="flex-row items-center">
                  <ActivityIndicator color="#3A8BB5" size="small" />
                  <Text
                    className="text-[#3A8BB5] text-[16px] ml-2.5 uppercase tracking-[1px]"
                    style={{ fontFamily: petTypography.strong }}
                  >
                    Connecting...
                  </Text>
                </View>
                {showStillWaiting && (
                  <Text className="text-[10px] text-gray-500 mt-1.5">
                    Make sure your wallet app is open.
                  </Text>
                )}
              </View>
            ) : (
              <Text
                className="text-[#3A8BB5] text-[16px] uppercase tracking-[1px]"
                style={{ fontFamily: petTypography.strong }}
              >
                Connect Wallet
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {showStillWaiting && isConnecting && (
          <TouchableOpacity onPress={cancelConnect} activeOpacity={0.6} className="mt-3 items-center" hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}>
            <Text className="text-[12px] text-white/80 font-bold underline">
              Cancel
            </Text>
          </TouchableOpacity>
        )}

        {/* Fine print */}
        <Text
          className="text-white/45 text-[11px] text-center mt-4 tracking-[0.3px]"
          style={{ fontFamily: petTypography.body }}
        >
          Solana {SOLANA_NETWORK === 'mainnet' ? 'Mainnet' : SOLANA_NETWORK === 'devnet' ? 'Devnet' : 'Testnet'}  ·  Powered by Phantom
        </Text>
      </View>
    </View>
  );
}
