import React, { useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { usePetStore } from '../store/petStore';
import { useXpStore, getTitleForLevel } from '../store/xpStore';
import { useWalletStore } from '../store/walletStore';
import { useAdventureStore, EVOLUTION_STAGES } from '../store/adventureStore';
import { useShopStore } from '../store/shopStore';

/* ── circular stat gauge ─────────────────────────────────── */
function StatGauge({
  value,
  color,
  bgColor,
  emoji,
  label,
}: {
  value: number;
  color: string;
  bgColor: string;
  emoji: string;
  label: string;
}) {
  const pct = Math.round(Math.min(value, 100));
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      {/* outer glow ring */}
      <View
        style={{
          width: 68,
          height: 68,
          borderRadius: 34,
          backgroundColor: bgColor,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 4,
        }}
      >
        {/* track */}
        <View
          style={{
            position: 'absolute',
            width: 60,
            height: 60,
            borderRadius: 30,
            borderWidth: 4,
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        />
        {/* filled arc */}
        <View
          style={{
            position: 'absolute',
            width: 60,
            height: 60,
            borderRadius: 30,
            borderWidth: 4,
            borderColor: color,
            transform: [{ rotate: '-90deg' }],
            borderRightColor: pct > 25 ? color : 'transparent',
            borderBottomColor: pct > 50 ? color : 'transparent',
            borderLeftColor: pct > 75 ? color : 'transparent',
          }}
        />
        {/* inner circle */}
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: 'rgba(0,0,0,0.3)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 20 }}>{emoji}</Text>
        </View>
      </View>
      <Text
        style={{
          fontSize: 15,
          fontWeight: '900',
          color: '#fff',
          marginTop: 8,
          textShadowColor: 'rgba(0,0,0,0.3)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 4,
        }}
      >
        {pct}%
      </Text>
      <Text
        style={{
          fontSize: 9,
          fontWeight: '700',
          color: 'rgba(255,255,255,0.5)',
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/* ── main share card ─────────────────────────────────────── */
export function SharePetCard() {
  const name = usePetStore((s) => s.name);
  const ownerName = usePetStore((s) => s.ownerName);
  const hunger = usePetStore((s) => s.hunger);
  const happiness = usePetStore((s) => s.happiness);
  const energy = usePetStore((s) => s.energy);
  const mintAddress = usePetStore((s) => s.mintAddress);
  const streakDays = usePetStore((s) => s.streakDays);
  const level = useXpStore((s) => s.level);
  const totalXp = useXpStore((s) => s.totalXp);
  const balance = useWalletStore((s) => s.balance);
  const skrBalance = useWalletStore((s) => s.skrBalance);
  const evolutionStage = useAdventureStore((s) => s.evolutionStage);
  const completedAdventures = useAdventureStore((s) => s.completedAdventures);
  const items = useShopStore((s) => s.items);
  const ownedCount = items.filter((i) => i.owned).length;

  const title = getTitleForLevel(level);
  const stage = EVOLUTION_STAGES[evolutionStage - 1];
  const stageEmoji =
    evolutionStage === 1 ? '\u{1F423}'
      : evolutionStage === 2 ? '\u{1F431}'
        : evolutionStage === 3 ? '\u{1F981}'
          : evolutionStage === 4 ? '\u{1F409}' : '\u{1F451}';
  const shortMint = mintAddress
    ? `${mintAddress.slice(0, 4)}...${mintAddress.slice(-4)}`
    : 'Not minted';

  const cardRef = useRef<ViewShot>(null);

  const handleShare = useCallback(async () => {
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: `${name} - My Nomi Companion`,
      });
    } catch {}
  }, [name]);

  return (
    <View style={{ marginBottom: 20 }}>
      <ViewShot ref={cardRef} options={{ format: 'png', quality: 1 }}>
        <View
          style={{
            borderRadius: 28,
            overflow: 'hidden',
            borderWidth: 1.5,
            borderColor: 'rgba(79,171,201,0.35)',
          }}
        >
          <LinearGradient
            colors={['#0F2027', '#1B3A4B', '#203A43', '#2D6B90']}
            locations={[0, 0.3, 0.6, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* ── decorative bokeh circles ── */}
            <View style={{ position: 'absolute', top: -40, right: -25, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(79,171,201,0.1)' }} />
            <View style={{ position: 'absolute', top: 20, right: 30, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(79,171,201,0.06)' }} />
            <View style={{ position: 'absolute', bottom: 40, left: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(52,211,153,0.06)' }} />
            <View style={{ position: 'absolute', top: 100, left: '35%' as any, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.02)' }} />
            <View style={{ position: 'absolute', bottom: -30, right: '20%' as any, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(167,139,250,0.06)' }} />

            {/* ── shimmer line across top ── */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: 'rgba(255,255,255,0.08)',
              }}
            />

            {/* ── header section ── */}
            <View style={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  {/* name with text shadow */}
                  <Text
                    style={{
                      fontSize: 30,
                      fontWeight: '900',
                      color: '#fff',
                      letterSpacing: -0.5,
                      textShadowColor: 'rgba(79,171,201,0.5)',
                      textShadowOffset: { width: 0, height: 2 },
                      textShadowRadius: 8,
                    }}
                  >
                    {name}
                  </Text>
                  {ownerName ? (
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '600', marginTop: 3, letterSpacing: 0.3 }}>
                      raised by {ownerName}
                    </Text>
                  ) : null}
                </View>

                {/* evolution emblem – glassmorphism style */}
                <View
                  style={{
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderRadius: 20,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    shadowColor: '#4FABC9',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: 3,
                  }}
                >
                  <Text style={{ fontSize: 30 }}>{stageEmoji}</Text>
                  <Text
                    style={{
                      fontSize: 9,
                      color: 'rgba(255,255,255,0.65)',
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                      marginTop: 3,
                    }}
                  >
                    {stage?.name}
                  </Text>
                </View>
              </View>

              {/* pills row */}
              <View style={{ flexDirection: 'row', marginTop: 16, gap: 6, flexWrap: 'wrap' }}>
                <Pill text={`Lv.${level} ${title}`} variant="glow" />
                <Pill text={`${totalXp} XP`} variant="default" />
                {streakDays > 0 && <Pill text={`\u{1F525} ${streakDays}d streak`} variant="warm" />}
                {completedAdventures > 0 && <Pill text={`\u{1F30D} ${completedAdventures} adventures`} variant="default" />}
              </View>
            </View>

            {/* ── divider with glow ── */}
            <View style={{ marginHorizontal: 24, marginTop: 16 }}>
              <LinearGradient
                colors={['transparent', 'rgba(79,171,201,0.3)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: 1 }}
              />
            </View>

            {/* ── stat gauges ── */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 22 }}>
              <StatGauge value={hunger} color="#4FABC9" bgColor="rgba(79,171,201,0.12)" emoji={'\u{1F356}'} label="Hunger" />
              <StatGauge value={happiness} color="#FBBF24" bgColor="rgba(251,191,36,0.1)" emoji={'\u{1F60A}'} label="Happy" />
              <StatGauge value={energy} color="#34D399" bgColor="rgba(52,211,153,0.1)" emoji={'\u{26A1}'} label="Energy" />
            </View>

            {/* ── on-chain info strip ── */}
            <View
              style={{
                marginHorizontal: 16,
                marginBottom: 14,
                borderRadius: 16,
                overflow: 'hidden',
              }}
            >
              <LinearGradient
                colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.45)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.06)',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <ChainStat label="NFT" value={shortMint} icon="ethereum" />
                  <ChainStatDivider />
                  <ChainStat label="SOL" value={balance.toFixed(2)} color="#4FABC9" icon="currency-usd" />
                  <ChainStatDivider />
                  <ChainStat label="SKR" value={skrBalance.toFixed(0)} color="#A78BFA" icon="diamond-stone" />
                  <ChainStatDivider />
                  <ChainStat label="Items" value={`${ownedCount}`} icon="treasure-chest" />
                </View>
              </LinearGradient>
            </View>

            {/* ── branding bar ── */}
            <View
              style={{
                paddingVertical: 12,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.04)',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '900', color: 'rgba(255,255,255,0.45)', letterSpacing: 3 }}>
                NOMI
              </Text>
              <Dot />
              <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5 }}>
                Powered by Solana
              </Text>
              <Dot />
              <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5 }}>
                oraclepet.app
              </Text>
            </View>
          </LinearGradient>
        </View>
      </ViewShot>

      {/* ── share button ── */}
      <TouchableOpacity onPress={handleShare} activeOpacity={0.85} style={{ marginTop: 14 }}>
        <LinearGradient
          colors={['#4FABC9', '#3792A6', '#2D6B90']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            paddingVertical: 15,
            borderRadius: 22,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: 'rgba(79,171,201,0.4)',
            shadowColor: '#2D6B90',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 14,
            elevation: 8,
          }}
        >
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <MaterialCommunityIcons name="share-variant" size={16} color="#fff" />
          </View>
          <Text
            style={{
              color: 'white',
              fontWeight: '900',
              fontSize: 14,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            Share My Pet
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

/* ── small helpers ───────────────────────────────────────── */

function Pill({ text, variant }: { text: string; variant: 'glow' | 'warm' | 'default' }) {
  const bg =
    variant === 'glow' ? 'rgba(79,171,201,0.25)'
      : variant === 'warm' ? 'rgba(251,146,60,0.2)'
        : 'rgba(255,255,255,0.08)';
  const border =
    variant === 'glow' ? 'rgba(79,171,201,0.5)'
      : variant === 'warm' ? 'rgba(251,146,60,0.4)'
        : 'rgba(255,255,255,0.08)';
  const textColor =
    variant === 'glow' ? '#7DD3E8'
      : variant === 'warm' ? '#FCD34D'
        : 'rgba(255,255,255,0.7)';

  return (
    <View
      style={{
        backgroundColor: bg,
        paddingHorizontal: 11,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '800', color: textColor }}>
        {text}
      </Text>
    </View>
  );
}

function ChainStat({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color?: string;
  icon: string;
}) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <MaterialCommunityIcons
        name={icon as any}
        size={12}
        color={color || 'rgba(255,255,255,0.4)'}
        style={{ marginBottom: 4 }}
      />
      <Text
        style={{
          fontSize: 13,
          fontWeight: '900',
          color: color || 'rgba(255,255,255,0.85)',
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 8,
          fontWeight: '700',
          color: 'rgba(255,255,255,0.3)',
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function ChainStatDivider() {
  return (
    <View
      style={{
        width: 1,
        height: '70%',
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignSelf: 'center',
      }}
    />
  );
}

function Dot() {
  return (
    <View
      style={{
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginHorizontal: 10,
      }}
    />
  );
}
