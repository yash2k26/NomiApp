import { View, Text, ScrollView, Modal, Pressable, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePersonalityStore, type DiaryEntry } from '../store/personalityStore';

function getMoodEmoji(mood: string): string {
  if (mood.includes('excited') || mood.includes('happy')) return '\u{1F60A}';
  if (mood.includes('sad') || mood.includes('lonely')) return '\u{1F622}';
  if (mood.includes('hungry') || mood.includes('starving')) return '\u{1F924}';
  if (mood.includes('tired') || mood.includes('exhausted')) return '\u{1F634}';
  return '\u{1F60C}';
}

function getMoodColor(mood: string): string {
  if (mood.includes('excited') || mood.includes('happy')) return 'bg-pet-green';
  if (mood.includes('sad') || mood.includes('lonely')) return 'bg-pet-blue';
  if (mood.includes('hungry')) return 'bg-pet-orange';
  if (mood.includes('tired')) return 'bg-pet-purple';
  return 'bg-pet-blue-light';
}

function getTimeLabel(timeOfDay: string): string {
  if (timeOfDay === 'morning') return '\u{2600}\u{FE0F} Morning';
  if (timeOfDay === 'afternoon') return '\u{1F324}\u{FE0F} Afternoon';
  if (timeOfDay === 'evening') return '\u{1F305} Evening';
  return '\u{1F31F} Night';
}

function DiaryPage({ entry, index }: { entry: DiaryEntry; index: number }) {
  const isNew = !entry.read;

  return (
    <View
      className={`bg-white rounded-[24px] mb-4 overflow-hidden border ${isNew ? 'border-pet-blue/40' : 'border-gray-100'}`}
      style={{
        shadowColor: isNew ? '#4FB0C6' : '#22314A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isNew ? 0.12 : 0.05,
        shadowRadius: 10,
        elevation: isNew ? 4 : 2,
      }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <View className="flex-row items-center">
          <Text className="text-[11px] text-gray-400 font-semibold">{getTimeLabel(entry.timeOfDay)}</Text>
          <Text className="text-[10px] text-gray-300 mx-1.5">{'\u2022'}</Text>
          <Text className="text-[11px] text-gray-400 font-semibold">{entry.date}</Text>
        </View>
        <View className="flex-row items-center">
          {isNew && (
            <View className="bg-pet-blue px-2 py-0.5 rounded-full mr-2">
              <Text className="text-[8px] font-black text-white">NEW</Text>
            </View>
          )}
          <View className={`w-5 h-5 rounded-full ${getMoodColor(entry.mood)} items-center justify-center`}>
            <Text className="text-[10px]">{getMoodEmoji(entry.mood)}</Text>
          </View>
        </View>
      </View>

      {/* Body */}
      <View className="px-4 py-4">
        {/* Illustration */}
        <View className="items-center mb-3">
          <View className="bg-pet-blue-light/15 rounded-2xl px-6 py-3 border border-pet-blue-light/30">
            <Text className="text-3xl tracking-[8px]">{entry.illustration}</Text>
          </View>
        </View>

        {/* Diary text */}
        <Text className="text-[13px] leading-5 text-gray-700 font-medium text-center" style={{ fontStyle: 'italic' }}>
          "{entry.text}"
        </Text>

        {/* Stats snapshot */}
        <View className="flex-row justify-center mt-3 gap-3">
          <View className="flex-row items-center">
            <Text className="text-[10px] mr-0.5">{'\u{1F356}'}</Text>
            <Text className="text-[10px] font-bold text-gray-400">{Math.round(entry.statsSnapshot.hunger)}%</Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-[10px] mr-0.5">{'\u{1F496}'}</Text>
            <Text className="text-[10px] font-bold text-gray-400">{Math.round(entry.statsSnapshot.happiness)}%</Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-[10px] mr-0.5">{'\u26A1'}</Text>
            <Text className="text-[10px] font-bold text-gray-400">{Math.round(entry.statsSnapshot.energy)}%</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

interface DiaryModalProps {
  visible: boolean;
  onClose: () => void;
}

export function DiaryModal({ visible, onClose }: DiaryModalProps) {
  const { diaryEntries, markDiaryRead } = usePersonalityStore();

  const handleClose = () => {
    markDiaryRead();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable className="flex-1 bg-black/40 justify-end" onPress={handleClose}>
        <Pressable className="bg-pet-background rounded-t-[32px] max-h-[85%]" onPress={() => {}}>
          {/* Header */}
          <LinearGradient
            colors={['#4FB0C6', '#67BEE4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="px-5 py-4 rounded-t-[32px] flex-row items-center justify-between"
          >
            <View className="flex-row items-center">
              <Text className="text-xl mr-2">{'\u{1F4D6}'}</Text>
              <View>
                <Text className="text-white text-sm font-black tracking-[0.8px] uppercase">Nomi's Diary</Text>
                <Text className="text-white/70 text-[10px] font-semibold">{diaryEntries.length} {diaryEntries.length === 1 ? 'entry' : 'entries'} · Last 7 kept</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.8}>
              <MaterialCommunityIcons name="close" size={22} color="#ffffff" />
            </TouchableOpacity>
          </LinearGradient>

          {/* Content */}
          <ScrollView className="px-5 pt-4" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {diaryEntries.length > 0 ? (
              diaryEntries.map((entry, idx) => (
                <DiaryPage key={entry.id} entry={entry} index={idx} />
              ))
            ) : (
              <View className="items-center py-12">
                <Text className="text-4xl mb-3">{'\u{1F4D3}'}</Text>
                <Text className="text-[15px] font-black text-gray-600">No entries yet</Text>
                <Text className="text-[12px] text-gray-400 font-semibold mt-1 text-center">
                  Nomi writes diary entries when you're away.{'\n'}Check back after being gone for 2+ hours!
                </Text>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
