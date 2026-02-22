import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { usePetStore } from '../store/petStore';
import { PetRenderer, CareActions, ReflectionModal, SkinSelector } from '../components';

export function HomeScreen() {
  const [reflectionModalVisible, setReflectionModalVisible] = useState(false);
  const { name, skin, getMoodText } = usePetStore();
  const moodText = getMoodText();

  return (
    <View className="flex-1 bg-neutral-900">
      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* SECTION 1: Pet Hero Section */}
        <View className="h-80">
          <PetRenderer skin={skin} />
        </View>
        
        {/* Pet Name & Mood */}
        <View className="items-center -mt-4 mb-4">
          <Text className="text-2xl font-bold text-white mb-1">{name}</Text>
          <View className="flex-row items-center bg-neutral-800/60 px-4 py-2 rounded-full">
            <Text className="text-sm text-neutral-300">{moodText}</Text>
          </View>
        </View>

        {/* SECTION 2 & 3: Pet Status & Care Actions */}
        <CareActions />

        {/* SECTION 4: Self Reflection */}
        <View className="px-5 mt-6">
          <View className="bg-violet-500/10 rounded-2xl p-5 border border-violet-500/30">
            <View className="flex-row items-center mb-3">
              <Text className="text-2xl mr-3">🪞</Text>
              <View>
                <Text className="text-base font-semibold text-white">Reflect with {name}</Text>
                <Text className="text-xs text-neutral-400">Share how you're feeling today</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setReflectionModalVisible(true)}
              activeOpacity={0.8}
              className="bg-violet-500 py-3 rounded-xl items-center mt-2"
            >
              <Text className="text-white font-bold">Reflect</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION 5: Skin Quick Access */}
        <SkinSelector />
      </ScrollView>

      {/* Reflection Modal */}
      <ReflectionModal 
        visible={reflectionModalVisible} 
        onClose={() => setReflectionModalVisible(false)} 
      />
    </View>
  );
}
