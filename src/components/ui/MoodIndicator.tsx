import { Text, View } from 'react-native';

type MoodTone = 'calm' | 'happy' | 'low' | 'neutral';

interface MoodIndicatorProps {
  label: string;
  tone?: MoodTone;
}

const toneClasses: Record<MoodTone, string> = {
  calm: 'bg-pet-blue-light/20 border-pet-blue-light/50 text-pet-blue-light',
  happy: 'bg-pet-green/20 border-pet-green/50 text-pet-green-light',
  low: 'bg-pet-orange/20 border-pet-orange/50 text-pet-orange-light',
  neutral: 'bg-pet-purple/20 border-pet-purple/50 text-pet-purple-light',
};

export function MoodIndicator({ label, tone = 'neutral' }: MoodIndicatorProps) {
  const cls = toneClasses[tone];
  return (
    <View className={`px-3 py-1.5 rounded-full border self-start ${cls}`}>
      <Text className="text-[11px] font-semibold">{label}</Text>
    </View>
  );
}
