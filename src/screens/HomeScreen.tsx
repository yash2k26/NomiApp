import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, AppState, Animated, GestureResponderEvent, Modal, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePetStore, getPetNeeds } from '../store/petStore';
import { PetRenderer, CareActions, ReflectionModal, SkinSelector, type ActiveModel } from '../components';

const FALLING_DURATION = 3000;

function NeedBubble({ message }: { message: string }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.spring(bounceAnim, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bounceAnim, fadeAnim, message]);

  return (
    <Animated.View
      style={{ opacity: fadeAnim, transform: [{ scale: bounceAnim }] }}
      className="absolute top-8 left-0 right-0 z-20 items-center px-6"
    >
      <View
        className="bg-white px-5 py-3.5 rounded-2xl border border-pet-blue-light/70"
        style={{
          shadowColor: '#4FB0C6',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.16,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        <Text className="text-[13px] font-semibold text-gray-700 text-center">{message}</Text>
      </View>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 8,
          borderRightWidth: 8,
          borderTopWidth: 8,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: '#ffffff',
          marginTop: -1,
        }}
      />
    </Animated.View>
  );
}

function SkyCloud({ className = '' }: { className?: string }) {
  return (
    <View className={`absolute ${className}`}>
      <View className="w-14 h-9 rounded-full bg-white/85" />
      <View className="w-9 h-9 rounded-full bg-white/85 absolute -top-2 left-4" />
      <View className="w-8 h-8 rounded-full bg-white/85 absolute top-0 left-9" />
    </View>
  );
}

function MoodBadge({ moodText, isExcited, isUrgent }: { moodText: string; isExcited: boolean; isUrgent: boolean }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isExcited || isUrgent) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 560, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 560, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isExcited, isUrgent, pulseAnim]);

  const bgColor = isExcited ? 'bg-pet-blue-dark' : isUrgent ? 'bg-pet-blue' : 'bg-pet-blue';
  const borderColor = 'border-pet-blue-dark';

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <View className={`px-4 py-2 rounded-full border ${bgColor} ${borderColor}`}>
        <Text className="text-[12px] font-semibold text-white">{moodText}</Text>
      </View>
    </Animated.View>
  );
}

function HelpModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const tips = [
    'Swipe on Nomi to rotate and inspect the 3D model.',
    'Hit 100% on all bars to trigger a one-time celebration dance.',
    'Double-tap Nomi to trigger the fall reaction.',
    'Daily check-ins build streak and add bonus happiness.',
    'Use reflection when happiness drops to recover faster.',
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40 justify-center px-6" onPress={onClose}>
        <Pressable
          className="bg-white rounded-3xl border border-pet-blue-light/60 overflow-hidden"
          onPress={() => { }}
        >
          <View className="bg-pet-blue px-5 py-4 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color="#ffffff" />
              <Text className="text-white text-sm font-black tracking-[0.8px] uppercase ml-2">Help & Tips</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.8}>
              <MaterialCommunityIcons name="close" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
          <View className="px-5 py-4">
            {tips.map((tip) => (
              <View key={tip} className="flex-row mb-3 last:mb-0">
                <Text className="text-pet-blue-dark mr-2">{'\u2022'}</Text>
                <Text className="text-[13px] text-gray-700 flex-1">{tip}</Text>
              </View>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function StreakCalendarModal({
  visible,
  onClose,
  streakDays,
}: {
  visible: boolean;
  onClose: () => void;
  streakDays: number;
}) {
  const today = new Date();
  const month = today.toLocaleString('default', { month: 'long' });
  const year = today.getFullYear();
  const first = new Date(year, today.getMonth(), 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, today.getMonth() + 1, 0).getDate();
  const highlighted = new Set<number>();

  for (let i = 0; i < streakDays; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (d.getMonth() === today.getMonth() && d.getFullYear() === year) {
      highlighted.add(d.getDate());
    }
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40 justify-center px-6" onPress={onClose}>
        <Pressable className="bg-white rounded-3xl border border-pet-blue-light/60 overflow-hidden" onPress={() => { }}>
          <View className="bg-pet-blue px-5 py-4 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Text className="text-xl mr-2">{'\u{1F4C5}'}</Text>
              <Text className="text-white text-sm font-black tracking-[0.8px] uppercase">Streak Calendar</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.8}>
              <MaterialCommunityIcons name="close" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <View className="px-5 py-4">
            <Text className="text-center text-gray-800 font-black text-base mb-1">{month} {year}</Text>
            <Text className="text-center text-gray-500 text-xs mb-4">
              Current streak: <Text className="font-bold text-pet-blue-dark">{Math.max(streakDays, 0)} day{streakDays === 1 ? '' : 's'}</Text>
            </Text>

            <View className="flex-row justify-between mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
                <Text key={d} className="w-8 text-center text-[11px] font-bold text-gray-400">{d}</Text>
              ))}
            </View>

            <View className="flex-row flex-wrap">
              {cells.map((d, idx) => {
                const isToday = d === today.getDate();
                const isOnStreak = d !== null && highlighted.has(d);
                return (
                  <View key={`${d ?? 'x'}-${idx}`} className="items-center py-1" style={{ width: '14.2857%' }}>
                    <View className={`w-8 h-8 rounded-full items-center justify-center ${isOnStreak ? 'bg-pet-blue' : 'bg-transparent'} ${isToday ? 'border border-pet-blue-dark' : ''}`}>
                      <Text className={`text-[12px] ${isOnStreak ? 'text-white font-black' : 'text-gray-500'}`}>
                        {d ?? ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function HomeScreen() {
  const [reflectionModalVisible, setReflectionModalVisible] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [streakVisible, setStreakVisible] = useState(false);
  const [showParty, setShowParty] = useState(false);
  const [isFalling, setIsFalling] = useState(false);
  const partyAnim = useRef(new Animated.Value(0)).current;
  const prevStreakRef = useRef(0);
  const prevAllHighRef = useRef(false);

  const {
    name,
    hunger,
    happiness,
    energy,
    getMoodText,
    tick,
    isExcitedBurst,
    clearExcitedBurst,
    triggerExcitedBurst,
    streakDays,
    skin,
    setSkin,
  } = usePetStore();

  const moodText = getMoodText();
  const needMessage = getPetNeeds(hunger, happiness, energy);

  const shownHunger = Math.round(hunger);
  const shownHappiness = Math.round(happiness);
  const shownEnergy = Math.round(energy);

  const anySadStat = shownHunger < 50 || shownHappiness < 50 || shownEnergy < 50;
  const allHighStats = shownHunger >= 100 && shownHappiness >= 100 && shownEnergy >= 100;

  const activeModel: ActiveModel = isFalling
    ? 'falling'
    : isExcitedBurst
      ? 'excited'
      : anySadStat
        ? 'sad'
        : skin === 'headphones'
          ? 'dancing'
          : 'breathing';

  useEffect(() => {
    tick();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => sub.remove();
  }, [tick]);

  useEffect(() => {
    if (!prevAllHighRef.current && allHighStats) {
      triggerExcitedBurst();
    }
    prevAllHighRef.current = allHighStats;
  }, [allHighStats, triggerExcitedBurst]);

  // Auto-deselect headphones if any stat drops to 50% or below
  useEffect(() => {
    if (skin === 'headphones' && anySadStat) {
      setSkin('default');
    }
  }, [skin, anySadStat, setSkin]);

  useEffect(() => {
    if (streakDays > prevStreakRef.current) {
      setShowParty(true);
      partyAnim.setValue(0);
      Animated.timing(partyAnim, {
        toValue: 1,
        duration: 1300,
        useNativeDriver: true,
      }).start(() => setShowParty(false));
    }
    prevStreakRef.current = streakDays;
  }, [streakDays, partyAnim]);

  const lastTapRef = useRef(0);
  const lastTapXRef = useRef(0);
  const lastTapYRef = useRef(0);

  const handleTouchCapture = useCallback((e: GestureResponderEvent) => {
    const now = Date.now();
    const { pageX, pageY } = e.nativeEvent;
    const dx = Math.abs(pageX - lastTapXRef.current);
    const dy = Math.abs(pageY - lastTapYRef.current);

    const timeDiff = now - lastTapRef.current;
    if (timeDiff < 400 && dx < 50 && dy < 50) {
      if (!isFalling) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        if (isExcitedBurst) {
          clearExcitedBurst();
        }
        setIsFalling(true);
      }
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      lastTapXRef.current = pageX;
      lastTapYRef.current = pageY;
    }
  }, [isFalling, isExcitedBurst, clearExcitedBurst]);

  useEffect(() => {
    if (!isFalling) return;
    const timer = setTimeout(() => setIsFalling(false), FALLING_DURATION);
    return () => clearTimeout(timer);
  }, [isFalling]);

  return (
    <View className="flex-1 bg-pet-background">
      <TouchableOpacity
        onPress={() => setHelpVisible(true)}
        activeOpacity={0.9}
        className="absolute top-4 right-4 z-30 w-11 h-11 rounded-full bg-pet-blue items-center justify-center border border-pet-blue-dark/70"
        style={{
          shadowColor: '#3792A6',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color="#ffffff" />
      </TouchableOpacity>

      <View className="absolute -top-8 -left-6 w-36 h-36 rounded-full bg-pet-blue-light/35" />
      <View className="absolute top-[340px] -right-10 w-44 h-44 rounded-full bg-pet-blue-light/40" />
      {showParty && (
        <View pointerEvents="none" className="absolute inset-0 z-40 items-center">
          <Animated.View
            style={{
              opacity: partyAnim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
              transform: [{ translateY: partyAnim.interpolate({ inputRange: [0, 1], outputRange: [40, -220] }) }],
            }}
            className="mt-32 flex-row"
          >
            <Text className="text-3xl mr-2">{'\u{1F389}'}</Text>
            <Text className="text-3xl mr-2">{'\u2728'}</Text>
            <Text className="text-3xl mr-2">{'\u{1F38A}'}</Text>
            <Text className="text-3xl">{'\u{1F389}'}</Text>
          </Animated.View>
        </View>
      )}

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        bounces
      >
        <View
          className="bg-pet-blue-light/25 rounded-b-[44px] overflow-hidden"
          style={{ height: 390 }}
          onTouchStartCapture={handleTouchCapture}
        >
          <SkyCloud className="top-10 left-6" />
          <SkyCloud className="top-20 right-10 scale-90" />
          <SkyCloud className="top-52 left-12 scale-75" />
          <View className="absolute inset-0 bg-white/35 rounded-b-[44px]" />
          {needMessage && !isExcitedBurst && <NeedBubble message={needMessage} />}
          <PetRenderer activeModel={activeModel} onExcitedFinished={clearExcitedBurst} equippedSkin={skin} />
        </View>

        <View className="items-center -mt-14 mb-4 z-10 px-6">
          <View
            className="w-full rounded-[30px] overflow-hidden border border-pet-blue-light/50"
            style={{
              shadowColor: '#24324A',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.12,
              shadowRadius: 20,
              elevation: 8,
            }}
          >
            <View className="bg-pet-blue px-6 py-2.5">
              <Text className="text-white text-[11px] font-bold tracking-[1px] uppercase">Companion Status</Text>
            </View>
            <View className="bg-white px-6 py-5 items-center">
              <Text className="text-[40px] leading-[42px] font-black text-gray-800">{name}</Text>
              <View className="flex-row items-center gap-2 mt-2.5">
                <MoodBadge moodText={moodText} isExcited={isExcitedBurst} isUrgent={!!needMessage} />
                {streakDays > 0 && (
                  <TouchableOpacity
                    onPress={() => setStreakVisible(true)}
                    activeOpacity={0.9}
                    className="flex-row items-center bg-pet-blue px-3.5 py-2 rounded-full border border-pet-blue-dark/40"
                  >
                    <Text className="text-[11px] font-semibold text-white">
                      {'\u{1F525}'} {streakDays > 1 ? `${streakDays} day streak` : 'Day 1'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>

        <CareActions />

        <View className="px-6 mt-6">
          <TouchableOpacity onPress={() => setReflectionModalVisible(true)} activeOpacity={0.9}>
            <View
              className="rounded-[30px] p-5 border border-pet-blue-dark/20 bg-pet-blue"
              style={{
                shadowColor: '#3792A6',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2,
                shadowRadius: 14,
                elevation: 6,
              }}
            >
              <View className="flex-row items-center">
                <View className="w-12 h-12 rounded-xl bg-white/20 items-center justify-center mr-3 border border-white/30">
                  <Text className="text-2xl">{'\u{1FA9E}'}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[17px] font-black text-white">Reflection Prompt</Text>
                  <Text className="text-[13px] text-pet-blue-light mt-0.5">Talk to {name} and reset your vibe.</Text>
                </View>
                <View className="w-9 h-9 rounded-full bg-black/10 items-center justify-center">
                  <Text className="text-white text-lg font-semibold">{'\u{203A}'}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View className="mt-7 mb-4">
          <View className="px-6 mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-black text-gray-800 tracking-[0.4px]">Outfit Studio</Text>
            <View className="bg-pet-blue-light/35 px-3 py-1 rounded-full border border-pet-blue/40">
              <Text className="text-[11px] font-semibold text-pet-blue-dark">Open Shop</Text>
            </View>
          </View>
          <SkinSelector />
        </View>
      </ScrollView>

      <ReflectionModal
        visible={reflectionModalVisible}
        onClose={() => setReflectionModalVisible(false)}
      />
      <HelpModal visible={helpVisible} onClose={() => setHelpVisible(false)} />
      <StreakCalendarModal visible={streakVisible} onClose={() => setStreakVisible(false)} streakDays={streakDays} />
    </View>
  );
}
