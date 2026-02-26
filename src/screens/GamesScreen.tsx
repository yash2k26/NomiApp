import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { usePetStore, STAMINA_COSTS } from '../store/petStore';
import { useXpStore } from '../store/xpStore';
import { useAdventureStore } from '../store/adventureStore';
import { MemoryMatch } from '../components/games/MemoryMatch';
import { QuickTap } from '../components/games/QuickTap';
import { PatternRecall } from '../components/games/PatternRecall';
import { DailyQuests } from '../components/DailyQuests';
import { AdventureCard } from '../components/AdventureCard';
import { SpinWheel } from '../components/SpinWheel';
import { ScreenHeader } from '../components/ui/ScreenHeader';

type ActiveGame = 'memory' | 'quicktap' | 'pattern' | null;

interface GameCardProps {
  title: string;
  emoji: string;
  description: string;
  xpRange: string;
  staminaCost: number;
  locked: boolean;
  lockLevel: number;
  onCooldown: boolean;
  cooldownText: string;
  canAfford: boolean;
  highScore: number;
  onPlay: () => void;
}

function GameCard({ title, emoji, description, xpRange, staminaCost, locked, lockLevel, onCooldown, cooldownText, canAfford, highScore, onPlay }: GameCardProps) {
  const disabled = locked || onCooldown || !canAfford;

  return (
    <View
      className={`bg-white rounded-[24px] p-5 mb-4 border ${locked ? 'border-gray-200' : 'border-gray-100'}`}
      style={!locked ? { shadowColor: '#1A2A40', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 } : undefined}
    >
      <View className="flex-row items-center">
        <View className={`w-14 h-14 rounded-2xl items-center justify-center mr-4 ${locked ? 'bg-gray-100' : 'bg-pet-purple-light/20'}`}>
          <Text className="text-[28px]">{locked ? '\u{1F512}' : emoji}</Text>
        </View>
        <View className="flex-1">
          <Text className={`text-[16px] font-black ${locked ? 'text-gray-400' : 'text-gray-800'}`}>{title}</Text>
          <Text className={`text-[11px] ${locked ? 'text-gray-300' : 'text-gray-500'}`}>
            {locked ? `Unlocks at Level ${lockLevel}` : description}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between mt-3">
        <View className="flex-row items-center space-x-3">
          <View className="bg-pet-purple-light/20 px-2.5 py-1 rounded-full">
            <Text className="text-[10px] font-bold text-pet-purple-dark">{xpRange} XP</Text>
          </View>
          <View className="bg-gray-100 px-2.5 py-1 rounded-full">
            <Text className="text-[10px] font-bold text-gray-500">{'\u{1F50B}'} {staminaCost}</Text>
          </View>
          {highScore > 0 && (
            <View className="bg-pet-gold-light/30 px-2.5 py-1 rounded-full">
              <Text className="text-[10px] font-bold text-pet-gold-dark">{'\u{1F3C6}'} {highScore}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity onPress={onPlay} disabled={disabled} activeOpacity={0.85}>
          <LinearGradient
            colors={disabled ? ['#D1D5DB', '#9CA3AF'] : ['#9381FF', '#766BD1']}
            className="px-5 py-2 rounded-xl"
          >
            <Text className="text-white font-black text-[11px] uppercase">
              {locked ? 'Locked' : onCooldown ? cooldownText : !canAfford ? 'No Stamina' : 'Play'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function formatCooldown(ms: number): string {
  const min = Math.ceil(ms / 60000);
  return `${min}m`;
}

export function GamesScreen() {
  const [activeGame, setActiveGame] = useState<ActiveGame>(null);
  const level = useXpStore((s) => s.level);
  const { getStamina, consumeStamina, isOnCooldown, getCooldownRemaining, startCooldown } = usePetStore();
  const { reportMiniGameScore, highScores } = useAdventureStore();
  const [, setTick] = useState(0);

  // Re-render every second for cooldowns
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleGameComplete = (gameId: string, cooldownKey: string) => (score: number, xp: number) => {
    consumeStamina(STAMINA_COSTS.miniGame);
    startCooldown(cooldownKey);
    reportMiniGameScore(gameId, score, xp);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setActiveGame(null);
  };

  const canAfford = getStamina() >= STAMINA_COSTS.miniGame;

  // Render active game
  if (activeGame === 'memory') {
    return (
      <MemoryMatch
        onComplete={handleGameComplete('memory', 'miniGame_memory')}
        onCancel={() => setActiveGame(null)}
      />
    );
  }
  if (activeGame === 'quicktap') {
    return (
      <QuickTap
        onComplete={handleGameComplete('quicktap', 'miniGame_quicktap')}
        onCancel={() => setActiveGame(null)}
      />
    );
  }
  if (activeGame === 'pattern') {
    return (
      <PatternRecall
        onComplete={handleGameComplete('pattern', 'miniGame_pattern')}
        onCancel={() => setActiveGame(null)}
      />
    );
  }

  // Game hub
  return (
    <View className="flex-1 bg-pet-background">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View className="pt-5 px-6 mb-4">
          <ScreenHeader
            eyebrow="Play Zone"
            title="Activities"
            subtitle="Quests, adventures, and mini-games."
            compact
            rightSlot={(
              <View className="bg-white/20 px-3 py-1.5 rounded-full border border-white/35">
                <Text className="text-[10px] font-black text-white">{'\u{1F50B}'} {Math.floor(getStamina())}/100</Text>
              </View>
            )}
          />
        </View>

        {/* Daily & Weekly Quests */}
        <DailyQuests />

        {/* Adventures */}
        <AdventureCard />

        {/* Lucky Spin Wheel */}
        <SpinWheel />

        {/* Mini-Games Section */}
        <View className="px-6 mt-4 mb-3 flex-row items-center">
          <Text className="text-[13px] mr-2">{'\u{1F3AE}'}</Text>
          <Text className="text-[17px] font-black text-gray-800">Mini-Games</Text>
        </View>

        <View className="px-6">
        <GameCard
          title="Memory Match"
          emoji={'\u{1F0CF}'}
          description="Flip cards and match pairs before time runs out!"
          xpRange="20-50"
          staminaCost={STAMINA_COSTS.miniGame}
          locked={false}
          lockLevel={1}
          onCooldown={isOnCooldown('miniGame_memory')}
          cooldownText={formatCooldown(getCooldownRemaining('miniGame_memory'))}
          canAfford={canAfford}
          highScore={highScores.memory ?? 0}
          onPlay={() => setActiveGame('memory')}
        />

        <GameCard
          title="Quick Tap"
          emoji={'\u{1F436}'}
          description="Tap Nomi as fast as you can! Avoid the bombs!"
          xpRange="15-60"
          staminaCost={STAMINA_COSTS.miniGame}
          locked={level < 3}
          lockLevel={3}
          onCooldown={isOnCooldown('miniGame_quicktap')}
          cooldownText={formatCooldown(getCooldownRemaining('miniGame_quicktap'))}
          canAfford={canAfford}
          highScore={highScores.quicktap ?? 0}
          onPlay={() => setActiveGame('quicktap')}
        />

        <GameCard
          title="Pattern Recall"
          emoji={'\u{1F9E0}'}
          description="Remember and repeat the color sequence!"
          xpRange="10-80"
          staminaCost={STAMINA_COSTS.miniGame + 5}
          locked={level < 7}
          lockLevel={7}
          onCooldown={isOnCooldown('miniGame_pattern')}
          cooldownText={formatCooldown(getCooldownRemaining('miniGame_pattern'))}
          canAfford={getStamina() >= STAMINA_COSTS.miniGame + 5}
          highScore={highScores.pattern ?? 0}
          onPlay={() => setActiveGame('pattern')}
        />

        </View>

        {/* Stats section */}
        <View className="mx-6 bg-white rounded-[24px] p-5 border border-gray-100 mt-2">
          <Text className="text-[14px] font-black text-gray-800 mb-3">Game Stats</Text>
          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className="text-[20px] font-black text-pet-purple">{useAdventureStore.getState().miniGamesWon}</Text>
              <Text className="text-[10px] font-bold text-gray-400 uppercase">Games Won</Text>
            </View>
            <View className="items-center">
              <Text className="text-[20px] font-black text-pet-gold-dark">{useAdventureStore.getState().miniGameXpEarned}</Text>
              <Text className="text-[10px] font-bold text-gray-400 uppercase">XP Earned</Text>
            </View>
            <View className="items-center">
              <Text className="text-[20px] font-black text-pet-orange-dark">
                {Math.max(highScores.memory ?? 0, highScores.quicktap ?? 0, highScores.pattern ?? 0)}
              </Text>
              <Text className="text-[10px] font-bold text-gray-400 uppercase">Best Score</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
