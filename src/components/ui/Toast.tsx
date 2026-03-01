import { Text, View } from 'react-native';

interface ToastProps {
  message: string;
  tone?: 'default' | 'success' | 'warning' | 'destructive';
}

const toneMap = {
  default: 'bg-pet-blue-dark border-pet-blue-light/40 text-pet-blue-light',
  success: 'bg-pet-green-dark border-pet-green/50 text-white',
  warning: 'bg-pet-orange-dark border-pet-orange/50 text-white',
  destructive: 'bg-red-900 border-red-400/50 text-white',
} as const;

export function Toast({ message, tone = 'default' }: ToastProps) {
  const cls = toneMap[tone];
  return (
    <View className={`px-4 py-3 rounded-2xl border ${cls}`}>
      <Text className="text-[13px] font-medium">{message}</Text>
    </View>
  );
}
