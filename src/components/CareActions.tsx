import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePetStore } from '../store/petStore';

interface StatBarProps {
  label: string;
  value: number;
  icon: string;
  gradientColors: [string, string];
  trackColor: string;
}

function StatBar({ label, value, icon, gradientColors, trackColor }: StatBarProps) {
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
    <View className="mb-3.5">
      <View className="flex-row items-center justify-between mb-1.5">
        <View className="flex-row items-center">
          <Text className="text-sm mr-1.5">{icon}</Text>
          <Text className="text-xs font-semibold text-neutral-500 tracking-wide">{label}</Text>
        </View>
        <Text className={`text-xs font-bold ${isLow ? 'text-red-500' : 'text-neutral-500'}`}>
          {Math.round(value)}
        </Text>
      </View>
      <View className={`h-3 rounded-full overflow-hidden ${trackColor}`}>
        <Animated.View
          style={{
            height: '100%',
            borderRadius: 999,
            width: widthAnim.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
              extrapolate: 'clamp',
            }),
          }}
        >
          <LinearGradient
            colors={isLow ? ['#ef4444', '#f87171'] : gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1, borderRadius: 999 }}
          />
        </Animated.View>
      </View>
    </View>
  );
}

interface ActionButtonProps {
  icon: string;
  label: string;
  gradientColors: [string, string];
  onPress: () => void;
  disabled?: boolean;
}

function ActionButton({ icon, label, gradientColors, onPress, disabled }: ActionButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.92, friction: 5, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }], opacity: disabled ? 0.4 : 1 }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="items-center py-4 rounded-2xl"
          style={{
            shadowColor: gradientColors[0],
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Text className="text-2xl mb-1">{icon}</Text>
          <Text className="text-xs font-bold text-white tracking-wide">{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function CareActions() {
  const { hunger, happiness, energy, feedPet, playWithPet, restPet } = usePetStore();
  const needsAttention = hunger < 25 || happiness < 25 || energy < 25;

  return (
    <View className="px-5 mt-2">
      {/* Urgency alert */}
      {needsAttention && (
        <View className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4 flex-row items-center">
          <Text className="text-lg mr-2">{'\u{1F6A8}'}</Text>
          <Text className="text-sm font-semibold text-red-500 flex-1">
            Nomi needs you! Take care of your pet.
          </Text>
        </View>
      )}

      {/* Stats Card */}
      <View
        className="bg-white/80 rounded-2xl p-5 mb-5"
        style={{
          shadowColor: '#c084fc',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 3,
        }}
      >
        <StatBar
          label="HUNGER"
          value={hunger}
          icon={'\u{1F356}'}
          gradientColors={['#f97316', '#fdba74']}
          trackColor="bg-orange-100"
        />
        <StatBar
          label="HAPPINESS"
          value={happiness}
          icon={'\u{1F496}'}
          gradientColors={['#ec4899', '#f9a8d4']}
          trackColor="bg-pink-100"
        />
        <StatBar
          label="ENERGY"
          value={energy}
          icon={'\u{26A1}'}
          gradientColors={['#10b981', '#6ee7b7']}
          trackColor="bg-emerald-100"
        />
      </View>

      {/* Action Buttons */}
      <View className="flex-row gap-3">
        <ActionButton
          icon={'\u{1F355}'}
          label="Feed"
          gradientColors={['#fb923c', '#fdba74']}
          onPress={feedPet}
          disabled={hunger >= 100}
        />
        <ActionButton
          icon={'\u{1F3AE}'}
          label="Play"
          gradientColors={['#f472b6', '#f9a8d4']}
          onPress={playWithPet}
          disabled={energy < 15}
        />
        <ActionButton
          icon={'\u{1F634}'}
          label="Rest"
          gradientColors={['#34d399', '#6ee7b7']}
          onPress={restPet}
          disabled={energy >= 100}
        />
      </View>
    </View>
  );
}
