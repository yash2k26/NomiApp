import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, AppState, Animated, GestureResponderEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
      className="absolute top-4 left-0 right-0 z-20 items-center"
    >
      <View
        className="bg-white px-5 py-3 rounded-2xl max-w-[85%]"
        style={{
          shadowColor: '#c084fc',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Text className="text-sm font-semibold text-neutral-700 text-center">{message}</Text>
      </View>
      <View
        style={{
          width: 0, height: 0,
          borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 8,
          borderLeftColor: 'transparent', borderRightColor: 'transparent',
          borderTopColor: '#ffffff',
          marginTop: -1,
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
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isExcited, isUrgent]);

  const bgColor = isExcited ? 'bg-amber-100' : isUrgent ? 'bg-red-100' : 'bg-violet-100';
  const textColor = isExcited ? 'text-amber-600' : isUrgent ? 'text-red-500' : 'text-violet-600';
  const dotColor = isExcited ? 'bg-amber-400' : isUrgent ? 'bg-red-400' : 'bg-emerald-400';

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <View className={`flex-row items-center px-4 py-2 rounded-full ${bgColor}`}>
        <View className={`w-2 h-2 rounded-full mr-2 ${dotColor}`} />
        <Text className={`text-sm font-semibold ${textColor}`}>{moodText}</Text>
      </View>
    </Animated.View>
  );
}

function QuickTip() {
  const tips = [
    'Double-tap Nomi to see a silly reaction!',
    'Swipe to rotate your pet in 3D',
    'Visit daily to build your streak!',
    'Reflect with Nomi to boost happiness',
    'Keep all stats above 95% for a surprise!',
  ];
  const [tip] = useState(() => tips[Math.floor(Math.random() * tips.length)]);

  return (
    <View className="mx-5 mt-2 mb-1">
      <Text className="text-xs text-violet-400 text-center italic">{tip}</Text>
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
  // onTouchStartCapture fires on the parent BEFORE the GL surface can eat the event.
  // This is the only reliable way to detect taps over a Canvas on Android.
  const lastTapRef = useRef(0);
  const lastTapXRef = useRef(0);
  const lastTapYRef = useRef(0);

  const handleTouchCapture = useCallback((e: GestureResponderEvent) => {
    const now = Date.now();
    const { pageX, pageY } = e.nativeEvent;
    const dx = Math.abs(pageX - lastTapXRef.current);
    const dy = Math.abs(pageY - lastTapYRef.current);

    // Two taps within 400ms and within 50px of each other = double-tap
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
    <View className="flex-1">
      <LinearGradient
        colors={['#f0e6ff', '#fce7f3', '#fef3c7', '#e0f2fe']}
        locations={[0, 0.35, 0.65, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        bounces={false}
      >
        {/* ===== HERO: Pet Display ===== */}
        {/* onTouchStartCapture fires in capture phase — before Canvas eats the event */}
        <View style={{ height: 380 }} onTouchStartCapture={handleTouchCapture}>
          {needMessage && !isExcitedBurst && <NeedBubble message={needMessage} />}
          <PetRenderer activeModel={activeModel} />

          <LinearGradient
            colors={['transparent', 'rgba(240,230,255,0.9)']}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 50, zIndex: 1 }}
          />
        </View>

        {/* ===== Pet Identity ===== */}
        <View className="items-center -mt-6 mb-5 z-10">
          <Text className="text-3xl font-extrabold text-violet-900 tracking-wide mb-2">{name}</Text>
          <MoodBadge moodText={moodText} isExcited={isExcitedBurst} isUrgent={!!needMessage} />
          {streakDays > 0 && (
            <View className="flex-row items-center mt-3 bg-orange-100 px-4 py-1.5 rounded-full">
              <Text className="text-sm">{'\u{1F525}'}</Text>
              <Text className="text-sm font-bold text-orange-500 ml-1.5">
                {streakDays > 1 ? `${streakDays}-day streak` : 'Day 1'}
              </Text>
            </View>
          )}
        </View>

        <QuickTip />

        <CareActions />

        {/* ===== Reflection Card ===== */}
        <View className="px-5 mt-6">
          <TouchableOpacity
            onPress={() => setReflectionModalVisible(true)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#ede9fe', '#fae8ff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="rounded-2xl p-5"
              style={{
                shadowColor: '#c084fc',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 3,
              }}
            >
              <View className="flex-row items-center">
                <View className="w-11 h-11 rounded-xl bg-violet-200 items-center justify-center mr-4">
                  <Text className="text-xl">{'\u{1FA9E}'}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-violet-800">Reflect with {name}</Text>
                  <Text className="text-xs text-violet-400 mt-0.5">Share how you're feeling today</Text>
                </View>
                <Text className="text-violet-300 text-lg">{'\u{203A}'}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <SkinSelector />
      </ScrollView>

      <ReflectionModal
        visible={reflectionModalVisible}
        onClose={() => setReflectionModalVisible(false)}
      />
    </View>
  );
}
