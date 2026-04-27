import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAdventureStore } from '../store/adventureStore';
import { usePetStore } from '../store/petStore';
import { playSfx } from '../lib/soundManager';

export function LoginCalendar({ onClaimed }: { onClaimed?: () => void } = {}) {
  const { loginCalendar, currentLoginDay, lastLoginClaimDate, claimLoginReward, checkLoginCalendarReset } = useAdventureStore();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const today = new Date().toISOString().slice(0, 10);
  const canClaim = lastLoginClaimDate !== today && currentLoginDay < 7;
  const nextDay = currentLoginDay + 1;

  useEffect(() => {
    checkLoginCalendarReset();
  }, [checkLoginCalendarReset]);

  // Pulse animation for claimable day
  useEffect(() => {
    if (!canClaim) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [canClaim, pulseAnim]);

  const handleClaim = () => {
    const reward = claimLoginReward();
    if (reward) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playSfx('reward').catch(() => {});
      onClaimed?.();
    }
  };

  return (
    <View className="px-6 mt-4">
      <View
        className="bg-white overflow-hidden border border-gray-100"
        style={{ borderRadius: 18, shadowColor: '#FFD700', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 4 }}
      >
        <LinearGradient
          colors={['#FFD700', '#FFC107']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="px-5 py-3 flex-row items-center justify-between"
          style={{ borderTopLeftRadius: 18, borderTopRightRadius: 18 }}
        >
          <View className="flex-row items-center">
            <Text className="text-base mr-2">{'\u{1F4C5}'}</Text>
            <Text className="text-[12px] font-black text-white tracking-[0.8px] uppercase">Daily Login</Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <View className="bg-white/30 px-2.5 py-1 rounded-full flex-row items-center">
              <Text className="text-[10px] mr-1">❄️</Text>
              <Text className="text-[10px] font-bold text-white">{usePetStore((s) => s.streakFreezes)}</Text>
            </View>
            <View className="bg-white/30 px-2.5 py-1 rounded-full">
              <Text className="text-[10px] font-bold text-white">Day {currentLoginDay}/7</Text>
            </View>
          </View>
        </LinearGradient>

        <View className="p-4">
          {/* 7-day strip */}
          <View className="flex-row justify-between mb-3">
            {loginCalendar.map((day, i) => {
              const isCurrent = i + 1 === nextDay && canClaim;
              const isPast = day.claimed;
              const isFuture = i + 1 > nextDay;

              return (
                <Animated.View
                  key={day.day}
                  style={isCurrent ? { transform: [{ scale: pulseAnim }] } : undefined}
                >
                  <View
                    className={`w-10 h-14 rounded-xl items-center justify-center border ${
                      isPast ? 'bg-pet-gold-light/50 border-pet-gold' :
                      isCurrent ? 'bg-pet-gold/20 border-pet-gold' :
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <Text className={`text-[10px] font-bold ${isPast ? 'text-pet-gold-dark' : isCurrent ? 'text-pet-gold-dark' : 'text-gray-400'}`}>
                      D{day.day}
                    </Text>
                    {isPast ? (
                      <Text className="text-[14px]">{'\u2705'}</Text>
                    ) : (
                      <Text className={`text-[10px] font-black ${isCurrent ? 'text-pet-gold-dark' : 'text-gray-300'}`}>
                        {day.xpReward}
                      </Text>
                    )}
                  </View>
                </Animated.View>
              );
            })}
          </View>

          {/* Claim button or status */}
          {canClaim ? (
            <TouchableOpacity onPress={handleClaim} activeOpacity={0.85}>
              <LinearGradient colors={['#FFD700', '#CCA800']} className="py-3 items-center flex-row justify-center" style={{ borderRadius: 16 }}>
                <Text className="text-white font-black text-[13px] uppercase tracking-[0.8px] mr-2">
                  Claim Day {nextDay}
                </Text>
                <Text className="text-white font-bold text-[12px]">
                  +{loginCalendar[nextDay - 1]?.xpReward ?? 0} XP
                </Text>
                {loginCalendar[nextDay - 1]?.bonusLabel ? (
                  <Text className="text-white/80 font-semibold text-[10px] ml-2">
                    + {loginCalendar[nextDay - 1].bonusLabel}
                  </Text>
                ) : null}
              </LinearGradient>
            </TouchableOpacity>
          ) : currentLoginDay >= 7 ? (
            <View className="bg-pet-gold-light/30 py-2.5 items-center" style={{ borderRadius: 16 }}>
              <Text className="text-pet-gold-dark font-black text-[12px]">{'\u{1F389}'} Week Complete! Resets tomorrow</Text>
            </View>
          ) : (
            <View className="bg-gray-50 py-2.5 items-center" style={{ borderRadius: 16 }}>
              <Text className="text-gray-400 font-bold text-[12px]">{'\u2705'} Claimed today — come back tomorrow!</Text>
            </View>
          )}

          {/* Miss warning */}
          {canClaim && currentLoginDay > 0 && (
            <Text className="text-[9px] text-pet-pink-dark font-semibold text-center mt-2">
              {'\u26A0\uFE0F'} Missing a day resets your streak!
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
