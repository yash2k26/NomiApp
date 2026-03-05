import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { petTypography } from '../theme/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ONBOARDING_KEY = 'oracle-pet-onboarding-seen';

interface Step {
  emoji: string;
  title: string;
  desc: string;
}

const STEPS: Step[] = [
  { emoji: '\u{1F43E}', title: 'Meet Your Pet', desc: 'Feed, play, and rest to keep Nomi happy. Watch mood and stats change in real-time.' },
  { emoji: '\u{1F3AE}', title: 'Games & Adventures', desc: 'Play mini-games, send Nomi on adventures, and earn loot with real on-chain rewards.' },
  { emoji: '\u{1F6CD}\uFE0F', title: 'Shop & Customize', desc: 'Buy skins and animations with SOL or SKR tokens. All purchases are on-chain.' },
  { emoji: '\u26D3\uFE0F', title: 'Powered by Solana', desc: 'Real NFT minting, wallet integration via Mobile Wallet Adapter, and SKR token economy.' },
];

export function OnboardingOverlay({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goNext = () => {
    if (step >= STEPS.length - 1) {
      AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => {});
      onDone();
      return;
    }
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setStep((s) => s + 1);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const skip = () => {
    AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => {});
    onDone();
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <View className="absolute inset-0 z-[60]" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <View className="flex-1 justify-center px-8">
        <Animated.View style={{ opacity: fadeAnim }}>
          <View
            className="bg-white rounded-[32px] overflow-hidden"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.25,
              shadowRadius: 20,
              elevation: 16,
            }}
          >
            <LinearGradient
              colors={['#4FB0C6', '#6BC6D9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="items-center pt-10 pb-6"
            >
              <Text className="text-6xl mb-3">{current.emoji}</Text>
              <Text
                className="text-white text-xl font-black tracking-wide"
                style={{ fontFamily: petTypography.display }}
              >
                {current.title}
              </Text>
            </LinearGradient>

            <View className="px-7 py-6">
              <Text
                className="text-gray-600 text-[15px] leading-[22px] text-center"
                style={{ fontFamily: petTypography.body }}
              >
                {current.desc}
              </Text>

              {/* Step dots */}
              <View className="flex-row justify-center mt-5 mb-4">
                {STEPS.map((_, i) => (
                  <View
                    key={i}
                    className={`mx-1 rounded-full ${i === step ? 'bg-pet-blue' : 'bg-gray-200'}`}
                    style={{ width: i === step ? 24 : 8, height: 8 }}
                  />
                ))}
              </View>

              <TouchableOpacity onPress={goNext} activeOpacity={0.85}>
                <LinearGradient
                  colors={['#4FB0C6', '#3A9BB0']}
                  className="rounded-2xl py-4 items-center"
                >
                  <Text className="text-white text-[15px] font-black tracking-wide">
                    {isLast ? "Let's Go!" : 'Next'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {!isLast && (
                <TouchableOpacity onPress={skip} activeOpacity={0.7} className="mt-3 items-center">
                  <Text className="text-gray-400 text-[13px] font-semibold">Skip</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

export async function shouldShowOnboarding(): Promise<boolean> {
  try {
    const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
    return seen !== 'true';
  } catch {
    return true;
  }
}
