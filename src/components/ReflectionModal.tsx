import { useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePetStore } from '../store/petStore';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_THRESHOLD = 120;

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
      className={`${bgColor} p-5 mb-4 flex-row items-center border-b-4 border-black/5`}
      style={{
        borderRadius: 18,
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
  const translateY = useSharedValue(0);

  const handleReflection = (action: () => void) => {
    action();
    onClose();
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD) {
        translateY.value = withSpring(SCREEN_HEIGHT, { damping: 20, stiffness: 200 });
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Reset position when modal opens
  useEffect(() => {
    if (visible) {
      translateY.value = 0;
    }
  }, [visible]);

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
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[{ backgroundColor: '#E8F4FA', borderTopLeftRadius: 50, borderTopRightRadius: 50, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48 }, animatedStyle]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              {/* Handle */}
              <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center mb-8" />

              {/* Header */}
              <View className="items-center mb-8">
                <LinearGradient
                  colors={['#4FB0C6', '#72C8DA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="w-20 h-20 rounded-3xl items-center justify-center mb-4 border border-white/40"
                >
                  <Text className="text-4xl">{'\u{1FA9E}'}</Text>
                </LinearGradient>
                <Text className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Reflect with {name}</Text>
                <Text className="text-sm font-bold text-gray-400 mt-1">How's your day going, hooman?</Text>
                <View className="bg-pet-purple-light/35 px-2.5 py-1 rounded-full mt-3">
                  <Text className="text-[10px] font-black text-pet-purple-dark">+20 XP reward</Text>
                </View>
              </View>

              {/* Options */}
              <ReflectionOption
                icon={'\u{2728}'}
                text="I'm crushed it!"
                description="Boosts happiness"
                bgColor="bg-pet-blue-light/40"
                onPress={() => handleReflection(reflectProductiveDay)}
              />
              <ReflectionOption
                icon={'\u{1F319}'}
                text="Need some Zzz's"
                description="Restores energy"
                bgColor="bg-pet-blue-light/30"
                onPress={() => handleReflection(reflectNeedRest)}
              />
              <ReflectionOption
                icon={'\u{1F49A}'}
                text="Feeling awesome"
                description="Boosts happy & energy"
                bgColor="bg-pet-blue-light/20"
                onPress={() => handleReflection(reflectFeelGood)}
              />

              {/* Cancel */}
              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.8}
                className="mt-4 py-5 bg-white rounded-[18px] border-2 border-gray-100 border-b-4"
              >
                <Text className="text-gray-400 text-center font-black uppercase tracking-widest">Maybe Later</Text>
              </TouchableOpacity>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </Pressable>
    </Modal>
  );
}
