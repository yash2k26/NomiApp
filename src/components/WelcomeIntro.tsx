import { View, Text, TouchableOpacity, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { petTypography } from '../theme/typography';

const HANGING_IMG = require('../../assets/Photos/hanging.png');
const HEADPHONE_GUY_IMG = require('../../assets/Photos/headphoneguy.png');

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface WelcomeIntroProps {
  onContinue: () => void;
}

export function WelcomeIntro({ onContinue }: WelcomeIntroProps) {
  return (
    <View className="flex-1">
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
        <View className="self-start mb-3 px-3 py-1.5 rounded-full bg-white/25 border border-white/35">
          <Text
            className="text-white text-[10px] uppercase tracking-[1px]"
            style={{ fontFamily: petTypography.strong }}
          >
            Meet Your Companion
          </Text>
        </View>
        <Text
          className="text-white text-[42px] leading-[44px]"
          style={{ fontFamily: petTypography.display }}
        >
          Welcome to{'\n'}Nomi
        </Text>
        <Text
          className="text-white/90 text-[15px] leading-[22px] mt-2"
          style={{ fontFamily: petTypography.body }}
        >
          A gentle digital friend for your daily rhythm.
          {'\n'}
          Care, play, and grow together.
        </Text>
      </View>

      {/* ─── Bottom CTA ─── */}
      <View className="absolute left-0 right-0 px-7" style={{ bottom: 30 }}>
        <TouchableOpacity onPress={onContinue} activeOpacity={0.85}>
          <View
            className="rounded-[28px] py-[18px] items-center bg-white"
            style={{
              shadowColor: '#1A4E6E',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.2,
              shadowRadius: 20,
              elevation: 8,
            }}
          >
            <Text
              className="text-[#3A8BB5] text-[16px] uppercase tracking-[1px]"
              style={{ fontFamily: petTypography.strong }}
            >
              Continue
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}
