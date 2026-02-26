import { useEffect, useRef, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useXpStore, type DailyQuest, type WeeklyQuest } from '../store/xpStore';

const QUEST_ICONS: Record<string, string> = {
  feed: '\u{1F355}',
  play: '\u{1F3AE}',
  rest: '\u{1F634}',
  reflect: '\u{1F9D8}',
  equip: '\u{1F454}',
  allStats: '\u{2B50}',
};

function QuestRow({ quest }: { quest: DailyQuest }) {
  const progress = Math.min(quest.progress / quest.target, 1);
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: progress,
      friction: 8,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [progress, widthAnim]);

  return (
    <View className={`flex-row items-center py-3 px-4 ${quest.completed ? 'opacity-60' : ''}`}>
      {/* Icon */}
      <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${quest.completed ? 'bg-pet-green/20' : 'bg-pet-purple-light/20'}`}>
        <Text className="text-[20px]">
          {quest.completed ? '\u{2705}' : QUEST_ICONS[quest.type] ?? '\u{2B50}'}
        </Text>
      </View>

      {/* Text + Progress */}
      <View className="flex-1 mr-3">
        <Text className={`text-[12px] font-bold ${quest.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
          {quest.description}
        </Text>
        {/* Mini progress bar */}
        <View className="h-[4px] bg-gray-100 rounded-full mt-1.5 overflow-hidden">
          <Animated.View
            style={{
              width: widthAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
              height: '100%',
              borderRadius: 999,
              backgroundColor: quest.completed ? '#88C057' : '#9381FF',
            }}
          />
        </View>
        <Text className="text-[9px] font-semibold text-gray-400 mt-0.5">
          {quest.progress}/{quest.target}
        </Text>
      </View>

      {/* XP Badge */}
      <View className={`px-2.5 py-1 rounded-full ${quest.completed ? 'bg-pet-green/20' : 'bg-pet-gold-light'}`}>
        <Text className={`text-[10px] font-black ${quest.completed ? 'text-pet-green-dark' : 'text-pet-gold-dark'}`}>
          {quest.completed ? 'Done' : `+${quest.xpReward}`}
        </Text>
      </View>
    </View>
  );
}

function useCountdown() {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    function update() {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${hours}h ${minutes}m`);
    }
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  return timeLeft;
}

function WeeklyQuestRow({ quest }: { quest: WeeklyQuest }) {
  const progress = Math.min(quest.progress / quest.target, 1);
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: progress,
      friction: 8,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [progress, widthAnim]);

  return (
    <View className={`flex-row items-center py-3 px-4 ${quest.completed ? 'opacity-60' : ''}`}>
      <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${quest.completed ? 'bg-pet-green/20' : 'bg-pet-orange-light/30'}`}>
        <Text className="text-[20px]">
          {quest.completed ? '\u{2705}' : '\u{1F3C6}'}
        </Text>
      </View>
      <View className="flex-1 mr-3">
        <Text className={`text-[12px] font-bold ${quest.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
          {quest.description}
        </Text>
        <View className="h-[4px] bg-gray-100 rounded-full mt-1.5 overflow-hidden">
          <Animated.View
            style={{
              width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              height: '100%',
              borderRadius: 999,
              backgroundColor: quest.completed ? '#88C057' : '#FF9F43',
            }}
          />
        </View>
        <Text className="text-[9px] font-semibold text-gray-400 mt-0.5">
          {quest.progress}/{quest.target}
        </Text>
      </View>
      <View className={`px-2.5 py-1 rounded-full ${quest.completed ? 'bg-pet-green/20' : 'bg-pet-orange-light/40'}`}>
        <Text className={`text-[10px] font-black ${quest.completed ? 'text-pet-green-dark' : 'text-pet-orange-dark'}`}>
          {quest.completed ? 'Done' : `+${quest.xpReward}`}
        </Text>
      </View>
    </View>
  );
}

export function DailyQuests() {
  const dailyQuests = useXpStore((s) => s.dailyQuests);
  const weeklyQuests = useXpStore((s) => s.weeklyQuests);
  const checkAndRefreshQuests = useXpStore((s) => s.checkAndRefreshQuests);
  const checkAndRefreshWeeklyQuests = useXpStore((s) => s.checkAndRefreshWeeklyQuests);
  const timeLeft = useCountdown();

  useEffect(() => {
    checkAndRefreshQuests();
    checkAndRefreshWeeklyQuests();
  }, [checkAndRefreshQuests, checkAndRefreshWeeklyQuests]);

  if (dailyQuests.length === 0) return null;

  const completedCount = dailyQuests.filter(q => q.completed).length;
  const weeklyCompletedCount = weeklyQuests.filter(q => q.completed).length;

  return (
    <View>
      {/* Daily Quests */}
      <View
        className="mx-6 mt-4 bg-white rounded-[28px] overflow-hidden border border-gray-100"
        style={{
          shadowColor: '#22314A',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 4,
        }}
      >
        <LinearGradient
          colors={['#9381FF', '#A797FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="px-5 py-3 flex-row items-center justify-between"
        >
          <View className="flex-row items-center">
            <Text className="text-[13px] mr-2">{'\u{1F3AF}'}</Text>
            <Text className="text-white text-[12px] font-black uppercase tracking-[0.8px]">
              Daily Quests
            </Text>
            <View className="bg-white/20 px-2 py-0.5 rounded-full ml-2">
              <Text className="text-white text-[10px] font-bold">
                {completedCount}/{dailyQuests.length}
              </Text>
            </View>
          </View>
          <View className="bg-white/15 px-2 py-1 rounded-full">
            <Text className="text-white/90 text-[10px] font-bold">
              resets in {timeLeft}
            </Text>
          </View>
        </LinearGradient>

        {dailyQuests.map((quest, i) => (
          <View key={quest.id}>
            <QuestRow quest={quest} />
            {i < dailyQuests.length - 1 && (
              <View className="h-[1px] bg-gray-100 mx-4" />
            )}
          </View>
        ))}
      </View>

      {/* Weekly Challenges */}
      {weeklyQuests.length > 0 && (
        <View
          className="mx-6 mt-4 bg-white rounded-[28px] overflow-hidden border border-gray-100"
          style={{
            shadowColor: '#22314A',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 4,
          }}
        >
          <LinearGradient
            colors={['#FF9F43', '#FFB76B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="px-5 py-3 flex-row items-center justify-between"
          >
            <View className="flex-row items-center">
              <Text className="text-[13px] mr-2">{'\u{1F3C6}'}</Text>
              <Text className="text-white text-[12px] font-black uppercase tracking-[0.8px]">
                Weekly Challenges
              </Text>
              <View className="bg-white/20 px-2 py-0.5 rounded-full ml-2">
                <Text className="text-white text-[10px] font-bold">
                  {weeklyCompletedCount}/{weeklyQuests.length}
                </Text>
              </View>
            </View>
            <View className="bg-white/15 px-2 py-1 rounded-full">
              <Text className="text-white/90 text-[10px] font-bold">Resets Mon</Text>
            </View>
          </LinearGradient>

          {weeklyQuests.map((quest, i) => (
            <View key={quest.id}>
              <WeeklyQuestRow quest={quest} />
              {i < weeklyQuests.length - 1 && (
                <View className="h-[1px] bg-gray-100 mx-4" />
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
