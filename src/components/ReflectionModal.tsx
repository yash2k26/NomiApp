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
      activeOpacity={0.8}
      className={`${bgColor} rounded-4xl p-5 mb-4 flex-row items-center border-b-4 border-black/5`}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View className="w-14 h-14 bg-white rounded-2xl items-center justify-center mr-4 shadow-sm">
        <Text className="text-3xl">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-black text-gray-800 mb-0.5 uppercase tracking-tight">{text}</Text>
        <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest">{description}</Text>
      </View>
      <View className="w-8 h-8 rounded-full bg-black/5 items-center justify-center">
        <Text className="text-gray-400 text-xl font-black">{'\u{203A}'}</Text>
      </View>
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
        className="flex-1 bg-black/40 justify-end"
        onPress={onClose}
      >
        <Pressable
          className="bg-pet-background rounded-t-[50px] px-6 pt-6 pb-12"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center mb-8" />

          {/* Header */}
          <View className="items-center mb-8">
            <View className="w-20 h-20 bg-pet-purple rounded-3xl items-center justify-center mb-4 border-b-[6px] border-pet-purple-dark">
              <Text className="text-4xl">{'\u{1FA9E}'}</Text>
            </View>
            <Text className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Reflect with {name}</Text>
            <Text className="text-sm font-bold text-gray-400 mt-1">How's your day going, hooman?</Text>
          </View>

          {/* Options */}
          <ReflectionOption
            icon={'\u{2728}'}
            text="I'm crushed it!"
            description="Boosts happiness"
            bgColor="bg-pet-yellow/20"
            onPress={() => handleReflection(reflectProductiveDay)}
          />
          <ReflectionOption
            icon={'\u{1F319}'}
            text="Need some Zzz's"
            description="Restores energy"
            bgColor="bg-pet-blue/20"
            onPress={() => handleReflection(reflectNeedRest)}
          />
          <ReflectionOption
            icon={'\u{1F49A}'}
            text="Feeling awesome"
            description="Boosts happy & energy"
            bgColor="bg-pet-green/20"
            onPress={() => handleReflection(reflectFeelGood)}
          />

          {/* Cancel */}
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.8}
            className="mt-4 py-5 bg-white rounded-3xl border-2 border-gray-100 border-b-4"
          >
            <Text className="text-gray-400 text-center font-black uppercase tracking-widest">Maybe Later</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

