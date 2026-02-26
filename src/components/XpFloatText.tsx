import { useEffect, useRef } from 'react';
import { Animated, Text } from 'react-native';

interface XpFloatTextProps {
  amount: number;
  visible: boolean;
  onDone: () => void;
}

export function XpFloatText({ amount, visible, onDone }: XpFloatTextProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    translateY.setValue(0);
    opacity.setValue(1);

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -40,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start(() => onDone());
  }, [visible, translateY, opacity, onDone]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
        opacity,
        position: 'absolute',
        top: -10,
        alignSelf: 'center',
        zIndex: 50,
      }}
    >
      <Text className="text-[14px] font-black text-pet-purple">
        +{amount} XP
      </Text>
    </Animated.View>
  );
}
