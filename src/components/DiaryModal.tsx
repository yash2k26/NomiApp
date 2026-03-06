import { useEffect } from 'react';
import { View, Text, ScrollView, Modal, Pressable, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePersonalityStore, type DiaryEntry } from '../store/personalityStore';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_THRESHOLD = 120;

function getMoodIcon(mood: string): string {
  if (mood.includes('excited') || mood.includes('happy')) return 'emoticon-happy-outline';
  if (mood.includes('sad') || mood.includes('lonely')) return 'emoticon-sad-outline';
  if (mood.includes('hungry') || mood.includes('starving')) return 'food-outline';
  if (mood.includes('tired') || mood.includes('exhausted')) return 'sleep';
  return 'weather-night';
}

function getTimeLabel(timeOfDay: string): string {
  if (timeOfDay === 'morning') return 'Morning';
  if (timeOfDay === 'afternoon') return 'Afternoon';
  if (timeOfDay === 'evening') return 'Evening';
  return 'Night';
}

function DiaryPage({ entry }: { entry: DiaryEntry }) {
  const isNew = !entry.read;

  return (
    <View
      className={`rounded-[24px] mb-4 overflow-hidden border ${isNew ? 'border-pet-blue/50' : 'border-pet-blue-light/70'}`}
      style={{
        shadowColor: '#2E6E93',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View className="bg-white px-4 py-3 border-b border-pet-blue-light/60 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Text className="text-[11px] text-pet-blue-dark font-bold">{getTimeLabel(entry.timeOfDay)}</Text>
          <Text className="text-[10px] text-pet-blue/70 mx-1.5">{'\u2022'}</Text>
          <Text className="text-[11px] text-pet-blue-dark/80 font-semibold">{entry.date}</Text>
        </View>
        <View className="flex-row items-center">
          {isNew && (
            <View className="bg-pet-blue px-2.5 py-0.5 rounded-full mr-2">
              <Text className="text-[9px] font-black text-white">NEW</Text>
            </View>
          )}
          <View className="w-6 h-6 rounded-full bg-pet-blue-light/40 items-center justify-center">
            <MaterialCommunityIcons name={getMoodIcon(entry.mood) as never} size={14} color="#2F7CA7" />
          </View>
        </View>
      </View>

      <LinearGradient
        colors={['#FFFFFF', '#F8FCFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="px-4 py-4"
      >
        <View className="absolute left-6 top-0 bottom-0 w-[1px] bg-pet-blue-light/60" />
        <View className="absolute left-0 right-0 top-8 h-[1px] bg-pet-blue-light/45" />
        <View className="absolute left-0 right-0 top-16 h-[1px] bg-pet-blue-light/45" />
        <View className="absolute left-0 right-0 top-24 h-[1px] bg-pet-blue-light/45" />
        <View className="absolute left-0 right-0 top-32 h-[1px] bg-pet-blue-light/45" />

        <View className="pl-8">
          <Text className="text-[13px] leading-6 text-pet-blue-dark font-medium italic">
            {entry.text}
          </Text>
          <View className="flex-row mt-3">
            <View className="px-2.5 py-1 rounded-full bg-pet-blue-light/35 border border-pet-blue-light/75 mr-2">
              <Text className="text-[10px] font-bold text-pet-blue-dark">H {Math.round(entry.statsSnapshot.hunger)}%</Text>
            </View>
            <View className="px-2.5 py-1 rounded-full bg-pet-blue-light/35 border border-pet-blue-light/75 mr-2">
              <Text className="text-[10px] font-bold text-pet-blue-dark">M {Math.round(entry.statsSnapshot.happiness)}%</Text>
            </View>
            <View className="px-2.5 py-1 rounded-full bg-pet-blue-light/35 border border-pet-blue-light/75">
              <Text className="text-[10px] font-bold text-pet-blue-dark">E {Math.round(entry.statsSnapshot.energy)}%</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

interface DiaryModalProps {
  visible: boolean;
  onClose: () => void;
}

export function DiaryModal({ visible, onClose }: DiaryModalProps) {
  const { diaryEntries, markDiaryRead } = usePersonalityStore();
  const translateY = useSharedValue(0);

  const handleClose = () => {
    markDiaryRead();
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
        runOnJS(handleClose)();
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable className="flex-1 bg-[#0B2238]/35 justify-end" onPress={handleClose}>
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[{ backgroundColor: '#E8F4FA', borderTopLeftRadius: 34, borderTopRightRadius: 34, maxHeight: '88%', overflow: 'hidden' }, animatedStyle]}
          >
            {/* Drag handle */}
            <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center mt-3 mb-1" />

            <LinearGradient
              colors={['#4D9BC7', '#6EB4DA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="px-5 py-4 flex-row items-center justify-between"
            >
              <View className="flex-row items-center">
                <View className="w-11 h-11 rounded-2xl bg-white/20 border border-white/35 items-center justify-center mr-3">
                  <MaterialCommunityIcons name="notebook-outline" size={22} color="#ffffff" />
                </View>
                <View>
                  <Text className="text-white text-sm font-black tracking-[0.7px] uppercase">Nomi Diary</Text>
                  <Text className="text-white/80 text-[10px] font-semibold">{diaryEntries.length} entries saved</Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleClose} activeOpacity={0.8}>
                <MaterialCommunityIcons name="close" size={22} color="#ffffff" />
              </TouchableOpacity>
            </LinearGradient>

            <View className="px-5 pt-4 pb-2">
              <View className="bg-white rounded-2xl border border-pet-blue-light/70 px-4 py-2.5 flex-row items-center">
                <MaterialCommunityIcons name="book-open-page-variant-outline" size={16} color="#2F7CA7" />
                <Text className="text-[11px] font-semibold text-pet-blue-dark ml-2">
                  Nomi writes here while you are away.
                </Text>
              </View>
            </View>

            <ScrollView className="px-5 pt-3" contentContainerStyle={{ paddingBottom: 38 }} showsVerticalScrollIndicator={false}>
              {diaryEntries.length > 0 ? (
                diaryEntries.map((entry) => (
                  <DiaryPage key={entry.id} entry={entry} />
                ))
              ) : (
                <View className="items-center py-12 bg-white rounded-[24px] border border-pet-blue-light/70">
                  <MaterialCommunityIcons name="notebook-outline" size={38} color="#6EA5C8" />
                  <Text className="text-[15px] font-black text-pet-blue-dark mt-3">No entries yet</Text>
                  <Text className="text-[12px] text-pet-blue-dark/75 font-medium mt-1 text-center px-6">
                    Stay away for a while and Nomi will write the first page.
                  </Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </GestureDetector>
      </Pressable>
    </Modal>
  );
}
