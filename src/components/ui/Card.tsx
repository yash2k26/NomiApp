import { ReactNode } from 'react';
import { View } from 'react-native';

interface CardProps {
  children: ReactNode;
  elevated?: boolean;
  className?: string;
}

export function Card({ children, elevated = false, className = '' }: CardProps) {
  return (
    <View
      className={`rounded-[18px] border ${elevated ? 'bg-pet-blue-dark/25 border-pet-blue-light/30' : 'bg-pet-blue-dark/20 border-pet-blue-light/20'} ${className}`}
      style={{
        shadowColor: elevated ? '#4FA6FF' : '#000000',
        shadowOffset: { width: 0, height: elevated ? 8 : 2 },
        shadowOpacity: elevated ? 0.14 : 0.05,
        shadowRadius: elevated ? 16 : 6,
        elevation: elevated ? 5 : 1,
      }}
    >
      {children}
    </View>
  );
}
