import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, AppState, Animated } from 'react-native';
import { usePetStore, getPetNeeds } from '../store/petStore';
import { PetRenderer, CareActions, ReflectionModal, SkinSelector } from '../components';

function NeedBubble({ message }: { message: string }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(bounceAnim, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [message]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ scale: bounceAnim }],
      }}
      className="absolute top-2 left-0 right-0 z-10 items-center"
    >
      <View className="bg-white/95 px-5 py-3 rounded-2xl max-w-[85%]"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <Text className="text-sm font-semibold text-neutral-800 text-center">{message}</Text>
      </View>
      {/* Little triangle pointing down */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 8,
          borderRightWidth: 8,
          borderTopWidth: 8,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: 'rgba(255,255,255,0.95)',
          marginTop: -1,
        }}
      />
    </Animated.View>
  );
}

export function HomeScreen() {
  const [reflectionModalVisible, setReflectionModalVisible] = useState(false);
  const { name, skin, hunger, happiness, energy, getMoodText, getMood, tick, isExcitedBurst, clearExcitedBurst } = usePetStore();
  const mood = getMood();
  const moodText = getMoodText();
  const needMessage = getPetNeeds(hunger, happiness, energy);

  // Run stat decay on mount and whenever app returns to foreground
  useEffect(() => {
    tick();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => sub.remove();
  }, []);

  // Excited burst timer — show excited.glb for 5 seconds then revert
  useEffect(() => {
    if (!isExcitedBurst) return;
    const timer = setTimeout(() => {
      clearExcitedBurst();
    }, 5000);
    return () => clearTimeout(timer);
  }, [isExcitedBurst]);

  return (
    <View className="flex-1 bg-neutral-900">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* SECTION 1: Pet Hero Section */}
        <View className="h-80">
          {/* Speech bubble when pet needs something */}
          {needMessage && !isExcitedBurst && (
            <NeedBubble message={needMessage} />
          )}
          <PetRenderer skin={skin} mood={mood} />
        </View>

        {/* Pet Name & Mood */}
        <View className="items-center -mt-4 mb-4">
          <Text className="text-2xl font-bold text-white mb-1">{name}</Text>
          <View className={`flex-row items-center px-4 py-2 rounded-full ${
            isExcitedBurst ? 'bg-yellow-500/20' :
            needMessage ? 'bg-red-500/15' :
            'bg-neutral-800/60'
          }`}>
            <Text className={`text-sm ${
              isExcitedBurst ? 'text-yellow-300 font-bold' :
              needMessage ? 'text-red-300' :
              'text-neutral-300'
            }`}>{moodText}</Text>
          </View>
        </View>

        {/* SECTION 2 & 3: Pet Status & Care Actions */}
        <CareActions />

        {/* SECTION 4: Self Reflection */}
        <View className="px-5 mt-6">
          <View className="bg-violet-500/10 rounded-2xl p-5 border border-violet-500/30">
            <View className="flex-row items-center mb-3">
              <Text className="text-2xl mr-3">{'\u{1FA9E}'}</Text>
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
