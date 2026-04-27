import { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, Image, type ImageSourcePropType } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert } from 'react-native';
import { usePetStore, STAMINA_COSTS, getEffectiveStaminaMax } from '../store/petStore';
import { useWalletStore } from '../store/walletStore';
import { usePremiumStore } from '../store/premiumStore';
import { XpFloatText } from './XpFloatText';
import { CareModal } from './CareModal';
import { getVariantsForAction, type CareAction } from '../data/careVariants';

interface StatBarProps {
  label: string;
  value: number;
  icon: string;
  barColor: string;
  trackColor: string;
}

function StatBar({ label, value, icon, barColor, trackColor }: StatBarProps) {
  const widthAnim = useRef(new Animated.Value(value)).current;
  const isLow = value < 25;

  useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: value,
      friction: 8,
      tension: 38,
      useNativeDriver: false,
    }).start();
  }, [value, widthAnim]);

  return (
    <View>
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <View className="w-7 h-7 rounded-full bg-white items-center justify-center mr-2 border border-gray-100">
            <Text className="text-xs">{icon}</Text>
          </View>
          <Text className="text-[11px] font-bold tracking-[1px] uppercase text-gray-500">{label}</Text>
        </View>
        <Text className={`text-[13px] font-black ${isLow ? 'text-pet-blue-dark' : 'text-gray-700'}`}>
          {Math.round(value)}%
        </Text>
      </View>
      <View className={`h-4 rounded-full overflow-hidden ${trackColor} border border-white/50`}>
        <Animated.View
          className={`h-full rounded-full ${isLow ? 'bg-pet-blue-dark' : barColor}`}
          style={{
            width: widthAnim.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
              extrapolate: 'clamp',
            }),
          }}
        />
      </View>
    </View>
  );
}

function StaminaBar() {
  const getStamina = usePetStore((s) => s.getStamina);
  const premium = usePremiumStore((s) => s.isPremium);
  const [stamina, setStamina] = useState(() => getStamina());
  const maxStamina = getEffectiveStaminaMax();
  const widthAnim = useRef(new Animated.Value(stamina)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      setStamina(getStamina());
    }, 10000);
    return () => clearInterval(interval);
  }, [getStamina]);

  useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: stamina,
      friction: 8,
      tension: 38,
      useNativeDriver: false,
    }).start();
  }, [stamina, widthAnim]);

  const isLow = stamina < 25;

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <Text className="text-sm mr-1.5">{'\u{1F50B}'}</Text>
          <Text className="text-[11px] font-black tracking-[1px] uppercase text-pet-blue-dark">Stamina</Text>
          {premium && (
            <View className="ml-1.5 bg-pet-blue-light/50 border border-pet-blue-light px-1.5 py-0.5 rounded-full flex-row items-center">
              <Text className="text-[9px]">{'\u26A1'}</Text>
              <Text className="text-[8px] font-black text-pet-blue-dark ml-0.5">2x</Text>
            </View>
          )}
        </View>
        <Text className={`text-[13px] font-black ${isLow ? 'text-pet-blue-dark' : 'text-pet-blue'}`}>
          {Math.floor(stamina)}/{maxStamina}
        </Text>
      </View>
      <View className="h-3 rounded-full overflow-hidden bg-pet-blue-light/35 border border-pet-blue-light/70">
        <Animated.View
          className={`h-full rounded-full ${isLow ? 'bg-pet-blue-dark' : 'bg-pet-blue'}`}
          style={{
            width: widthAnim.interpolate({
              inputRange: [0, maxStamina],
              outputRange: ['0%', '100%'],
              extrapolate: 'clamp',
            }),
          }}
        />
      </View>
      {stamina < maxStamina && (
        <Text className="text-[9px] text-gray-400 font-semibold mt-1 text-right">
          +1 every {premium ? '3' : '6'} min
        </Text>
      )}
    </View>
  );
}

function formatCooldown(ms: number): string {
  if (ms <= 0) return '';
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return `${min}:${sec.toString().padStart(2, '0')}`;
  return `${sec}s`;
}

interface ActionButtonProps {
  iconSource: ImageSourcePropType;
  label: string;
  bgColor: string;
  onPress: () => void;
  disabled?: boolean;
  staminaCost: number;
  cooldownRemaining: number;
  onSkipCooldown?: () => void;
  skipCost?: number;
}

const SKIP_COOLDOWN_COST = 0.0005; // SOL — small but real cost so coins/SOL feel useful

function ActionButton({ iconSource, label, bgColor, onPress, disabled, staminaCost, cooldownRemaining, onSkipCooldown, skipCost }: ActionButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onCooldown = cooldownRemaining > 0;
  const isDisabled = disabled || onCooldown;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      friction: 7,
      tension: 130,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 7,
      tension: 130,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }], opacity: isDisabled ? 0.5 : 1 }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={0.9}
      >
        <View className={`items-center py-4 rounded-[24px] ${bgColor} border border-black/10`}>
          <Image source={iconSource} style={{ width: 64, height: 64, marginBottom: 4 }} resizeMode="contain" />
          {onCooldown ? (
            <Text className="text-[10px] font-black tracking-[0.5px] text-white/80">
              {formatCooldown(cooldownRemaining)}
            </Text>
          ) : (
            <Text className="text-[12px] font-black tracking-[0.8px] uppercase text-white">{label}</Text>
          )}
          <Text className="text-[9px] font-bold text-white/60 mt-0.5">
            {'\u{1F50B}'} {staminaCost}
          </Text>
        </View>
      </TouchableOpacity>
      {onCooldown && onSkipCooldown && (
        <TouchableOpacity onPress={onSkipCooldown} activeOpacity={0.7} style={{ marginTop: 6 }}>
          <View className="self-center bg-white border border-pet-blue-light/60 px-2.5 py-1 rounded-full flex-row items-center">
            <Text className="text-[9px] mr-1">⚡</Text>
            <Text className="text-[9px] font-black text-pet-blue-dark tracking-[0.3px]">
              SKIP {skipCost?.toFixed(4)}
            </Text>
          </View>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const ACTION_TOAST_LABEL: Record<CareAction, string> = {
  feed: 'Fed Nomi!',
  play: 'Played with Nomi!',
  rest: 'Nomi rested!',
};

const ACTION_TOAST_EMOJI: Record<CareAction, string> = {
  feed: '\u{1F356}',
  play: '\u{1F389}',
  rest: '\u{1F4A4}',
};

function ActionToast({ action, onDone }: { action: CareAction; onDone: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    const out = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -8, duration: 220, useNativeDriver: true }),
      ]).start(onDone);
    }, 1100);
    return () => clearTimeout(out);
  }, [action, opacity, translateY, onDone]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -42,
        alignSelf: 'center',
        opacity,
        transform: [{ translateY }],
        zIndex: 50,
      }}
    >
      <View className="flex-row items-center bg-pet-blue-dark px-4 py-2 rounded-full" style={{
        shadowColor: '#1A2A40',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 6,
      }}>
        <Text className="text-[14px] mr-1.5">{ACTION_TOAST_EMOJI[action]}</Text>
        <Text className="text-[12px] font-black text-white tracking-[0.4px]">{ACTION_TOAST_LABEL[action]}</Text>
      </View>
    </Animated.View>
  );
}

export function CareActions() {
  const { hunger, happiness, energy, getStamina, isOnCooldown, getCooldownRemaining, skipCooldown } = usePetStore();
  const balance = useWalletStore((s) => s.balance);
  const deductBalance = useWalletStore((s) => s.deductBalance);
  const needsAttention = hunger < 25 || happiness < 25 || energy < 25;
  const [xpFloat, setXpFloat] = useState<{ amount: number; key: number } | null>(null);
  const [actionToast, setActionToast] = useState<{ action: CareAction; key: number } | null>(null);
  const [careModalAction, setCareModalAction] = useState<CareAction | null>(null);
  const [, setTick] = useState(0);

  const handleSkipCooldown = useCallback((action: CareAction) => {
    if (balance < SKIP_COOLDOWN_COST) {
      Alert.alert('Not Enough', `Need ${SKIP_COOLDOWN_COST} SOL to skip a cooldown.`);
      return;
    }
    Alert.alert(
      'Skip Cooldown',
      `Spend ${SKIP_COOLDOWN_COST} SOL to skip the ${action} cooldown?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          onPress: () => {
            deductBalance(SKIP_COOLDOWN_COST);
            skipCooldown(action);
          },
        },
      ],
    );
  }, [balance, deductBalance, skipCooldown]);

  // Re-render every second for cooldown countdowns
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const showXpFloat = useCallback((amount: number) => {
    setXpFloat({ amount, key: Date.now() });
  }, []);

  // Per-variant cooldown checks: button is available if ANY variant is off cooldown
  const feedVariants = getVariantsForAction('feed');
  const playVariants = getVariantsForAction('play');
  const restVariants = getVariantsForAction('rest');

  const feedAllCooldown = feedVariants.every(v => isOnCooldown(v.cooldownKey));
  const playAllCooldown = playVariants.every(v => isOnCooldown(v.cooldownKey));
  const restAllCooldown = restVariants.every(v => isOnCooldown(v.cooldownKey));

  const feedMinRemaining = feedAllCooldown
    ? Math.min(...feedVariants.map(v => getCooldownRemaining(v.cooldownKey)))
    : 0;
  const playMinRemaining = playAllCooldown
    ? Math.min(...playVariants.map(v => getCooldownRemaining(v.cooldownKey)))
    : 0;
  const restMinRemaining = restAllCooldown
    ? Math.min(...restVariants.map(v => getCooldownRemaining(v.cooldownKey)))
    : 0;

  const handleFeed = useCallback(() => {
    setCareModalAction('feed');
  }, []);

  const handlePlay = useCallback(() => {
    setCareModalAction('play');
  }, []);

  const handleRest = useCallback(() => {
    setCareModalAction('rest');
  }, []);

  const currentStamina = getStamina();

  return (
    <View className="px-6 mt-5">
      {needsAttention && (
        <View className="rounded-2xl overflow-hidden mb-4 border border-pet-blue-dark/30">
          <View className="bg-pet-blue-dark px-4 py-1.5">
            <Text className="text-[10px] font-black text-white tracking-[1px] uppercase">Attention</Text>
          </View>
          <View className="bg-pet-blue px-4 py-3 flex-row items-center">
            <Text className="text-base mr-2.5">{'\u26A0\uFE0F'}</Text>
            <Text className="text-sm font-semibold text-white flex-1">Nomi needs care right now.</Text>
          </View>
        </View>
      )}

      <View
        className="bg-white rounded-[28px] overflow-hidden mb-5 border border-gray-100"
        style={{
          shadowColor: '#1A2A40',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.08,
          shadowRadius: 18,
          elevation: 5,
        }}
      >
        <LinearGradient
          colors={['#4FB0C6', '#72C8DA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="px-5 py-3 flex-row items-center justify-between"
        >
          <Text className="text-[12px] font-black text-white tracking-[0.8px] uppercase">Care Dashboard</Text>
          <View className="bg-white/20 px-2.5 py-1 rounded-full">
            <Text className="text-[10px] font-bold text-white tracking-[0.6px] uppercase">Live</Text>
          </View>
        </LinearGradient>

        <View className="p-5" style={{ gap: 10 }}>
          <StaminaBar />
          <StatBar
            label="Hunger"
            value={hunger}
            icon={'\u{1F356}'}
            barColor="bg-[#5FAED4]"
            trackColor="bg-pet-blue-light/35"
          />
          <StatBar
            label="Happiness"
            value={happiness}
            icon={'\u{1F496}'}
            barColor="bg-[#4A9ECB]"
            trackColor="bg-pet-blue-light/35"
          />
          <StatBar
            label="Energy"
            value={energy}
            icon={'\u26A1'}
            barColor="bg-[#388BB7]"
            trackColor="bg-pet-blue-light/35"
          />
        </View>
      </View>

      <View className="relative">
        {xpFloat && (
          <XpFloatText
            key={xpFloat.key}
            amount={xpFloat.amount}
            visible
            onDone={() => setXpFloat(null)}
          />
        )}
        {actionToast && (
          <ActionToast
            key={actionToast.key}
            action={actionToast.action}
            onDone={() => setActionToast(null)}
          />
        )}
        <View className="flex-row gap-3">
          <ActionButton
            iconSource={require('../../assets/Icons/Feed.png')}
            label="Feed"
            bgColor="bg-[#4FABC9]"
            onPress={handleFeed}
            disabled={hunger >= 100 || currentStamina < STAMINA_COSTS.feed || feedAllCooldown}
            staminaCost={STAMINA_COSTS.feed}
            cooldownRemaining={feedMinRemaining}
            onSkipCooldown={() => handleSkipCooldown('feed')}
            skipCost={SKIP_COOLDOWN_COST}
          />
          <ActionButton
            iconSource={require('../../assets/Icons/Play.png')}
            label="Play"
            bgColor="bg-[#479FC7]"
            onPress={handlePlay}
            disabled={energy < 15 || currentStamina < STAMINA_COSTS.play || playAllCooldown}
            staminaCost={STAMINA_COSTS.play}
            cooldownRemaining={playMinRemaining}
            onSkipCooldown={() => handleSkipCooldown('play')}
            skipCost={SKIP_COOLDOWN_COST}
          />
          <ActionButton
            iconSource={require('../../assets/Icons/Rest.png')}
            label="Rest"
            bgColor="bg-[#3B8AB3]"
            onPress={handleRest}
            disabled={energy >= 100 || currentStamina < STAMINA_COSTS.rest || restAllCooldown}
            staminaCost={STAMINA_COSTS.rest}
            cooldownRemaining={restMinRemaining}
            onSkipCooldown={() => handleSkipCooldown('rest')}
            skipCost={SKIP_COOLDOWN_COST}
          />
        </View>
      </View>

      <CareModal
        visible={careModalAction !== null}
        action={careModalAction ?? 'feed'}
        onClose={() => setCareModalAction(null)}
        onActionComplete={(xpAmount) => {
          showXpFloat(xpAmount);
          if (careModalAction) {
            setActionToast({ action: careModalAction, key: Date.now() });
          }
          setCareModalAction(null);
        }}
      />
    </View>
  );
}
