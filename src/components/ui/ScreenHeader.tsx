import { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ScreenHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  rightSlot?: ReactNode;
  compact?: boolean;
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  badge,
  rightSlot,
  compact = false,
}: ScreenHeaderProps) {
  return (
    <LinearGradient
      colors={['#4FB0C6', '#6CCBDE']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className={`rounded-[28px] border border-white/40 ${compact ? 'px-4 py-4' : 'px-5 py-5'}`}
      style={{
        shadowColor: '#2C8293',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 6,
      }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          {!!eyebrow && (
            <Text className="text-white/85 text-[10px] font-black uppercase tracking-[1px]">{eyebrow}</Text>
          )}
          <Text className={`text-white font-black ${compact ? 'text-[24px] leading-[26px]' : 'text-[28px] leading-[30px]'} mt-1`}>
            {title}
          </Text>
          {!!subtitle && (
            <Text className="text-white/90 text-[12px] mt-1.5">{subtitle}</Text>
          )}
          {!!badge && (
            <View className="mt-2 self-start bg-white/20 px-2.5 py-1 rounded-full border border-white/35">
              <Text className="text-white text-[10px] font-bold">{badge}</Text>
            </View>
          )}
        </View>
        {!!rightSlot && rightSlot}
      </View>
    </LinearGradient>
  );
}
