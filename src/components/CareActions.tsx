import { View, Text, TouchableOpacity } from 'react-native';
import { usePetStore } from '../store/petStore';

interface StatBarProps {
  label: string;
  value: number;
  icon: string;
  color: string;
  bgColor: string;
}

function StatBar({ label, value, icon, color, bgColor }: StatBarProps) {
  return (
    <View className="flex-row items-center mb-3">
      <Text className="text-base mr-2">{icon}</Text>
      <Text className="text-sm font-medium text-white w-20">{label}</Text>
      <View className="flex-1 h-3 bg-neutral-700 rounded-full overflow-hidden mx-3">
        <View 
          className={`h-full rounded-full ${bgColor}`} 
          style={{ width: `${value}%` }} 
        />
      </View>
      <Text className={`text-sm font-bold w-12 text-right ${color}`}>{Math.round(value)}%</Text>
    </View>
  );
}

interface ActionButtonProps {
  icon: string;
  label: string;
  bgColor: string;
  onPress: () => void;
  disabled?: boolean;
}

function ActionButton({ icon, label, bgColor, onPress, disabled }: ActionButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      className={`flex-1 items-center py-4 rounded-2xl ${bgColor} ${disabled ? 'opacity-40' : ''}`}
    >
      <Text className="text-2xl mb-1">{icon}</Text>
      <Text className="text-sm font-bold text-white">{label}</Text>
    </TouchableOpacity>
  );
}

export function CareActions() {
  const { hunger, happiness, energy, feedPet, playWithPet, restPet } = usePetStore();

  return (
    <View className="px-5">
      {/* Status Section */}
      <View className="bg-neutral-800/80 rounded-2xl p-4 mb-4">
        <Text className="text-xs font-semibold text-neutral-400 tracking-wider mb-3">PET STATUS</Text>
        <StatBar 
          label="Hunger" 
          value={hunger} 
          icon="🍖" 
          color="text-orange-400" 
          bgColor="bg-orange-500" 
        />
        <StatBar 
          label="Happiness" 
          value={happiness} 
          icon="💖" 
          color="text-pink-400" 
          bgColor="bg-pink-500" 
        />
        <StatBar 
          label="Energy" 
          value={energy} 
          icon="⚡" 
          color="text-emerald-400" 
          bgColor="bg-emerald-500" 
        />
      </View>

      {/* Care Actions */}
      <View className="flex-row gap-3">
        <ActionButton
          icon="🍕"
          label="Feed"
          bgColor="bg-orange-500"
          onPress={feedPet}
          disabled={hunger >= 100}
        />
        <ActionButton
          icon="🎮"
          label="Play"
          bgColor="bg-pink-500"
          onPress={playWithPet}
          disabled={energy < 15}
        />
        <ActionButton
          icon="😴"
          label="Rest"
          bgColor="bg-emerald-500"
          onPress={restPet}
          disabled={energy >= 100}
        />
      </View>
    </View>
  );
}
