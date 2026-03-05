import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, Share } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePetStore } from '../store/petStore';
import { useXpStore, getTitleForLevel } from '../store/xpStore';
import { useWalletStore } from '../store/walletStore';
import { useAdventureStore, EVOLUTION_STAGES } from '../store/adventureStore';

export function SharePetCard() {
  const name = usePetStore((s) => s.name);
  const ownerName = usePetStore((s) => s.ownerName);
  const hunger = usePetStore((s) => s.hunger);
  const happiness = usePetStore((s) => s.happiness);
  const energy = usePetStore((s) => s.energy);
  const mintAddress = usePetStore((s) => s.mintAddress);
  const level = useXpStore((s) => s.level);
  const totalXp = useXpStore((s) => s.totalXp);
  const streakDays = usePetStore((s) => s.streakDays);
  const balance = useWalletStore((s) => s.balance);
  const skrBalance = useWalletStore((s) => s.skrBalance);
  const evolutionStage = useAdventureStore((s) => s.evolutionStage);
  const completedAdventures = useAdventureStore((s) => s.completedAdventures);

  const title = getTitleForLevel(level);
  const stage = EVOLUTION_STAGES[evolutionStage - 1];
  const stageEmoji = evolutionStage === 1 ? '\u{1F423}' : evolutionStage === 2 ? '\u{1F431}' : evolutionStage === 3 ? '\u{1F981}' : evolutionStage === 4 ? '\u{1F409}' : '\u{1F451}';
  const shortMint = mintAddress ? `${mintAddress.slice(0, 4)}...${mintAddress.slice(-4)}` : 'Not minted';

  const handleShare = useCallback(async () => {
    const shareText = [
      `Meet ${name}! ${stageEmoji}`,
      `Lv.${level} ${title} \u00B7 ${totalXp} XP${streakDays > 0 ? ` \u00B7 \u{1F525} ${streakDays} day streak` : ''}`,
      `\u{1F356} ${Math.round(hunger)}% \u00B7 \u{1F60A} ${Math.round(happiness)}% \u00B7 \u{26A1} ${Math.round(energy)}%`,
      `${completedAdventures} adventures completed`,
      mintAddress ? `NFT: ${shortMint} on Solana` : '',
      '',
      'Built with Nomi \u00B7 A Tamagotchi that lives on Solana',
      '#Solana #SolanaMobile #NFT #Nomi',
    ].filter(Boolean).join('\n');

    try {
      await Share.share({
        message: shareText,
        title: `${name} - My Nomi Companion`,
      });
    } catch {}
  }, [name, level, title, totalXp, streakDays, hunger, happiness, energy, completedAdventures, mintAddress, shortMint, stageEmoji]);

  return (
    <View className="mb-5">
      <View
        style={{
          borderRadius: 28,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(167, 215, 230, 0.7)',
        }}
      >
        {/* Header gradient */}
        <LinearGradient
          colors={['#2D6B90', '#4FABC9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={{ fontSize: 24, fontWeight: '900', color: 'white' }}>{name}</Text>
              {ownerName ? (
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginTop: 2 }}>
                  {ownerName}'s companion
                </Text>
              ) : null}
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 36 }}>{stageEmoji}</Text>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '700' }}>{stage?.name}</Text>
            </View>
          </View>

          {/* Level badge */}
          <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '900', color: 'white' }}>Lv.{level} {title}</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '900', color: 'white' }}>{totalXp} XP</Text>
            </View>
            {streakDays > 0 && (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '900', color: 'white' }}>{'\u{1F525}'} {streakDays}d</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Stats body */}
        <View style={{ backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 16 }}>
          {/* Stat bars */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <StatMini label="Hunger" value={Math.round(hunger)} color="#4FABC9" emoji={'\u{1F356}'} />
            <StatMini label="Happy" value={Math.round(happiness)} color="#F59E0B" emoji={'\u{1F60A}'} />
            <StatMini label="Energy" value={Math.round(energy)} color="#10B981" emoji={'\u{26A1}'} />
          </View>

          {/* On-chain info */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
            <View>
              <Text style={{ fontSize: 10, color: '#9ca3af', fontWeight: '600' }}>NFT</Text>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#374151' }}>{shortMint}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 10, color: '#9ca3af', fontWeight: '600' }}>Balance</Text>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#2D6B90' }}>{balance.toFixed(2)} SOL</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 10, color: '#9ca3af', fontWeight: '600' }}>SKR</Text>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#9333ea' }}>{skrBalance.toFixed(1)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 10, color: '#9ca3af', fontWeight: '600' }}>Adventures</Text>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#374151' }}>{completedAdventures}</Text>
            </View>
          </View>

          {/* Branding footer */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#9ca3af', letterSpacing: 0.5 }}>NOMI</Text>
            <Text style={{ fontSize: 10, color: '#d1d5db', marginHorizontal: 6 }}>{'\u00B7'}</Text>
            <Text style={{ fontSize: 10, fontWeight: '600', color: '#9ca3af' }}>Powered by Solana</Text>
            <Text style={{ fontSize: 10, color: '#d1d5db', marginHorizontal: 6 }}>{'\u00B7'}</Text>
            <Text style={{ fontSize: 10, fontWeight: '600', color: '#9ca3af' }}>oraclepet.app</Text>
          </View>
        </View>
      </View>

      {/* Share button */}
      <TouchableOpacity onPress={handleShare} activeOpacity={0.85} style={{ marginTop: 10 }}>
        <LinearGradient
          colors={['#4FABC9', '#3E8AB3']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ paddingVertical: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
        >
          <MaterialCommunityIcons name="share-variant" size={16} color="#fff" />
          <Text style={{ color: 'white', fontWeight: '900', fontSize: 12, marginLeft: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Share My Pet
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function StatMini({ label, value, color, emoji }: { label: string; value: number; color: string; emoji: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 16, marginBottom: 4 }}>{emoji}</Text>
      <View style={{ width: '80%', height: 6, borderRadius: 3, backgroundColor: '#f3f4f6', overflow: 'hidden' }}>
        <View style={{ width: `${value}%`, height: '100%', borderRadius: 3, backgroundColor: color }} />
      </View>
      <Text style={{ fontSize: 10, fontWeight: '800', color: '#6b7280', marginTop: 4 }}>{value}%</Text>
      <Text style={{ fontSize: 9, fontWeight: '600', color: '#9ca3af' }}>{label}</Text>
    </View>
  );
}
