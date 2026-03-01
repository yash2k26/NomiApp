import { useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface BaseButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: string;
  testID?: string;
}

function ButtonShell({
  label,
  onPress,
  disabled,
  icon,
  testID,
  variant,
}: BaseButtonProps & { variant: 'primary' | 'secondary' | 'ghost' }) {
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = !!disabled;

  const onPressIn = () => {
    Animated.timing(scale, {
      toValue: 0.97,
      duration: 120,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start();
  };

  const content = (
    <View className="h-[52px] rounded-[14px] items-center justify-center flex-row px-5">
      {!!icon && <Text className="text-[14px] mr-2">{icon}</Text>}
      <Text
        className={`text-[15px] font-semibold ${
          variant === 'ghost' ? 'text-pet-blue-light' : variant === 'secondary' ? 'text-pet-blue-light' : 'text-white'
        }`}
      >
        {label}
      </Text>
    </View>
  );

  return (
    <Animated.View style={{ transform: [{ scale }], opacity: isDisabled ? 0.5 : 1 }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        testID={testID}
      >
        {variant === 'primary' ? (
          <LinearGradient
            colors={['#4FA6FF', '#3C8EF0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="rounded-[14px]"
          >
            {content}
          </LinearGradient>
        ) : variant === 'secondary' ? (
          <View className="rounded-[14px] border border-pet-blue-light/40 bg-pet-blue-dark/25">
            {content}
          </View>
        ) : (
          <View className="rounded-[14px] border border-transparent bg-transparent">
            {content}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function PrimaryButton(props: BaseButtonProps) {
  return <ButtonShell {...props} variant="primary" />;
}

export function SecondaryButton(props: BaseButtonProps) {
  return <ButtonShell {...props} variant="secondary" />;
}

export function GhostButton(props: BaseButtonProps) {
  return <ButtonShell {...props} variant="ghost" />;
}
