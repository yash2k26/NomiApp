import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { usePetStore } from '../store/petStore';
import { useAdventureStore } from '../store/adventureStore';
import { useWalletStore } from '../store/walletStore';
import { petTypography } from '../theme/typography';

/*
 * Inventory strip — surfaces everything the user has earned/owns that doesn't
 * already have a home elsewhere on Home: Nomi coins, streak freezes,
 * evolution shards, free-item tokens, and the active 2x-XP buff with a live
 * countdown. Card chrome matches XpBar so the two read as a single status
 * panel. Each stat renders only when its value > 0; the whole card collapses
 * if the user has nothing yet.
 */

interface Stat {
  key: string;
  emoji: string;
  value: string;
  label: string;
  accent?: string; // optional value color override; defaults to pet-blue-dark
}

function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return '0:00';
  const totalSeconds = Math.floor(msRemaining / 1000);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function ResourcesBar() {
  const appCoins = useWalletStore((s) => s.appCoins);
  const streakFreezes = usePetStore((s) => s.streakFreezes);
  const evolutionShards = useAdventureStore((s) => s.evolutionShards);
  const freeItemTokens = useAdventureStore((s) => s.freeItemTokens);
  const doubleXpUntil = useAdventureStore((s) => s.doubleXpUntil);

  const [now, setNow] = useState(Date.now());
  const buffActive = doubleXpUntil > now;
  useEffect(() => {
    if (!buffActive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [buffActive]);

  const stats: Stat[] = [];

  if (appCoins > 0) {
    stats.push({
      key: 'coins',
      emoji: '\u{1FA99}',
      value: `${Math.floor(appCoins)}`,
      label: 'Coins',
    });
  }
  if (streakFreezes > 0) {
    stats.push({
      key: 'freezes',
      emoji: '❄️',
      value: `${streakFreezes}`,
      label: streakFreezes === 1 ? 'Freeze' : 'Freezes',
    });
  }
  if (evolutionShards > 0) {
    stats.push({
      key: 'shards',
      emoji: '\u{1F48E}',
      value: `${evolutionShards}`,
      label: evolutionShards === 1 ? 'Shard' : 'Shards',
    });
  }
  if (freeItemTokens > 0) {
    stats.push({
      key: 'tokens',
      emoji: '\u{1F381}',
      value: `${freeItemTokens}`,
      label: freeItemTokens === 1 ? 'Free Item' : 'Free Items',
    });
  }
  if (buffActive) {
    stats.push({
      key: 'xp2x',
      emoji: '✨',
      value: formatCountdown(doubleXpUntil - now),
      label: '2× XP',
      accent: '#047857', // emerald — only spot of color, signals "active buff"
    });
  }

  if (stats.length === 0) return null;

  return (
    <View className="px-6 mt-3">
      <View
        className="bg-white rounded-[22px] border border-pet-blue-light/75"
        style={{
          shadowColor: '#2E6E93',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 10,
          elevation: 3,
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
        }}
      >
        {stats.map((stat, idx) => (
          <View
            key={stat.key}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 8,
              borderRightWidth: idx < stats.length - 1 ? 1 : 0,
              borderRightColor: 'rgba(167, 215, 230, 0.35)',
            }}
          >
            <Text style={{ fontSize: 14, marginRight: 6 }}>{stat.emoji}</Text>
            <View style={{ alignItems: 'flex-start' }}>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: petTypography.strong,
                  color: stat.accent ?? '#2E6E93',
                  lineHeight: 16,
                }}
              >
                {stat.value}
              </Text>
              <Text
                style={{
                  fontSize: 9,
                  fontFamily: petTypography.body,
                  color: '#9CA3AF',
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  lineHeight: 11,
                  marginTop: 1,
                }}
              >
                {stat.label}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
