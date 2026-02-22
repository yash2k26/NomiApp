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
  const isLow = value < 25;
  return (
    <View className="flex-row items-center mb-3">
      <Text className="text-base mr-2">{icon}</Text>
      <Text className="text-sm font-medium text-white w-20">{label}</Text>
      <View className="flex-1 h-3 bg-neutral-700 rounded-full overflow-hidden mx-3">
        <View
          className={`h-full rounded-full ${isLow ? 'bg-red-500' : bgColor}`}
          style={{ width: `${value}%` }}
        />
      </View>
      <Text className={`text-sm font-bold w-12 text-right ${isLow ? 'text-red-400' : color}`}>
        {Math.round(value)}%
      </Text>
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
  const { hunger, happiness, energy, feedPet, playWithPet, restPet, streakDays } = usePetStore();

  const needsAttention = hunger < 25 || happiness < 25 || energy < 25;

  return (
    <View className="px-5">
      {/* Urgency alert when stats are critically low */}
      {needsAttention && (
        <View className="bg-red-500/15 border border-red-500/30 rounded-2xl px-4 py-3 mb-4 flex-row items-center">
          <Text className="text-lg mr-2">{'\u{1F6A8}'}</Text>
          <Text className="text-sm font-semibold text-red-400 flex-1">
            Nomi needs you! Take care of your pet.
          </Text>
        </View>
      )}

      {/* Status Section */}
      <View className="bg-neutral-800/80 rounded-2xl p-4 mb-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-xs font-semibold text-neutral-400 tracking-wider">PET STATUS</Text>
          {streakDays > 0 && (
            <View className="flex-row items-center bg-orange-500/15 px-3 py-1 rounded-full">
              <Text className="text-xs">{'\u{1F525}'}</Text>
              <Text className="text-xs font-bold text-orange-400 ml-1">
                {streakDays > 1 ? `${streakDays}-day streak` : 'Day 1'}
              </Text>
            </View>
          )}
        </View>
        <StatBar
          label="Hunger"
          value={hunger}
          icon={'\u{1F356}'}
          color="text-orange-400"
          bgColor="bg-orange-500"
        />
        <StatBar
          label="Happiness"
          value={happiness}
          icon={'\u{1F496}'}
          color="text-pink-400"
          bgColor="bg-pink-500"
        />
        <StatBar
          label="Energy"
          value={energy}
          icon={'\u{26A1}'}
          color="text-emerald-400"
          bgColor="bg-emerald-500"
        />
        {streakDays === 0 && (
          <Text className="text-xs text-neutral-500 mt-1">Visit daily to build a streak!</Text>
        )}
      </View>

      {/* Care Actions */}
      <View className="flex-row gap-3">
        <ActionButton
          icon={'\u{1F355}'}
          label="Feed"
          bgColor="bg-orange-500"
          onPress={feedPet}
          disabled={hunger >= 100}
        />
        <ActionButton
          icon={'\u{1F3AE}'}
          label="Play"
          bgColor="bg-pink-500"
          onPress={playWithPet}
          disabled={energy < 15}
        />
        <ActionButton
          icon={'\u{1F634}'}
          label="Rest"
          bgColor="bg-emerald-500"
          onPress={restPet}
          disabled={energy >= 100}
        />
      </View>
    </View>
  );
}
