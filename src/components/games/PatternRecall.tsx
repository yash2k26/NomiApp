import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Pressable, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { playMusic, stopMusic, playSfx } from '../../lib/soundManager';

const BASE_COLORS = [
  { bg: 'bg-pet-pink', active: 'bg-pet-pink-dark', hex: '#FF6B8A', activeHex: '#D94F6A', label: 'Pink' },
  { bg: 'bg-pet-blue', active: 'bg-pet-blue-dark', hex: '#4FB0C6', activeHex: '#3792A6', label: 'Blue' },
  { bg: 'bg-pet-green', active: 'bg-pet-green-dark', hex: '#34C759', activeHex: '#248A3D', label: 'Green' },
  { bg: 'bg-pet-orange', active: 'bg-pet-orange-dark', hex: '#FF9F0A', activeHex: '#C87607', label: 'Orange' },
];

// 5th color unlocks at round 5
const BONUS_COLOR = { bg: 'bg-pet-purple', active: 'bg-pet-purple-dark', hex: '#9381FF', activeHex: '#766BD1', label: 'Purple' };

const BASE_SHOW_DELAY = 500;
const BASE_SHOW_DURATION = 400;
const MIN_SHOW_DELAY = 200;
const MIN_SHOW_DURATION = 200;

const MAX_LIVES = 3;

interface PatternRecallProps {
  onComplete: (score: number, xp: number) => void;
  onCancel: () => void;
}

export function PatternRecall({ onComplete, onCancel }: PatternRecallProps) {
  const [pattern, setPattern] = useState<number[]>([]);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<'showing' | 'input' | 'gameover' | 'waiting'>('waiting');
  const [activeButton, setActiveButton] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [lives, setLives] = useState(MAX_LIVES);
  const [perfectRounds, setPerfectRounds] = useState(0); // rounds with no mistakes

  // Active colors — starts with 4, adds 5th at round 5
  const getColors = useCallback((currentRound: number) => {
    return currentRound >= 5 ? [...BASE_COLORS, BONUS_COLOR] : [...BASE_COLORS];
  }, []);

  const [colors, setColors] = useState(BASE_COLORS);
  const scaleAnims = useRef([...BASE_COLORS, BONUS_COLOR].map(() => new Animated.Value(1))).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Game music
  useEffect(() => {
    playMusic('game1');
    return () => { stopMusic(); };
  }, []);

  // Speed increases with rounds
  const getShowDelay = useCallback((r: number) => {
    return Math.max(MIN_SHOW_DELAY, BASE_SHOW_DELAY - r * 30);
  }, []);
  const getShowDuration = useCallback((r: number) => {
    return Math.max(MIN_SHOW_DURATION, BASE_SHOW_DURATION - r * 20);
  }, []);

  const flashButton = useCallback((index: number, duration: number) => {
    return new Promise<void>(resolve => {
      setActiveButton(index);
      Animated.sequence([
        Animated.timing(scaleAnims[index], { toValue: 1.15, duration: duration / 2, useNativeDriver: true }),
        Animated.timing(scaleAnims[index], { toValue: 1, duration: duration / 2, useNativeDriver: true }),
      ]).start(() => {
        setActiveButton(null);
        resolve();
      });
    });
  }, [scaleAnims]);

  const shakeScreen = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // Start new round
  const startRound = useCallback(async () => {
    setPhase('showing');
    setPlayerInput([]);

    const nextRound = pattern.length + 1;
    const activeColors = getColors(nextRound);
    setColors(activeColors);

    // Add a new random color to pattern
    const newColor = Math.floor(Math.random() * activeColors.length);
    const newPattern = [...pattern, newColor];
    setPattern(newPattern);
    setRound(newPattern.length);

    // Show pattern with delays that get faster
    const delay = getShowDelay(newPattern.length);
    const duration = getShowDuration(newPattern.length);

    await new Promise(r => setTimeout(r, 600));
    for (let i = 0; i < newPattern.length; i++) {
      await flashButton(newPattern[i], duration);
      await new Promise(r => setTimeout(r, delay));
    }

    setPhase('input');
  }, [pattern, flashButton, getColors, getShowDelay, getShowDuration]);

  // Start first round on mount
  useEffect(() => {
    const timer = setTimeout(() => startRound(), 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Final results state
  const [finalResult, setFinalResult] = useState<{ score: number; xp: number } | null>(null);

  // End game
  useEffect(() => {
    if (!gameOver) return;
    const completedRounds = round - 1;
    const perfectBonus = perfectRounds * 5;
    const score = completedRounds * 10 + perfectBonus;
    const xp = Math.min(10 + completedRounds * 8 + perfectBonus, 80);
    setFinalResult({ score, xp });
    playSfx(completedRounds >= 5 ? 'gamevictory' : 'gameloss').catch(() => {});
  }, [gameOver, round, perfectRounds]);

  const handleDismiss = () => {
    if (finalResult) onComplete(finalResult.score, finalResult.xp);
  };

  const handleButtonPress = useCallback(async (index: number) => {
    if (phase !== 'input') return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await flashButton(index, 200);

    const newInput = [...playerInput, index];
    setPlayerInput(newInput);

    const currentStep = newInput.length - 1;

    // Check if wrong
    if (pattern[currentStep] !== index) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shakeScreen();

      const newLives = lives - 1;
      setLives(newLives);

      if (newLives <= 0) {
        // Game over
        setPhase('gameover');
        setGameOver(true);
      } else {
        // Replay the round — reset input, show pattern again
        setPhase('waiting');
        setTimeout(async () => {
          setPhase('showing');
          setPlayerInput([]);

          const delay = getShowDelay(pattern.length);
          const duration = getShowDuration(pattern.length);

          await new Promise(r => setTimeout(r, 400));
          for (let i = 0; i < pattern.length; i++) {
            await flashButton(pattern[i], duration);
            await new Promise(r => setTimeout(r, delay));
          }
          setPhase('input');
        }, 800);
      }
      return;
    }

    // Check if pattern complete
    if (newInput.length === pattern.length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Track perfect rounds (no lives lost this round — if still at same lives as start)
      setPerfectRounds(p => p + 1);

      setPhase('waiting');
      setTimeout(() => startRound(), 1000);
    }
  }, [phase, playerInput, pattern, flashButton, startRound, lives, shakeScreen, getShowDelay, getShowDuration]);

  // Speed label
  const speedLabel = round <= 2 ? 'Normal' : round <= 5 ? 'Fast' : round <= 8 ? 'Faster' : 'Insane';

  return (
    <Animated.View
      className="flex-1 bg-pet-background px-4 pt-4"
      style={{ transform: [{ translateX: shakeAnim }] }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <TouchableOpacity onPress={onCancel}>
          <Text className="text-pet-purple font-bold text-[14px]">{'\u2190'} Back</Text>
        </TouchableOpacity>
        <View className="flex-row items-center">
          {/* Lives */}
          <View className="bg-pet-pink-light/30 px-3 py-1.5 rounded-full mr-2">
            <Text className="text-pet-pink-dark font-black text-[12px]">
              {Array.from({ length: MAX_LIVES }, (_, i) => i < lives ? '\u2764\uFE0F' : '\u{1F5A4}').join('')}
            </Text>
          </View>
          <View className="bg-pet-purple-light/30 px-3 py-1.5 rounded-full">
            <Text className="text-pet-purple-dark font-black text-[12px]">Round {round}</Text>
          </View>
        </View>
      </View>

      {/* Status */}
      <View className="items-center mb-6">
        <Text className="text-[16px] font-black text-gray-800 mb-1">
          {phase === 'showing' ? 'Watch the pattern...' :
           phase === 'input' ? 'Your turn! Repeat it.' :
           phase === 'waiting' ? 'Nice! Get ready...' :
           'Game Over!'}
        </Text>
        <View className="flex-row items-center">
          {phase === 'input' && (
            <Text className="text-[12px] text-gray-500 font-semibold mr-3">
              {playerInput.length}/{pattern.length}
            </Text>
          )}
          {round > 2 && (
            <View className={`px-2 py-0.5 rounded-full ${
              round <= 5 ? 'bg-pet-blue-light/30' : round <= 8 ? 'bg-pet-orange-light/30' : 'bg-pet-pink-light/30'
            }`}>
              <Text className={`text-[10px] font-black ${
                round <= 5 ? 'text-pet-blue-dark' : round <= 8 ? 'text-pet-orange-dark' : 'text-pet-pink-dark'
              }`}>
                {'\u26A1'} {speedLabel}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Color buttons — 2x2 or 2x3 grid */}
      <View className="flex-row flex-wrap justify-center px-4" style={{ gap: 16 }}>
        {colors.map((color, i) => (
          <Animated.View
            key={color.label}
            style={{
              transform: [{ scale: scaleAnims[i] }],
              width: colors.length > 4 ? '30%' : '44%',
            }}
          >
            <TouchableOpacity
              onPress={() => handleButtonPress(i)}
              disabled={phase !== 'input'}
              activeOpacity={0.8}
            >
              <View
                style={{
                  height: colors.length > 4 ? 100 : 128,
                  borderRadius: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: 'rgba(0,0,0,0.1)',
                  backgroundColor: activeButton === i ? color.activeHex : color.hex,
                  opacity: phase === 'input' ? 1 : activeButton === i ? 1 : 0.5,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: activeButton === i ? 0.2 : 0.05,
                  shadowRadius: 8,
                  elevation: activeButton === i ? 8 : 2,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {color.label}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>

      {/* Round 5 unlock hint */}
      {round === 4 && phase === 'waiting' && (
        <View className="items-center mt-4">
          <Text className="text-[11px] text-pet-purple font-black">{'\u{1F7E3}'} Purple unlocks next round!</Text>
        </View>
      )}

      {/* Game over overlay */}
      {gameOver && (
        <Pressable className="absolute inset-0 bg-black/30 items-center justify-center" style={{ top: 0 }} onPress={handleDismiss}>
          <Pressable>
            <View className="bg-white rounded-3xl p-8 items-center mx-8">
              <Text className="text-[48px] mb-2">{round > 5 ? '\u{1F389}' : '\u{1F914}'}</Text>
              <Text className="text-[24px] font-black text-gray-800 mb-1">Game Over!</Text>
              <Text className="text-[16px] text-gray-500 font-semibold">
                Reached Round {round - 1}
              </Text>
              {perfectRounds > 0 && (
                <Text className="text-[13px] text-pet-purple font-black mt-1">
                  {'\u2728'} {perfectRounds} Perfect Round{perfectRounds > 1 ? 's' : ''}
                </Text>
              )}
              <TouchableOpacity onPress={handleDismiss} activeOpacity={0.85} className="mt-4 bg-pet-purple px-8 py-3 rounded-full">
                <Text className="text-white font-black text-[14px]">Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      )}
    </Animated.View>
  );
}
