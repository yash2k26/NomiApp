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
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [value]);

  return (
    <View className="mb-5 last:mb-0">
      <View className="flex-row items-center justify-between mb-2.5">
        <View className="flex-row items-center">
          <View className="w-8 h-8 rounded-full bg-white items-center justify-center shadow-sm mr-2.5">
            <Text className="text-sm">{icon}</Text>
          </View>
          <Text className="text-xs font-black text-gray-500 uppercase tracking-widest">{label}</Text>
        </View>
        <Text className={`text-sm font-black ${isLow ? 'text-pet-pink' : 'text-gray-700'}`}>
          {Math.round(value)}%
        </Text>
      </View>
      <View className={`h-5 rounded-full overflow-hidden ${trackColor} p-1 border border-black/5`}>
        <Animated.View
          className={`h-full rounded-full ${isLow ? 'bg-pet-pink' : barColor}`}
          style={{
            width: widthAnim.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
              extrapolate: 'clamp',
            }),
          }}
        >
          <View className="absolute top-0 left-0 right-0 h-1/2 bg-white/20 rounded-full" />
        </Animated.View>
      </View>
    </View>
  );
}

interface ActionButtonProps {
  icon: string;
  label: string;
  bgColor: string;
  borderColor: string;
  onPress: () => void;
  disabled?: boolean;
}

function ActionButton({ icon, label, bgColor, borderColor, onPress, disabled }: ActionButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.95, friction: 5, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 4, duration: 100, useNativeDriver: true }),
    ]).start();
  };
  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }, { translateY }], opacity: disabled ? 0.4 : 1 }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={1}
      >
        <View
          className={`items-center py-5 rounded-[28px] ${bgColor} border-b-[6px] ${borderColor}`}
        >
          <View className="w-12 h-12 bg-white/20 rounded-2xl items-center justify-center mb-2">
            <Text className="text-3xl">{icon}</Text>
          </View>
          <Text className="text-sm font-black text-white uppercase tracking-wider">{label}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function CareActions() {
  const { hunger, happiness, energy, feedPet, playWithPet, restPet } = usePetStore();
  const needsAttention = hunger < 25 || happiness < 25 || energy < 25;

  return (
    <View className="px-5 mt-4">
      {/* Urgency alert */}
      {needsAttention && (
        <View className="bg-pet-pink rounded-3xl px-6 py-4 mb-5 flex-row items-center border-b-4 border-pet-pink-dark">
          <Text className="text-lg mr-3">⚠️</Text>
          <Text className="text-base font-black text-white flex-1">
            Nomi needs your care!
          </Text>
        </View>
      )}

      {/* Stats Card */}
      <View
        className="bg-white rounded-[32px] p-6 mb-6 border-2 border-gray-50 shadow-xl"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.05,
          shadowRadius: 15,
          elevation: 5,
        }}
      >
        <StatBar
          label="HUNGER"
          value={hunger}
          icon={'\u{1F356}'}
          barColor="bg-pet-yellow"
          trackColor="bg-pet-yellow-light/30"
        />
        <StatBar
          label="HAPPINESS"
          value={happiness}
          icon={'\u{1F496}'}
          barColor="bg-pet-pink"
          trackColor="bg-pet-pink-light/30"
        />
        <StatBar
          label="ENERGY"
          value={energy}
          icon={'\u{26A1}'}
          barColor="bg-pet-green"
          trackColor="bg-pet-green-light/30"
        />
      </View>

      {/* Action Buttons */}
      <View className="flex-row gap-4">
        <ActionButton
          icon={'\u{1F355}'}
          label="Feed"
          bgColor="bg-pet-yellow"
          borderColor="border-pet-yellow-dark"
          onPress={feedPet}
          disabled={hunger >= 100}
        />
        <ActionButton
          icon={'\u{1F3AE}'}
          label="Play"
          bgColor="bg-pet-pink"
          borderColor="border-pet-pink-dark"
          onPress={playWithPet}
          disabled={energy < 15}
        />
        <ActionButton
          icon={'\u{1F634}'}
          label="Rest"
          bgColor="bg-pet-green"
          borderColor="border-pet-green-dark"
          onPress={restPet}
          disabled={energy >= 100}
        />
      </View>
    </View>
  );
}

