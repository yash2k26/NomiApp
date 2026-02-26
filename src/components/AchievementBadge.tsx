import { View, Text } from 'react-native';
import type { Achievement } from '../store/xpStore';

export function AchievementBadge({ achievement }: { achievement: Achievement }) {
  const unlocked = achievement.unlocked;

  return (
    <View
      className={`items-center p-3 rounded-2xl border ${
        unlocked ? 'bg-white border-pet-purple-light/40' : 'bg-gray-50 border-gray-100'
      }`}
      style={{
        shadowColor: unlocked ? '#9381FF' : '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: unlocked ? 0.15 : 0.03,
        shadowRadius: 6,
        elevation: unlocked ? 3 : 1,
      }}
    >
      <View className={`w-11 h-11 rounded-xl items-center justify-center mb-1.5 ${
        unlocked ? 'bg-pet-purple-light/20' : 'bg-gray-100'
      }`}>
        <Text className={`text-[22px] ${!unlocked ? 'opacity-30' : ''}`}>
          {unlocked ? achievement.icon : '\u{1F512}'}
        </Text>
      </View>
      <Text className={`text-[9px] font-black text-center uppercase ${
        unlocked ? 'text-gray-700' : 'text-gray-300'
      }`} numberOfLines={1}>
        {achievement.title}
      </Text>
    </View>
  );
}
