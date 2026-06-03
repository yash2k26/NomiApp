import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { petTypography } from '../theme/typography';

/*
 * Shown once when a returning user is detected: pet identity restored from
 * on-chain holdings, but local progress (XP/streak/coins) was wiped because
 * it was never backed up. Honest about what happened, apologetic, and
 * delivers a one-time bonus to soften the blow + signals the new backend
 * backup that prevents this from recurring.
 *
 * Eligibility + bonus application happen in App.tsx; this component is
 * purely the UI shell.
 */

interface WelcomeBackModalProps {
  visible: boolean;
  petName: string;
  bonusLevel: number;
  bonusStreak: number;
  bonusCoins: number;
  bonusFreezes: number;
  bonusFreeItems: number;
  onClose: () => void;
}

export function WelcomeBackModal({ visible, petName, bonusLevel, bonusStreak, bonusCoins, bonusFreezes, bonusFreeItems, onClose }: WelcomeBackModalProps) {
  if (!visible) return null;

  const handleClose = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View className="flex-1 bg-black/55 items-center justify-center px-7">
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 30,
            width: '100%',
            paddingHorizontal: 26,
            paddingVertical: 30,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#F3F4F6',
            shadowColor: '#3E8AB3',
            shadowOffset: { width: 0, height: 18 },
            shadowOpacity: 0.22,
            shadowRadius: 26,
            elevation: 16,
          }}
        >
          <View
            style={{
              width: 78,
              height: 78,
              borderRadius: 39,
              backgroundColor: '#EAF6FB',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
              borderWidth: 2,
              borderColor: '#A7D7E6',
            }}
          >
            <Text style={{ fontSize: 38 }}>{'\u{1F44B}'}</Text>
          </View>

          <Text style={{ fontSize: 11, letterSpacing: 1.6, color: '#3E8AB3', fontFamily: petTypography.strong, textTransform: 'uppercase', marginBottom: 6 }}>
            Welcome back
          </Text>

          <Text style={{ fontSize: 22, color: '#1F2937', fontFamily: petTypography.display, marginBottom: 8, textAlign: 'center' }}>
            {petName} is here
          </Text>

          <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', fontFamily: petTypography.body, lineHeight: 19, marginBottom: 18, paddingHorizontal: 4 }}>
            We found your Nomi NFT on-chain. Your items and premium tier are restored.
            Your XP, streak and coins weren't backed up before — so we've used your on-chain
            history (mint date, purchases, premium tier) to estimate where you should be
            and topped you up. Sorry for the loss; cloud backup is on now so it can't recur.
          </Text>

          <View
            style={{
              width: '100%',
              backgroundColor: '#F9FAFB',
              borderRadius: 18,
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: '#F3F4F6',
              marginBottom: 14,
            }}
          >
            <Text style={{ fontSize: 10, letterSpacing: 1, color: '#9CA3AF', fontFamily: petTypography.strong, textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
              Restored from your on-chain footprint
            </Text>
            {bonusLevel > 1 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 4 }}>
                <Text style={{ fontSize: 13, color: '#374151', fontFamily: petTypography.body }}>
                  {'\u{1F4C8}'}  Level {bonusLevel}
                </Text>
                <Text style={{ fontSize: 11, color: '#9CA3AF', fontFamily: petTypography.body }}>granted</Text>
              </View>
            )}
            {bonusStreak > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 4 }}>
                <Text style={{ fontSize: 13, color: '#374151', fontFamily: petTypography.body }}>
                  {'\u{1F525}'}  {bonusStreak}-day streak
                </Text>
                <Text style={{ fontSize: 11, color: '#9CA3AF', fontFamily: petTypography.body }}>restored</Text>
              </View>
            )}
            {bonusCoins > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 4 }}>
                <Text style={{ fontSize: 13, color: '#374151', fontFamily: petTypography.body }}>
                  {'\u{1FA99}'}  {bonusCoins.toLocaleString()} Nomi coins
                </Text>
                <Text style={{ fontSize: 11, color: '#9CA3AF', fontFamily: petTypography.body }}>added</Text>
              </View>
            )}
            {bonusFreezes > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 4 }}>
                <Text style={{ fontSize: 13, color: '#374151', fontFamily: petTypography.body }}>
                  {'❄️'}  {bonusFreezes} streak freezes
                </Text>
                <Text style={{ fontSize: 11, color: '#9CA3AF', fontFamily: petTypography.body }}>added</Text>
              </View>
            )}
            {bonusFreeItems > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 4 }}>
                <Text style={{ fontSize: 13, color: '#374151', fontFamily: petTypography.body }}>
                  {'\u{1F381}'}  {bonusFreeItems} free shop item{bonusFreeItems === 1 ? '' : 's'}
                </Text>
                <Text style={{ fontSize: 11, color: '#9CA3AF', fontFamily: petTypography.body }}>added</Text>
              </View>
            )}
          </View>

          <View
            style={{
              width: '100%',
              backgroundColor: '#ECFDF5',
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 11,
              borderWidth: 1,
              borderColor: '#A7F3D0',
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 22,
            }}
          >
            <Text style={{ fontSize: 16, marginRight: 10 }}>{'\u{1F510}'}</Text>
            <Text style={{ fontSize: 11, color: '#065F46', fontFamily: petTypography.body, flex: 1, lineHeight: 16 }}>
              We've added cloud backup. Your progress now survives reinstalls and wallet reconnects automatically.
            </Text>
          </View>

          <TouchableOpacity onPress={handleClose} activeOpacity={0.85} style={{ width: '100%' }}>
            <LinearGradient
              colors={['#4FABC9', '#3E8AB3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontFamily: petTypography.strong, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                Let's go
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
