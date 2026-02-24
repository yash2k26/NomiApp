import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, AppState, Animated, GestureResponderEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { usePetStore, getPetNeeds } from '../store/petStore';
import { PetRenderer, CareActions, ReflectionModal, SkinSelector, type ActiveModel } from '../components';

const FALLING_DURATION = 3000;

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
      style={{ opacity: fadeAnim, transform: [{ scale: bounceAnim }] }}
      className="absolute top-8 left-0 right-0 z-20 items-center px-6"
    >
      <View
        className="bg-white px-6 py-4 rounded-3xl border-4 border-pet-blue-light"
        style={{
          shadowColor: '#4FB0C6',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        <Text className="text-base font-bold text-gray-800 text-center">{message}</Text>
      </View>
      <View
        style={{
          width: 0, height: 0,
          borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 10,
          borderLeftColor: 'transparent', borderRightColor: 'transparent',
          borderTopColor: '#ffffff',
          marginTop: -2,
        }}
      />
    </Animated.View>
  );
}

function MoodBadge({ moodText, isExcited, isUrgent }: { moodText: string; isExcited: boolean; isUrgent: boolean }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isExcited || isUrgent) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isExcited, isUrgent]);

  const bgColor = isExcited ? 'bg-pet-yellow' : isUrgent ? 'bg-pet-pink' : 'bg-pet-green';
  const borderColor = isExcited ? 'border-pet-yellow-dark' : isUrgent ? 'border-pet-pink-dark' : 'border-pet-green-dark';
  const textColor = 'text-white';

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <View className={`flex-row items-center px-6 py-2 rounded-full ${bgColor} border-b-4 ${borderColor}`}>
        <Text className={`text-sm font-black uppercase tracking-wider ${textColor}`}>{moodText}</Text>
      </View>
    </Animated.View>
  );
}

function QuickTip() {
  const tips = [
    'Double-tap Nomi to see a silly reaction! ✨',
    'Swipe to rotate your pet in 3D 🔄',
    'Visit daily to build your streak! 🔥',
    'Reflect with Nomi to boost happiness 🫧',
    'Keep all stats above 95% for a surprise! 🎁',
  ];
  const [tip] = useState(() => tips[Math.floor(Math.random() * tips.length)]);

  return (
    <View className="mx-6 mt-4 mb-2 bg-white rounded-2xl px-5 py-3 border border-gray-100 shadow-sm">
      <Text className="text-xs text-gray-500 text-center font-bold"> TIP: <Text className="text-pet-purple font-medium">{tip}</Text></Text>
    </View>
  );
}

export function HomeScreen() {
  const [reflectionModalVisible, setReflectionModalVisible] = useState(false);
  const [isFalling, setIsFalling] = useState(false);
  const { name, hunger, happiness, energy, getMoodText, getMood, tick, isExcitedBurst, clearExcitedBurst, triggerExcitedBurst, streakDays } = usePetStore();
  const mood = getMood();
  const moodText = getMoodText();
  const needMessage = getPetNeeds(hunger, happiness, energy);

  // Compute which model to show — priority: falling > excited > sad > breathing
  const anySadStat = hunger < 50 || happiness < 50 || energy < 50;
  const activeModel: ActiveModel = isFalling
    ? 'falling'
    : isExcitedBurst
      ? 'excited'
      : anySadStat
        ? 'sad'
        : 'breathing';

  // ── Stat decay on mount & foreground ──
  useEffect(() => {
    tick();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => sub.remove();
  }, []);

  // ── Trigger excited burst when all stats hit 95%+ (covers hydration & live updates) ──
  useEffect(() => {
    if (!isExcitedBurst && hunger >= 95 && happiness >= 95 && energy >= 95) {
      triggerExcitedBurst();
    }
  }, [hunger, happiness, energy, isExcitedBurst]);

  // ── Auto-clear excited burst after 4 seconds ──
  useEffect(() => {
    if (!isExcitedBurst) return;
    const timer = setTimeout(() => clearExcitedBurst(), 4000);
    return () => clearTimeout(timer);
  }, [isExcitedBurst]);


  // ── Double-tap detection via capture phase ──
  const lastTapRef = useRef(0);
  const lastTapXRef = useRef(0);
  const lastTapYRef = useRef(0);

  const handleTouchCapture = useCallback((e: GestureResponderEvent) => {
    const now = Date.now();
    const { pageX, pageY } = e.nativeEvent;
    const dx = Math.abs(pageX - lastTapXRef.current);
    const dy = Math.abs(pageY - lastTapYRef.current);

    if (now - lastTapRef.current < 400 && dx < 50 && dy < 50) {
      if (!isFalling) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setIsFalling(true);
      }
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      lastTapXRef.current = pageX;
      lastTapYRef.current = pageY;
    }
  }, [isFalling]);

  // ── Auto-revert falling after animation plays once ──
  useEffect(() => {
    if (!isFalling) return;
    const timer = setTimeout(() => setIsFalling(false), FALLING_DURATION);
    return () => clearTimeout(timer);
  }, [isFalling]);

  return (
    <View className="flex-1 bg-pet-background">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        bounces={true}
      >
        {/* ===== HERO: Pet Display ===== */}
        <View
          className="bg-pet-blue-light/30 rounded-b-[60px]"
          style={{ height: 420 }}
          onTouchStartCapture={handleTouchCapture}
        >
          <View className="absolute inset-0 bg-white/20 rounded-b-[60px]" />
          {needMessage && !isExcitedBurst && <NeedBubble message={needMessage} />}
          <PetRenderer activeModel={activeModel} />
        </View>

        {/* ===== Pet Identity ===== */}
        <View className="items-center -mt-16 mb-6 z-10 px-6">
          <View className="bg-white rounded-5xl w-full px-8 py-6 items-center border-[6px] border-pet-blue-light shadow-xl" style={{
            shadowColor: '#4FB0C6',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 12,
          }}>
            <Text className="text-3xl font-black text-gray-800 mb-3 tracking-tight">{name}</Text>
            <View className="flex-row gap-2">
              <MoodBadge moodText={moodText} isExcited={isExcitedBurst} isUrgent={!!needMessage} />
              {streakDays > 0 && (
                <View className="flex-row items-center bg-pet-yellow px-4 py-2 rounded-full border-b-4 border-pet-yellow-dark">
                  <Text className="text-xs font-black text-white uppercase tracking-widest">
                    🔥 {streakDays > 1 ? `${streakDays} DAYS` : 'DAY 1'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>


        <QuickTip />

        <CareActions />

        {/* ===== Reflection Card ===== */}
        <View className="px-6 mt-6">
          <TouchableOpacity
            onPress={() => setReflectionModalVisible(true)}
            activeOpacity={0.9}
          >
            <View
              className="bg-pet-purple rounded-4xl p-6 border-b-[6px] border-pet-purple-dark"
              style={{
                shadowColor: '#9381FF',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <View className="flex-row items-center">
                <View className="w-14 h-14 rounded-2xl bg-white/20 items-center justify-center mr-4 border border-white/30">
                  <Text className="text-3xl">{'\u{1FA9E}'}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-black text-white uppercase tracking-wide">Reflect with {name}</Text>
                  <Text className="text-sm text-pet-purple-light font-bold mt-0.5">Share how you're feeling! ✨</Text>
                </View>
                <View className="w-10 h-10 rounded-full bg-black/10 items-center justify-center">
                  <Text className="text-white text-xl font-black">{'\u{203A}'}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View className="mt-8 mb-4">
          <View className="px-6 mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-black text-gray-800 uppercase tracking-widest">Outfits</Text>
            <View className="bg-pet-blue-light/20 px-3 py-1 rounded-full">
              <Text className="text-xs font-black text-pet-blue-dark">SHOP</Text>
            </View>
          </View>
          <SkinSelector />
        </View>
      </ScrollView>

      <ReflectionModal
        visible={reflectionModalVisible}
        onClose={() => setReflectionModalVisible(false)}
      />
    </View>
  );
}

