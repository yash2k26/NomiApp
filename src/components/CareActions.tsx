import { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { usePetStore, STAMINA_COSTS, getEffectiveStaminaMax } from '../store/petStore';
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
    <View className="mb-5 last:mb-0">
      <View className="flex-row items-center justify-between mb-2.5">
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
  icon: string;
  label: string;
  bgColor: string;
  onPress: () => void;
  disabled?: boolean;
  staminaCost: number;
  cooldownRemaining: number;
}

function ActionButton({ icon, label, bgColor, onPress, disabled, staminaCost, cooldownRemaining }: ActionButtonProps) {
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
          <Text className="text-2xl mb-1">{icon}</Text>
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
    </Animated.View>
  );
}

export function CareActions() {
  const { hunger, happiness, energy, getStamina, isOnCooldown, getCooldownRemaining } = usePetStore();
  const needsAttention = hunger < 25 || happiness < 25 || energy < 25;
  const [xpFloat, setXpFloat] = useState<{ amount: number; key: number } | null>(null);
  const [careModalAction, setCareModalAction] = useState<CareAction | null>(null);
  const [, setTick] = useState(0);

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

        <View className="p-5">
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
        <View className="flex-row gap-3">
          <ActionButton
            icon={'\u{1F355}'}
            label="Feed"
            bgColor="bg-[#4FABC9]"
            onPress={handleFeed}
            disabled={hunger >= 100 || currentStamina < STAMINA_COSTS.feed || feedAllCooldown}
            staminaCost={STAMINA_COSTS.feed}
            cooldownRemaining={feedMinRemaining}
          />
          <ActionButton
            icon={'\u{1F3AE}'}
            label="Play"
            bgColor="bg-[#479FC7]"
            onPress={handlePlay}
            disabled={energy < 15 || currentStamina < STAMINA_COSTS.play || playAllCooldown}
            staminaCost={STAMINA_COSTS.play}
            cooldownRemaining={playMinRemaining}
          />
          <ActionButton
            icon={'\u{1F634}'}
            label="Rest"
            bgColor="bg-[#3B8AB3]"
            onPress={handleRest}
            disabled={energy >= 100 || currentStamina < STAMINA_COSTS.rest || restAllCooldown}
            staminaCost={STAMINA_COSTS.rest}
            cooldownRemaining={restMinRemaining}
          />
        </View>
      </View>

      <CareModal
        visible={careModalAction !== null}
        action={careModalAction ?? 'feed'}
        onClose={() => setCareModalAction(null)}
        onActionComplete={(xpAmount) => {
          showXpFloat(xpAmount);
          setCareModalAction(null);
        }}
      />
    </View>
  );
}
