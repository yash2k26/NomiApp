import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import { usePetStore } from '../store/petStore';

interface ReflectionModalProps {
  visible: boolean;
  onClose: () => void;
}

interface ReflectionOptionProps {
  icon: string;
  text: string;
  description: string;
  onPress: () => void;
}

function ReflectionOption({ icon, text, description, onPress }: ReflectionOptionProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="bg-neutral-800 rounded-2xl p-4 mb-3 flex-row items-center"
    >
      <View className="w-12 h-12 bg-neutral-700 rounded-full items-center justify-center mr-4">
        <Text className="text-2xl">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-white mb-1">{text}</Text>
        <Text className="text-sm text-neutral-400">{description}</Text>
      </View>
      <Text className="text-neutral-500 text-xl">›</Text>
    </TouchableOpacity>
  );
}

export function ReflectionModal({ visible, onClose }: ReflectionModalProps) {
  const { reflectProductiveDay, reflectNeedRest, reflectFeelGood, name } = usePetStore();

  const handleReflection = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable 
        className="flex-1 bg-black/60 justify-end"
        onPress={onClose}
      >
        <Pressable 
          className="bg-neutral-900 rounded-t-3xl px-5 pt-6 pb-10"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View className="w-10 h-1 bg-neutral-600 rounded-full self-center mb-6" />
          
          {/* Header */}
          <View className="items-center mb-6">
            <Text className="text-2xl mb-2">🪞</Text>
            <Text className="text-xl font-bold text-white">Reflect with {name}</Text>
            <Text className="text-sm text-neutral-400 mt-1">Share how you're feeling today</Text>
          </View>

          {/* Options */}
          <ReflectionOption
            icon="✨"
            text="I had a productive day"
            description="Boosts happiness"
            onPress={() => handleReflection(reflectProductiveDay)}
          />
          <ReflectionOption
            icon="🌙"
            text="I need rest"
            description="Restores energy"
            onPress={() => handleReflection(reflectNeedRest)}
          />
          <ReflectionOption
            icon="💚"
            text="I feel good today"
            description="Boosts happiness & energy"
            onPress={() => handleReflection(reflectFeelGood)}
          />

          {/* Cancel */}
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            className="mt-3 py-4"
          >
            <Text className="text-neutral-400 text-center font-semibold">Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
