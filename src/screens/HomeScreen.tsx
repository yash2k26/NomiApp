import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, AppState, Animated, GestureResponderEvent, Modal, Pressable, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePetStore, getPetNeeds } from '../store/petStore';
import { useShopStore } from '../store/shopStore';
import { useAdventureStore } from '../store/adventureStore';
import { PetRenderer, CareActions, ReflectionModal, type ActiveModel } from '../components';
import { XpBar } from '../components/XpBar';
import { LevelUpModal } from '../components/LevelUpModal';
import { LoginCalendar } from '../components/LoginCalendar';
import { DialogueBubble } from '../components/DialogueBubble';
import { DiaryModal } from '../components/DiaryModal';
import { EventOverlay } from '../components/EventOverlay';
import { TouchInteractionLayer } from '../components/TouchInteractionLayer';
import { useXpStore } from '../store/xpStore';
import { useEventStore } from '../store/eventStore';
import { usePersonalityStore, getActionDialogue, type DialogueContext } from '../store/personalityStore';
import { ADVENTURE_ZONES } from '../store/adventureStore';
import { petTypography } from '../theme/typography';
import { playMusic, stopMusic } from '../lib/soundManager';
import { OnboardingOverlay, shouldShowOnboarding } from '../components/OnboardingOverlay';

const FALLING_DURATION = 13000; // Gangnam clip is ~12.4s

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
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <Text key={`${d}-${i}`} className="w-8 text-center text-[11px] font-bold text-gray-400">{d}</Text>
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

function LoadingSplash() {
  const pulseAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.85, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <View className="absolute inset-0 z-50 items-center justify-center" style={{ backgroundColor: '#E8F4FA' }}>
      <LinearGradient
        colors={['#E8F4FA', '#D6EDF7', '#E8F4FA']}
        className="absolute inset-0"
      />
      <View className="items-center">
        <Animated.View
          style={{
            transform: [{ scale: pulseAnim }],
            shadowColor: '#4FB0C6',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 12,
          }}
          className="w-28 h-28 rounded-[28px] bg-white items-center justify-center mb-8"
        >
          <Text className="text-6xl">{'\u{1F43E}'}</Text>
        </Animated.View>
        <Text
          className="text-[28px] font-black text-pet-blue-dark mb-2"
          style={{ fontFamily: petTypography.display }}
        >
          Nomi
        </Text>
        <Text
          className="text-pet-blue text-[13px] font-semibold mb-6"
          style={{ fontFamily: petTypography.body }}
        >
          Powered by Solana
        </Text>
        <ActivityIndicator size="large" color="#4FB0C6" />
        <Text
          className="text-gray-400 text-xs mt-4"
          style={{ fontFamily: petTypography.body }}
        >
          Preparing Nomi's world...
        </Text>
      </View>
    </View>
  );
}

function ActivityGlance({ onNavigateGames }: { onNavigateGames?: () => void }) {
  const dailyQuests = useXpStore((s) => s.dailyQuests);
  const weeklyQuests = useXpStore((s) => s.weeklyQuests);
  const activeAdventure = useAdventureStore((s) => s.activeAdventure);
  const canSpin = useAdventureStore((s) => s.canSpinToday);
  const [remaining, setRemaining] = useState(0);

  const dailyDone = dailyQuests.filter(q => q.completed).length;
  const weeklyDone = weeklyQuests.filter(q => q.completed).length;
  const activeZone = activeAdventure ? ADVENTURE_ZONES.find(z => z.id === activeAdventure.zoneId) : null;

  useEffect(() => {
    if (!activeAdventure) return;
    const update = () => setRemaining(Math.max(0, activeAdventure.endsAt - Date.now()));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeAdventure]);

  const formatTime = (ms: number) => {
    if (ms <= 0) return 'Done!';
    const totalSec = Math.ceil(ms / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const min = Math.floor((totalSec % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${min}m`;
    return `${min}m`;
  };

  return (
    <View className="px-6 mt-3 mb-1">
      <View
        className="bg-white rounded-[28px] border border-gray-100 overflow-hidden"
        style={{ shadowColor: '#22314A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}
      >
        <View className="px-5 py-3 border-b border-gray-100">
          <Text className="text-[11px] font-black text-gray-500 uppercase tracking-[0.8px]" style={{ fontFamily: petTypography.strong }}>Today at a glance</Text>
        </View>
        <View className="flex-row">
          {/* Quests */}
          <TouchableOpacity className="flex-1 py-3.5 items-center border-r border-gray-100" activeOpacity={0.7} onPress={onNavigateGames}>
            <Text className="text-[16px] mb-0.5">{'\u{1F3AF}'}</Text>
            <Text className="text-[11px] font-black text-gray-700">{dailyDone}/{dailyQuests.length}</Text>
            <Text className="text-[9px] font-semibold text-gray-400">Quests</Text>
          </TouchableOpacity>

          {/* Weekly */}
          <TouchableOpacity className="flex-1 py-3.5 items-center border-r border-gray-100" activeOpacity={0.7} onPress={onNavigateGames}>
            <Text className="text-[16px] mb-0.5">{'\u{1F3C6}'}</Text>
            <Text className="text-[11px] font-black text-gray-700">{weeklyDone}/{weeklyQuests.length}</Text>
            <Text className="text-[9px] font-semibold text-gray-400">Weekly</Text>
          </TouchableOpacity>

          {/* Adventure */}
          <TouchableOpacity className="flex-1 py-3.5 items-center border-r border-gray-100" activeOpacity={0.7} onPress={onNavigateGames}>
            {activeAdventure && activeZone ? (
              <>
                <Text className="text-[16px] mb-0.5">{activeZone.emoji}</Text>
                <Text className="text-[11px] font-black text-pet-blue-dark">
                  {remaining <= 0 ? 'Loot!' : formatTime(remaining)}
                </Text>
                <Text className="text-[9px] font-semibold text-gray-400">Adventure</Text>
              </>
            ) : (
              <>
                <Text className="text-[16px] mb-0.5">{'\u{1F30D}'}</Text>
                <Text className="text-[11px] font-black text-gray-700">Go!</Text>
                <Text className="text-[9px] font-semibold text-gray-400">Adventure</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Spin */}
          <TouchableOpacity className="flex-1 py-3.5 items-center" activeOpacity={0.7} onPress={onNavigateGames}>
            <Text className="text-[16px] mb-0.5">{'\u{1F3B0}'}</Text>
            <Text className={`text-[11px] font-black ${canSpin() ? 'text-pet-blue-dark' : 'text-gray-400'}`}>
              {canSpin() ? 'Free!' : 'Done'}
            </Text>
            <Text className="text-[9px] font-semibold text-gray-400">Spin</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export function HomeScreen({ onNavigateGames }: { onNavigateGames?: () => void } = {}) {
  const [petReady, setPetReady] = useState(false);
  const [reflectionModalVisible, setReflectionModalVisible] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [streakVisible, setStreakVisible] = useState(false);
  const [diaryVisible, setDiaryVisible] = useState(false);
  const [showParty, setShowParty] = useState(false);
  const [isFalling, setIsFalling] = useState(false);
  const [loginPopupVisible, setLoginPopupVisible] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const partyAnim = useRef(new Animated.Value(0)).current;
  const prevStreakRef = useRef(0);
  const prevAllHighRef = useRef(false);

  const {
    name,
    ownerName,
    hunger,
    happiness,
    energy,
    getMoodText,
    tick,
    isExcitedBurst,
    clearExcitedBurst,
    triggerExcitedBurst,
    streakDays,
  } = usePetStore();

  const { equippedItemId, equippedAnimationId, items: shopItems, unequipItem } = useShopStore();
  const equippedItem = equippedItemId ? shopItems.find((i) => i.id === equippedItemId) : null;
  const equippedSkinKey = equippedItem?.skinKey ?? 'default';

  // Map equipped animation skinKey → ActiveModel
  const ANIM_SKIN_TO_MODEL: Record<string, ActiveModel> = {
    'anim-gangnam': 'gangnam',
    'anim-backflip': 'backflip',
    'anim-punch': 'punch',
    'anim-fallover': 'fallover',
  };
  const equippedAnimItem = equippedAnimationId ? shopItems.find((i) => i.id === equippedAnimationId) : null;
  const equippedAnimModel = equippedAnimItem ? ANIM_SKIN_TO_MODEL[equippedAnimItem.skinKey] : null;

  const moodText = getMoodText();
  const needMessage = getPetNeeds(hunger, happiness, energy);
  const level = useXpStore((s) => s.level);

  // Personality & dialogue
  const { generateDialogue, generateIdleDialogue, currentDialogue, getUnreadDiaryCount } = usePersonalityStore();
  const unreadDiary = getUnreadDiaryCount();
  const lastTickAtRef = useRef(usePetStore.getState().lastTickAt);

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
        : equippedAnimModel
          ? equippedAnimModel
          : equippedSkinKey === 'headphones'
            ? 'dancing'
            : 'breathing';

  // Build dialogue context
  const dialogueCtx = useCallback((): DialogueContext => {
    const hoursSince = (Date.now() - lastTickAtRef.current) / (1000 * 60 * 60);
    return {
      hunger, happiness, energy,
      mood: moodText,
      name,
      ownerName,
      streakDays,
      equippedSkin: equippedSkinKey,
      level,
      hoursSinceLastOpen: hoursSince,
      isFirstOpenToday: false, // store handles this internally
    };
  }, [hunger, happiness, energy, moodText, name, ownerName, streakDays, equippedSkinKey, level]);

  // Onboarding overlay — show once after first pet mint
  useEffect(() => {
    shouldShowOnboarding().then((show) => { if (show) setShowOnboarding(true); });
  }, []);

  // Login calendar auto-popup on daily first open
  const lastLoginClaimDate = useAdventureStore((s) => s.lastLoginClaimDate);
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (lastLoginClaimDate !== today) {
      setLoginPopupVisible(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    tick();
    // Generate initial dialogue on open
    const hoursSince = (Date.now() - usePetStore.getState().lastTickAt) / (1000 * 60 * 60);
    generateDialogue({ ...dialogueCtx(), hoursSinceLastOpen: hoursSince, isFirstOpenToday: true });
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        tick();
        generateDialogue(dialogueCtx());
      }
    });
    return () => sub.remove();
  }, [tick, generateDialogue, dialogueCtx]);

  // Idle dialogue timer — every 45-90 seconds
  useEffect(() => {
    const scheduleIdle = () => {
      const delay = 45000 + Math.random() * 45000;
      return setTimeout(() => {
        if (activeModel === 'breathing' || activeModel === 'dancing') {
          generateIdleDialogue(dialogueCtx());
        }
        idleTimerRef.current = scheduleIdle();
      }, delay);
    };
    const idleTimerRef = { current: scheduleIdle() };
    return () => clearTimeout(idleTimerRef.current);
  }, [activeModel, generateIdleDialogue, dialogueCtx]);

  // Random event check — every 60 seconds
  const checkAndTriggerEvent = useEventStore((s) => s.checkAndTriggerEvent);
  const evolutionStage = useAdventureStore((s) => s.evolutionStage);
  const statsAbove70 = shownHunger >= 70 && shownHappiness >= 70 && shownEnergy >= 70;
  useEffect(() => {
    const interval = setInterval(() => {
      checkAndTriggerEvent(statsAbove70, evolutionStage);
    }, 60000);
    // Also check once on mount (after a short delay)
    const initialCheck = setTimeout(() => checkAndTriggerEvent(statsAbove70, evolutionStage), 5000);
    return () => { clearInterval(interval); clearTimeout(initialCheck); };
  }, [checkAndTriggerEvent, statsAbove70, evolutionStage]);

  useEffect(() => {
    if (!prevAllHighRef.current && allHighStats) {
      triggerExcitedBurst();
    }
    prevAllHighRef.current = allHighStats;
  }, [allHighStats, triggerExcitedBurst]);

  // Auto-deselect headphones if any stat drops to 50% or below
  useEffect(() => {
    if (equippedSkinKey === 'headphones' && anySadStat) {
      unequipItem();
    }
  }, [equippedSkinKey, anySadStat, unequipItem]);

  // Play/stop headphones music when dance starts/stops
  useEffect(() => {
    if (activeModel === 'dancing') {
      playMusic('headphones');
    } else {
      stopMusic();
    }
    return () => { stopMusic(); };
  }, [activeModel]);

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

  // Called by TouchInteractionLayer on double-tap
  const handleDoubleTap = useCallback((_e: GestureResponderEvent) => {
    if (!isFalling) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (isExcitedBurst) {
        clearExcitedBurst();
      }
      setIsFalling(true);
    }
  }, [isFalling, isExcitedBurst, clearExcitedBurst]);

  useEffect(() => {
    if (!isFalling) return;
    const timer = setTimeout(() => setIsFalling(false), FALLING_DURATION);
    return () => clearTimeout(timer);
  }, [isFalling]);

  return (
    <View className="flex-1 bg-pet-background">
      <LinearGradient
        colors={['#EDF8FF', '#E4F3FF', '#F5FBFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />
      {/* Random Event Overlay */}
      <EventOverlay />

      {/* Help button */}
      <View className="absolute top-3 right-5 z-30">
        <TouchableOpacity
          onPress={() => setHelpVisible(true)}
          activeOpacity={0.9}
          className="w-12 h-12 rounded-full bg-pet-blue items-center justify-center border border-pet-blue-dark/70"
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
      </View>
      {/* Removed NOMI SKY CLUB label — space reclaimed */}

      <View className="absolute -top-8 -left-6 w-36 h-36 rounded-full bg-pet-blue-light/35" />
      <View className="absolute top-[340px] -right-10 w-44 h-44 rounded-full bg-pet-blue-light/40" />
      {showParty && (
        <View pointerEvents="none" className="absolute inset-0 z-40 items-center">
          <Animated.View
            style={{
              opacity: partyAnim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
              transform: [{ translateY: partyAnim.interpolate({ inputRange: [0, 1], outputRange: [32, -120] }) }],
            }}
            className="mt-32"
          >
            <View className="px-4 py-2 rounded-full bg-white/90 border border-pet-blue-light">
              <Text className="text-[12px] font-black text-pet-blue-dark">Streak saved</Text>
            </View>
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
          className="bg-pet-blue-light/25 rounded-b-[52px] overflow-hidden"
          style={{ height: 390 }}
        >
          <TouchInteractionLayer viewHeight={390} onDoubleTap={handleDoubleTap}>
            <SkyCloud className="top-10 left-6" />
            <SkyCloud className="top-20 right-10 scale-90" />
            <SkyCloud className="top-52 left-12 scale-75" />
            <View className="absolute inset-0 bg-white/35 rounded-b-[52px]" />
            {!isExcitedBurst && <DialogueBubble message={currentDialogue ?? needMessage} />}
            <PetRenderer activeModel={activeModel} onExcitedFinished={clearExcitedBurst} equippedSkin={equippedSkinKey} onReady={() => setPetReady(true)} />
          </TouchInteractionLayer>
        </View>

        <View className="items-center -mt-14 mb-5 z-10 px-6">
          <View
            className="w-full rounded-[34px] overflow-hidden border border-pet-blue-light/55"
            style={{
              shadowColor: '#24324A',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.12,
              shadowRadius: 20,
              elevation: 8,
            }}
          >
            <LinearGradient
              colors={['#4FB0C6', '#6BC6D9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="px-6 py-3"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-white text-[11px] font-bold tracking-[1px] uppercase" style={{ fontFamily: petTypography.strong }}>Companion Status</Text>
                <Text className="text-white/80 text-[10px] font-semibold" style={{ fontFamily: petTypography.body }}>Live Mood Tracker</Text>
              </View>
            </LinearGradient>
            <View className="bg-white px-6 py-6 items-center">
              <Text className="text-[40px] leading-[42px] font-black text-gray-800" style={{ fontFamily: petTypography.display }}>{name}</Text>
              {ownerName ? (
                <Text className="text-[12px] text-gray-400 mt-1" style={{ fontFamily: petTypography.body }}>{ownerName}'s companion</Text>
              ) : null}
              <View className="flex-row items-center gap-2 mt-2.5">
                <MoodBadge moodText={moodText} isExcited={isExcitedBurst} isUrgent={!!needMessage} />
                {streakDays > 0 && (
                  <TouchableOpacity
                    onPress={() => setStreakVisible(true)}
                    activeOpacity={0.9}
                    className="flex-row items-center bg-pet-blue px-3.5 py-2 rounded-[14px] border border-pet-blue-dark/40"
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

        {/* XP Bar */}
        <View className="px-6 mt-3">
          <XpBar />
        </View>

        {/* Diary Button */}
        <View className="px-6 mt-4">
          <TouchableOpacity onPress={() => setDiaryVisible(true)} activeOpacity={0.85}>
            <View
              className="bg-white rounded-[26px] border border-pet-blue-light/50 px-5 py-4 flex-row items-center"
              style={{ shadowColor: '#4FB0C6', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}
            >
              <View className="w-10 h-10 rounded-2xl bg-pet-blue-light/20 items-center justify-center mr-3">
                <Text className="text-lg">{'\u{1F4D6}'}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[13px] font-black text-gray-700" style={{ fontFamily: petTypography.heading }}>Nomi's Diary</Text>
                <Text className="text-[11px] text-gray-400 font-semibold mt-0.5" style={{ fontFamily: petTypography.body }}>See what Nomi did while you were away</Text>
              </View>
              {unreadDiary > 0 && (
                <View className="bg-pet-blue w-6 h-6 rounded-full items-center justify-center">
                  <Text className="text-[10px] font-black text-white">{unreadDiary}</Text>
                </View>
              )}
              <MaterialCommunityIcons name="chevron-right" size={18} color="#9ca3af" style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>
        </View>

        <View className="px-6 mt-4 mb-2">
          <Text className="text-[17px] font-black text-gray-800">Care Panel</Text>
        </View>
        <CareActions />

        {/* Activity Glance */}
        <ActivityGlance onNavigateGames={onNavigateGames} />

        <View className="px-6 mt-6">
          <TouchableOpacity onPress={() => setReflectionModalVisible(true)} activeOpacity={0.9}>
            <LinearGradient
              colors={['#4FABC9', '#67B6D6', '#7CC0DE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="rounded-[30px] p-5 border border-pet-blue-dark/20"
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
                  <View className="flex-row items-center">
                    <Text className="text-[17px] font-black text-white">Reflection Prompt</Text>
                    <View className="bg-pet-blue-dark/85 ml-2 px-2 py-0.5 rounded-full border border-white/30">
                      <Text className="text-[9px] font-black text-white">+25 XP</Text>
                    </View>
                  </View>
                  <Text className="text-[13px] text-pet-blue-light mt-0.5">Talk to {name} and reset your vibe.</Text>
                </View>
                <View className="w-9 h-9 rounded-full bg-black/10 items-center justify-center">
                  <Text className="text-white text-lg font-semibold">{'\u{203A}'}</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

      </ScrollView>

      <ReflectionModal
        visible={reflectionModalVisible}
        onClose={() => setReflectionModalVisible(false)}
      />
      <HelpModal visible={helpVisible} onClose={() => setHelpVisible(false)} />
      <StreakCalendarModal visible={streakVisible} onClose={() => setStreakVisible(false)} streakDays={streakDays} />
      <DiaryModal visible={diaryVisible} onClose={() => setDiaryVisible(false)} />
      <LevelUpModal />

      {/* Daily Login Calendar Auto-Popup */}
      <Modal visible={loginPopupVisible} transparent animationType="fade" onRequestClose={() => setLoginPopupVisible(false)}>
        <Pressable className="flex-1 bg-black/40 justify-center px-4" onPress={() => setLoginPopupVisible(false)}>
          <Pressable onPress={() => {}}>
            <LoginCalendar onClaimed={() => setLoginPopupVisible(false)} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Onboarding overlay — first launch only */}
      {showOnboarding && petReady && (
        <OnboardingOverlay onDone={() => setShowOnboarding(false)} />
      )}

      {/* Full-screen loading splash until 3D pet is rendered */}
      {!petReady && <LoadingSplash />}
    </View>
  );
}
