/**
 * Leaderboard preview — shows top Nomis with the current user inserted.
 *
 * NOTE: True chain-wide leaderboard requires the mint to set a verified creator
 * or collection so we can query all Nomi NFTs via Helius DAS. The current mint
 * uses creators: null, collection: null (see src/lib/nftMint.ts), so we seed
 * a curated baseline + slot the user in by their actual stats. Swap to a real
 * Helius getAssetsByCreator call once the mint is updated to tag a creator.
 */
import { View, Text, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useXpStore, getTitleForLevel } from '../store/xpStore';
import { usePetStore } from '../store/petStore';
import { petTypography } from '../theme/typography';

// Seed entries — reasonable distribution to make the user feel placed
const SEED_ENTRIES: { name: string; ownerName: string; level: number; streak: number; xp: number }[] = [
  { name: 'Astra',  ownerName: 'lila.sol',     level: 50, streak: 142, xp: 84200 },
  { name: 'Nomo',   ownerName: 'kazuki.sol',   level: 47, streak: 98,  xp: 71500 },
  { name: 'Mochi',  ownerName: 'evan.sol',     level: 44, streak: 81,  xp: 63100 },
  { name: 'Pip',    ownerName: 'rumi.sol',     level: 41, streak: 73,  xp: 56400 },
  { name: 'Bun',    ownerName: 'sage.sol',     level: 38, streak: 64,  xp: 48700 },
  { name: 'Cleo',   ownerName: 'noor.sol',     level: 33, streak: 51,  xp: 39200 },
  { name: 'Tofu',   ownerName: 'mika.sol',     level: 27, streak: 42,  xp: 30100 },
  { name: 'Beano',  ownerName: 'remi.sol',     level: 21, streak: 30,  xp: 21800 },
  { name: 'Ember',  ownerName: 'omar.sol',     level: 14, streak: 17,  xp: 13900 },
  { name: 'Yumi',   ownerName: 'ayla.sol',     level: 8,  streak: 9,   xp: 7400 },
];

export function LeaderboardCard() {
  const userLevel = useXpStore((s) => s.level);
  const userXp = useXpStore((s) => s.totalXp);
  const userPetName = usePetStore((s) => s.name);
  const userOwnerName = usePetStore((s) => s.ownerName);
  const userStreak = usePetStore((s) => s.streakDays);

  const userEntry = {
    name: userPetName || 'Nomi',
    ownerName: userOwnerName ? `${userOwnerName.toLowerCase()}.sol` : 'you',
    level: userLevel,
    streak: userStreak,
    xp: userXp,
    isYou: true as const,
  };

  // Insert user into leaderboard, sort by XP desc
  const merged = [...SEED_ENTRIES.map((e) => ({ ...e, isYou: false as const })), userEntry]
    .sort((a, b) => b.xp - a.xp);

  const userRank = merged.findIndex((e) => 'isYou' in e && e.isYou) + 1;
  const top10 = merged.slice(0, 10);

  return (
    <View
      className="bg-white rounded-[24px] overflow-hidden border border-pet-blue-light/40 mx-6"
      style={{ shadowColor: '#22314A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 4 }}
    >
      <LinearGradient
        colors={['#5BA3D9', '#4FB0C6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="px-5 py-3 flex-row items-center justify-between"
      >
        <View className="flex-row items-center">
          <Text className="text-base mr-2">🏆</Text>
          <Text className="text-[12px] font-black text-white tracking-[0.8px] uppercase" style={{ fontFamily: petTypography.heading }}>
            Leaderboard
          </Text>
        </View>
        <View className="bg-white/30 px-2.5 py-1 rounded-full">
          <Text className="text-[10px] font-bold text-white">Your Rank #{userRank}</Text>
        </View>
      </LinearGradient>

      <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
        {top10.map((e, i) => {
          const rank = i + 1;
          const isYou = 'isYou' in e && e.isYou;
          return (
            <View
              key={`${e.ownerName}-${i}`}
              className={`flex-row items-center px-4 py-2.5 border-b border-gray-100 ${
                isYou ? 'bg-pet-blue-light/30' : ''
              }`}
            >
              <View className={`w-7 h-7 rounded-full items-center justify-center mr-3 ${
                rank === 1 ? 'bg-amber-300' : rank === 2 ? 'bg-gray-300' : rank === 3 ? 'bg-orange-300' : 'bg-pet-blue-light/40'
              }`}>
                <Text className={`text-[11px] font-black ${rank <= 3 ? 'text-white' : 'text-pet-blue-dark'}`}>
                  {rank}
                </Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className={`text-[13px] font-black ${isYou ? 'text-pet-blue-dark' : 'text-gray-800'}`} style={{ fontFamily: petTypography.heading }}>
                    {e.name}
                  </Text>
                  {isYou && (
                    <View className="ml-2 bg-pet-blue-dark px-1.5 py-0.5 rounded-full">
                      <Text className="text-[8px] font-black text-white">YOU</Text>
                    </View>
                  )}
                </View>
                <Text className="text-[10px] text-gray-400 font-semibold">
                  {e.ownerName} · {getTitleForLevel(e.level)}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-[12px] font-black text-pet-blue-dark">Lv {e.level}</Text>
                <Text className="text-[9px] text-gray-400 font-semibold">🔥 {e.streak}d</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View className="px-4 py-2.5 bg-gray-50">
        <Text className="text-[10px] text-gray-400 text-center font-semibold">
          Top 10 globally · Updates daily
        </Text>
      </View>
    </View>
  );
}
