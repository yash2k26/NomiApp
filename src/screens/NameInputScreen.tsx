import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePetStore } from '../store/petStore';
import { useWalletStore } from '../store/walletStore';
import { petTypography } from '../theme/typography';

const { height: SCREEN_H } = Dimensions.get('window');

interface NameInputScreenProps {
  onComplete: () => void;
}

export function NameInputScreen({ onComplete }: NameInputScreenProps) {
  const [name, setName] = useState('');
  const setOwnerName = usePetStore((s) => s.setOwnerName);
  const disconnectWallet = useWalletStore((s) => s.disconnectWallet);

  const trimmed = name.trim();
  const isValid = trimmed.length >= 2 && trimmed.length <= 12;

  const handleContinue = () => {
    if (!isValid) return;
    setOwnerName(trimmed);
    onComplete();
  };

  return (
    <View className="flex-1">
      <LinearGradient
        colors={['#5BA3D9', '#6DB4E0', '#7EC2E5', '#6FAFD6']}
        locations={[0, 0.3, 0.65, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Ambient circles */}
      <View
        className="absolute rounded-full bg-white/10"
        style={{ width: 200, height: 200, top: -40, right: -60 }}
      />
      <View
        className="absolute rounded-full bg-white/8"
        style={{ width: 140, height: 140, top: SCREEN_H * 0.55, left: -50 }}
      />

      <TouchableOpacity
        onPress={disconnectWallet}
        activeOpacity={0.7}
        style={{ position: 'absolute', top: 56, left: 20, zIndex: 10 }}
      >
        <View className="flex-row items-center bg-white/15 border border-white/25 px-3 py-1.5 rounded-full">
          <Text className="text-white text-[14px] mr-1">←</Text>
          <Text className="text-white text-[11px] font-bold tracking-[0.4px]">Back</Text>
        </View>
      </TouchableOpacity>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-8">
          {/* Nomi emoji/avatar */}
          <Text className="text-[64px] text-center mb-4">{'\u{1F43E}'}</Text>

          {/* Question */}
          <Text
            className="text-white text-[32px] leading-[36px] text-center"
            style={{ fontFamily: petTypography.display }}
          >
            What should Nomi{'\n'}call you?
          </Text>

          <Text
            className="text-white/70 text-[14px] text-center mt-3 mb-8"
            style={{ fontFamily: petTypography.body }}
          >
            Nomi will remember your name and use it{'\n'}in conversations, diary entries, and more.
          </Text>

          {/* Input */}
          <View
            className="bg-white/20 rounded-2xl border border-white/30 px-5 py-4"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
            }}
          >
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="rgba(255,255,255,0.45)"
              maxLength={12}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              className="text-white text-[20px] text-center"
              style={{ fontFamily: petTypography.heading }}
            />
          </View>

          {trimmed.length > 0 && trimmed.length < 2 && (
            <Text
              className="text-white/60 text-[12px] text-center mt-2"
              style={{ fontFamily: petTypography.body }}
            >
              At least 2 characters
            </Text>
          )}
          {trimmed.length >= 12 && (
            <Text
              className="text-white/60 text-[12px] text-center mt-2"
              style={{ fontFamily: petTypography.body }}
            >
              Keep it short & sweet!
            </Text>
          )}
        </View>

        {/* Bottom CTA */}
        <View className="px-7 pb-10">
          <TouchableOpacity
            onPress={handleContinue}
            disabled={!isValid}
            activeOpacity={0.88}
            className="rounded-[22px] overflow-hidden"
            style={{
              opacity: isValid ? 1 : 0.5,
              shadowColor: '#1A4E6E',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.18,
              shadowRadius: 16,
              elevation: 7,
              borderRadius: 22,
            }}
          >
            <LinearGradient
              colors={['#F8FDFF', '#E8F4FB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="py-[18px] items-center border border-[#CFE8F6]"
              style={{ borderRadius: 22 }}
            >
              <Text
                className="text-[#2E7DA8] text-[16px] tracking-[0.3px]"
                style={{ fontFamily: petTypography.strong }}
              >
                {isValid ? `Hi ${trimmed}! Let's go` : 'Enter your name'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
