/**
 * Referral card — shows the user's invite code (their wallet address shortform),
 * lets them share it via the native share sheet, and lets them redeem a friend's
 * code for a one-time SKR bonus.
 *
 * NOTE: redemption is currently locally trusted (no on-chain verification).
 * For a production version, the backend / a Solana program would verify both
 * wallets and credit both sides. Hackathon scope = local + share UX is enough
 * to validate the loop.
 */
import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Share, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useWalletStore } from '../store/walletStore';
import { usePetStore } from '../store/petStore';
import { petTypography } from '../theme/typography';

const REFERRAL_BONUS_SKR = 25;

export function ReferralCard() {
  const address = useWalletStore((s) => s.address);
  const addSkr = useWalletStore((s) => s.addSkr);
  const referralRedeemed = usePetStore((s) => s.referralRedeemed);
  const [code, setCode] = useState('');
  const [showInput, setShowInput] = useState(false);

  const myCode = address ? `${address.slice(0, 6)}-${address.slice(-4)}` : '—';
  const myFullCode = address || '';

  const handleShare = async () => {
    if (!myFullCode) return;
    try {
      await Share.share({
        message: `Hey! I'm playing Nomi 🐾 — pick up your own companion on Solana. Use my referral code to get a bonus: ${myCode}\n\noraclepet://?ref=${myFullCode}`,
      });
      Haptics.selectionAsync();
    } catch {}
  };

  const handleRedeem = () => {
    if (referralRedeemed) {
      Alert.alert('Already Redeemed', 'You can only redeem one referral code.');
      return;
    }
    const trimmed = code.trim();
    if (trimmed.length < 8) {
      Alert.alert('Invalid Code', 'Paste your friend\'s referral code.');
      return;
    }
    if (trimmed.toLowerCase() === myFullCode.toLowerCase() || trimmed.toLowerCase() === myCode.toLowerCase()) {
      Alert.alert('Nope', 'You can\'t redeem your own code.');
      return;
    }
    // Local trust — bump SKR and lock further redemption
    addSkr(REFERRAL_BONUS_SKR);
    usePetStore.setState({ referralRedeemed: true });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCode('');
    setShowInput(false);
    Alert.alert('Bonus Unlocked!', `+${REFERRAL_BONUS_SKR} SKR added to your wallet. Your friend will get a bonus too on their next mint.`);
  };

  return (
    <View
      className="bg-white rounded-[24px] overflow-hidden border border-pet-blue-light/40 mx-6"
      style={{ shadowColor: '#22314A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 4 }}
    >
      <LinearGradient
        colors={['#FFB347', '#FF7E5F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="px-5 py-3 flex-row items-center justify-between"
      >
        <View className="flex-row items-center">
          <Text className="text-base mr-2">🎁</Text>
          <Text className="text-[12px] font-black text-white tracking-[0.8px] uppercase" style={{ fontFamily: petTypography.heading }}>
            Invite Friends
          </Text>
        </View>
        <View className="bg-white/30 px-2.5 py-1 rounded-full">
          <Text className="text-[10px] font-bold text-white">+{REFERRAL_BONUS_SKR} SKR each</Text>
        </View>
      </LinearGradient>

      <View className="p-4">
        <Text className="text-[11px] text-gray-500 font-semibold mb-1.5">Your Referral Code</Text>
        <View className="bg-pet-blue-light/20 border border-pet-blue-light/40 px-4 py-3 rounded-2xl flex-row items-center justify-between mb-3">
          <Text className="text-[14px] font-black text-pet-blue-dark tracking-[1px]" style={{ fontFamily: petTypography.heading }}>
            {myCode}
          </Text>
          <TouchableOpacity onPress={handleShare} activeOpacity={0.8} disabled={!myFullCode}>
            <View className={`px-3.5 py-1.5 rounded-full ${myFullCode ? 'bg-pet-blue-dark' : 'bg-gray-300'}`}>
              <Text className="text-[11px] font-black text-white">SHARE</Text>
            </View>
          </TouchableOpacity>
        </View>

        {!referralRedeemed ? (
          showInput ? (
            <View>
              <Text className="text-[11px] text-gray-500 font-semibold mb-1.5">Enter Friend's Code</Text>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <View className="flex-1 bg-white border border-gray-200 rounded-2xl px-4 py-2.5">
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    placeholder="paste code"
                    placeholderTextColor="#aaa"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="text-[13px] font-semibold text-gray-700"
                  />
                </View>
                <TouchableOpacity onPress={handleRedeem} activeOpacity={0.8}>
                  <View className="bg-pet-blue-dark px-4 py-2.5 rounded-2xl">
                    <Text className="text-[11px] font-black text-white">REDEEM</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setShowInput(true)} activeOpacity={0.7}>
              <Text className="text-[12px] text-pet-blue-dark font-semibold underline text-center">
                Got a friend's code? Tap to redeem
              </Text>
            </TouchableOpacity>
          )
        ) : (
          <Text className="text-[11px] text-emerald-600 font-bold text-center">
            ✓ Referral bonus redeemed
          </Text>
        )}
      </View>
    </View>
  );
}
