import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

interface StatBarProps {
  label: string;
  value: number;
  colorClass?: string;
}

export function StatBar({ label, value, colorClass = 'bg-pet-blue' }: StatBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const width = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: clamped,
      duration: 240,
      useNativeDriver: false,
    }).start();
  }, [clamped, width]);

  return (
    <View className="mb-3">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-[11px] text-pet-blue-light font-medium">{label}</Text>
        <Text className="text-[11px] text-pet-blue-light font-semibold">{Math.round(clamped)}%</Text>
      </View>
      <View className="h-[10px] rounded-full bg-pet-blue-light/20 overflow-hidden">
        <Animated.View
          className={`h-full rounded-full ${colorClass}`}
          style={{
            width: width.interpolate({
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
