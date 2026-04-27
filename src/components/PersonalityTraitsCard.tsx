/**
 * Personality Traits — surfaces the trait values that the personality system
 * silently tracks (playful, foodie, sleepy, adventurous, social).
 *
 * Each trait at 70+ unlocks a small perk. Reading the trait state is purely
 * cosmetic for now; perks are checked elsewhere via getActiveTraitPerks().
 */
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePersonalityStore } from '../store/personalityStore';
import { petTypography } from '../theme/typography';

const TRAITS = [
  { key: 'playful',     label: 'Playful',     emoji: '🎉', color: '#F08C84', perk: 'Play stat bonus +2' },
  { key: 'foodie',      label: 'Foodie',      emoji: '🍔', color: '#F2B266', perk: 'Feed cooldown −10%' },
  { key: 'sleepy',      label: 'Sleepy',      emoji: '💤', color: '#7DB3DB', perk: 'Rest gives +5 energy' },
  { key: 'adventurous', label: 'Adventurous', emoji: '🗺️', color: '#88C997', perk: 'Adventure XP +10%' },
  { key: 'social',      label: 'Social',      emoji: '💬', color: '#C698E0', perk: 'Reflection XP +15%' },
] as const;

const PERK_THRESHOLD = 70;

export function PersonalityTraitsCard() {
  const traits = usePersonalityStore((s) => s.traits);

  return (
    <View
      className="bg-white rounded-[24px] overflow-hidden border border-pet-blue-light/40 mx-6"
      style={{ shadowColor: '#22314A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 4 }}
    >
      <LinearGradient
        colors={['#A78BFA', '#7C7DFA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="px-5 py-3 flex-row items-center justify-between"
      >
        <View className="flex-row items-center">
          <Text className="text-base mr-2">🎭</Text>
          <Text className="text-[12px] font-black text-white tracking-[0.8px] uppercase" style={{ fontFamily: petTypography.heading }}>
            Personality
          </Text>
        </View>
        <View className="bg-white/30 px-2.5 py-1 rounded-full">
          <Text className="text-[10px] font-bold text-white">Hit {PERK_THRESHOLD}+ for perks</Text>
        </View>
      </LinearGradient>

      <View className="p-4" style={{ gap: 12 }}>
        {TRAITS.map((t) => {
          const value = traits[t.key as keyof typeof traits] ?? 0;
          const unlocked = value >= PERK_THRESHOLD;
          return (
            <View key={t.key}>
              <View className="flex-row items-center justify-between mb-1">
                <View className="flex-row items-center">
                  <Text className="text-[13px] mr-1.5">{t.emoji}</Text>
                  <Text className="text-[12px] font-black text-gray-700 tracking-[0.5px] uppercase" style={{ fontFamily: petTypography.heading }}>
                    {t.label}
                  </Text>
                  {unlocked && (
                    <View className="ml-2 bg-emerald-500 px-1.5 py-0.5 rounded-full">
                      <Text className="text-[8px] font-black text-white">PERK</Text>
                    </View>
                  )}
                </View>
                <Text className={`text-[11px] font-black ${unlocked ? 'text-emerald-600' : 'text-gray-500'}`}>
                  {Math.round(value)}/100
                </Text>
              </View>
              <View className="h-2.5 rounded-full overflow-hidden bg-gray-100">
                <View
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: t.color }}
                />
              </View>
              {unlocked && (
                <Text className="text-[10px] text-emerald-600 font-semibold mt-1">
                  ✓ {t.perk}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
