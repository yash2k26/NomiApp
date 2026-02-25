import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { usePetStore } from '../store/petStore';

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
        <Text className={`text-[13px] font-black ${isLow ? 'text-pet-pink-dark' : 'text-gray-700'}`}>
          {Math.round(value)}%
        </Text>
      </View>
      <View className={`h-4 rounded-full overflow-hidden ${trackColor} border border-white/50`}>
        <Animated.View
          className={`h-full rounded-full ${isLow ? 'bg-pet-pink-dark' : barColor}`}
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

interface ActionButtonProps {
  icon: string;
  label: string;
  bgColor: string;
  onPress: () => void;
  disabled?: boolean;
}

function ActionButton({ icon, label, bgColor, onPress, disabled }: ActionButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

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
    <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }], opacity: disabled ? 0.5 : 1 }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={0.9}
      >
        <View className={`items-center py-4 rounded-[24px] ${bgColor} border border-black/10`}>
          <Text className="text-2xl mb-1">{icon}</Text>
          <Text className="text-[12px] font-black tracking-[0.8px] uppercase text-white">{label}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function CareActions() {
  const { hunger, happiness, energy, feedPet, playWithPet, restPet } = usePetStore();
  const needsAttention = hunger < 25 || happiness < 25 || energy < 25;

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
        className="bg-white rounded-[28px] p-5 mb-5 border border-gray-100"
        style={{
          shadowColor: '#1A2A40',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.08,
          shadowRadius: 18,
          elevation: 5,
        }}
      >
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-[16px] font-black text-gray-800">Care Dashboard</Text>
          <View className="bg-pet-blue-light/35 px-2.5 py-1 rounded-full">
            <Text className="text-[10px] font-bold text-pet-blue-dark tracking-[0.6px] uppercase">Live</Text>
          </View>
        </View>

        <StatBar
          label="Hunger"
          value={hunger}
          icon={'\u{1F356}'}
          barColor="bg-pet-blue-dark"
          trackColor="bg-pet-blue-light/45"
        />
        <StatBar
          label="Happiness"
          value={happiness}
          icon={'\u{1F496}'}
          barColor="bg-pet-blue"
          trackColor="bg-pet-blue-light/35"
        />
        <StatBar
          label="Energy"
          value={energy}
          icon={'\u26A1'}
          barColor="bg-pet-blue-dark"
          trackColor="bg-pet-blue-light/30"
        />
      </View>

      <View className="flex-row gap-3">
        <ActionButton
          icon={'\u{1F355}'}
          label="Feed"
          bgColor="bg-pet-blue-dark"
          onPress={feedPet}
          disabled={hunger >= 100}
        />
        <ActionButton
          icon={'\u{1F3AE}'}
          label="Play"
          bgColor="bg-pet-blue"
          onPress={playWithPet}
          disabled={energy < 15}
        />
        <ActionButton
          icon={'\u{1F634}'}
          label="Rest"
          bgColor="bg-pet-blue-dark"
          onPress={restPet}
          disabled={energy >= 100}
        />
      </View>
    </View>
  );
}
