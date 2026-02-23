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
  bgColor: string;
  onPress: () => void;
}

function ReflectionOption({ icon, text, description, bgColor, onPress }: ReflectionOptionProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`${bgColor} rounded-2xl p-4 mb-3 flex-row items-center`}
      style={{
        shadowColor: '#c084fc',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      <View className="w-12 h-12 bg-white/80 rounded-full items-center justify-center mr-4">
        <Text className="text-2xl">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-neutral-800 mb-1">{text}</Text>
        <Text className="text-sm text-neutral-500">{description}</Text>
      </View>
      <Text className="text-violet-300 text-xl">{'\u{203A}'}</Text>
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
        className="flex-1 bg-black/30 justify-end"
        onPress={onClose}
      >
        <Pressable
          className="bg-white rounded-t-3xl px-5 pt-6 pb-10"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View className="w-10 h-1 bg-violet-200 rounded-full self-center mb-6" />

          {/* Header */}
          <View className="items-center mb-6">
            <Text className="text-2xl mb-2">{'\u{1FA9E}'}</Text>
            <Text className="text-xl font-bold text-violet-800">Reflect with {name}</Text>
            <Text className="text-sm text-neutral-400 mt-1">Share how you're feeling today</Text>
          </View>

          {/* Options */}
          <ReflectionOption
            icon={'\u{2728}'}
            text="I had a productive day"
            description="Boosts happiness"
            bgColor="bg-amber-50"
            onPress={() => handleReflection(reflectProductiveDay)}
          />
          <ReflectionOption
            icon={'\u{1F319}'}
            text="I need rest"
            description="Restores energy"
            bgColor="bg-indigo-50"
            onPress={() => handleReflection(reflectNeedRest)}
          />
          <ReflectionOption
            icon={'\u{1F49A}'}
            text="I feel good today"
            description="Boosts happiness & energy"
            bgColor="bg-emerald-50"
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
