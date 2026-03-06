import { View, Text, TouchableOpacity, ActivityIndicator, Linking, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useWalletStore } from '../store/walletStore';
import { petTypography } from '../theme/typography';

const HANGING_IMG = require('../../assets/Photos/hanging.png');
const HEADPHONE_GUY_IMG = require('../../assets/Photos/headphoneguy.png');

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export function WalletConnect() {
  const { connectWallet, isConnecting, error } = useWalletStore();

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
              <View className="flex-row items-center">
                <ActivityIndicator color="#3A8BB5" size="small" />
                <Text
                  className="text-[#3A8BB5] text-[16px] ml-2.5 uppercase tracking-[1px]"
                  style={{ fontFamily: petTypography.strong }}
                >
                  Connecting...
                </Text>
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

        {/* Fine print */}
        <Text
          className="text-white/45 text-[11px] text-center mt-4 tracking-[0.3px]"
          style={{ fontFamily: petTypography.body }}
        >
          Solana Devnet  ·  Powered by Phantom
        </Text>
      </View>
    </View>
  );
}
