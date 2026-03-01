import { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { petTypography } from '../../theme/typography';

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
      colors={['#5BAED9', '#79BFE4', '#94CCE9']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className={`rounded-[34px] border border-white/45 overflow-hidden ${compact ? 'px-5 py-5' : 'px-6 py-6'}`}
      style={{
        shadowColor: '#3B7AA1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.16,
        shadowRadius: 12,
        elevation: 5,
      }}
    >
      <View className="absolute -top-7 -right-5 w-24 h-24 rounded-full bg-white/20" />
      <View className="absolute -bottom-8 -left-4 w-20 h-20 rounded-full bg-white/15" />
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          {!!eyebrow && (
            <Text className="text-white/90 text-[10px] font-black uppercase tracking-[1.1px]" style={{ fontFamily: petTypography.strong }}>{eyebrow}</Text>
          )}
          <Text className={`text-white ${compact ? 'text-[25px] leading-[28px]' : 'text-[30px] leading-[34px]'} mt-1`} style={{ fontFamily: petTypography.display }}>
            {title}
          </Text>
          {!!subtitle && (
            <Text className="text-white/90 text-[13px] mt-2" style={{ fontFamily: petTypography.body }}>{subtitle}</Text>
          )}
          {!!badge && (
            <View className="mt-3 self-start bg-white/20 px-3 py-1.5 rounded-full border border-white/35">
              <Text className="text-white text-[10px] font-bold" style={{ fontFamily: petTypography.heading }}>{badge}</Text>
            </View>
          )}
        </View>
        {!!rightSlot && rightSlot}
      </View>
    </LinearGradient>
  );
}
