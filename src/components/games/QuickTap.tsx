import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Pressable, Animated, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { playMusic, stopMusic, playSfx } from '../../lib/soundManager';

const GAME_TIME = 30;
const BASE_SPAWN_INTERVAL = 800;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PLAY_AREA_W = SCREEN_W - 48;
const PLAY_AREA_H = Math.min(400, SCREEN_H * 0.45);

// Frenzy triggers at streak 5, spawns faster, more golden targets
const FRENZY_THRESHOLD = 5;
const FRENZY_SPAWN_INTERVAL = 500;
const FRENZY_DURATION = 5000; // ms

interface Target {
  id: number;
  x: number;
  y: number;
  size: number; // vary sizes for challenge
  type: 'normal' | 'golden' | 'bomb' | 'freeze';
  opacity: Animated.Value;
  scale: Animated.Value;
}

interface FloatingScore {
  id: number;
  text: string;
  color: string;
  x: number;
  y: number;
  anim: Animated.Value;
}

interface QuickTapProps {
  onComplete: (score: number, xp: number) => void;
  onCancel: () => void;
}

export function QuickTap({ onComplete, onCancel }: QuickTapProps) {
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [score, setScore] = useState(0);
  const [targets, setTargets] = useState<Target[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [frenzy, setFrenzy] = useState(false);
  const [frenzyFlash, setFrenzyFlash] = useState(false);
  const [floats, setFloats] = useState<FloatingScore[]>([]);
  const nextId = useRef(0);
  const floatId = useRef(0);
  const frenzyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const spawnInterval = frenzy ? FRENZY_SPAWN_INTERVAL : BASE_SPAWN_INTERVAL;

  // Game music
  useEffect(() => {
    playMusic('game1');
    return () => { stopMusic(); };
  }, []);

  // Add floating score
  const addFloat = useCallback((text: string, color: string, x: number, y: number) => {
    const id = floatId.current++;
    const anim = new Animated.Value(0);
    setFloats(prev => [...prev.slice(-5), { id, text, color, x, y, anim }]);
    Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }).start(() => {
      setFloats(prev => prev.filter(f => f.id !== id));
    });
  }, []);

  // Timer
  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setGameOver(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameOver]);

  // Spawn targets
  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      const id = nextId.current++;
      const rand = Math.random();

      let type: Target['type'];
      if (frenzy) {
        // Frenzy: more golden, fewer bombs, rare freeze
        type = rand < 0.05 ? 'bomb' : rand < 0.35 ? 'golden' : 'normal';
      } else {
        type = rand < 0.08 ? 'freeze' : rand < 0.18 ? 'bomb' : rand < 0.3 ? 'golden' : 'normal';
      }

      // Size variety — smaller = harder = more points
      const sizeRand = Math.random();
      const size = sizeRand < 0.15 ? 40 : sizeRand < 0.4 ? 50 : 56;

      const opacity = new Animated.Value(1);
      const scale = new Animated.Value(0);

      const target: Target = {
        id,
        x: Math.random() * (PLAY_AREA_W - size),
        y: Math.random() * (PLAY_AREA_H - size),
        size,
        type,
        opacity,
        scale,
      };

      setTargets(prev => [...prev.slice(-8), target]);

      // Pop-in animation
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();

      // Auto-disappear — faster in frenzy
      const lifespan = frenzy ? 1500 : 2000;
      setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setTargets(prev => prev.filter(t => t.id !== id));
        });
      }, lifespan);
    }, spawnInterval);
    return () => clearInterval(interval);
  }, [gameOver, frenzy, spawnInterval]);

  // Final results state
  const [finalResult, setFinalResult] = useState<{ score: number; xp: number } | null>(null);

  // End game
  useEffect(() => {
    if (!gameOver) return;
    const finalScore = Math.max(0, score);
    const streakBonus = bestStreak * 2;
    const xp = Math.round(15 + finalScore * 0.75 + streakBonus * 0.5);
    setFinalResult({ score: finalScore + streakBonus, xp: Math.min(xp, 60) });
    playSfx('gamevictory').catch(() => {});
  }, [gameOver, score, bestStreak]);

  const handleDismiss = () => {
    if (finalResult) onComplete(finalResult.score, finalResult.xp);
  };

  // Activate frenzy mode
  const triggerFrenzy = useCallback(() => {
    if (frenzy) return;
    setFrenzy(true);
    setFrenzyFlash(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Flash effect
    setTimeout(() => setFrenzyFlash(false), 300);

    if (frenzyTimer.current) clearTimeout(frenzyTimer.current);
    frenzyTimer.current = setTimeout(() => {
      setFrenzy(false);
    }, FRENZY_DURATION);
  }, [frenzy]);

  const handleTap = useCallback((target: Target) => {
    if (gameOver) return;

    const streakMultiplier = Math.min(1 + Math.floor(streak / 3) * 0.5, 3); // 1x, 1.5x, 2x, 2.5x, 3x
    const sizeBonus = target.size <= 40 ? 2 : target.size <= 50 ? 1 : 0;

    if (target.type === 'bomb') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setScore(s => s - 5);
      setStreak(0);
      addFloat('-5', '#FF6B6B', target.x, target.y);
    } else if (target.type === 'freeze') {
      // Freeze: adds +3 seconds to timer
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeLeft(t => Math.min(t + 3, GAME_TIME));
      setStreak(s => s + 1);
      addFloat('+3s!', '#4FC3F7', target.x, target.y);
    } else if (target.type === 'golden') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const pts = Math.round((3 + sizeBonus) * streakMultiplier);
      setScore(s => s + pts);
      setStreak(s => {
        const newS = s + 1;
        setBestStreak(b => Math.max(b, newS));
        if (newS >= FRENZY_THRESHOLD && !frenzy) triggerFrenzy();
        return newS;
      });
      addFloat(`+${pts}`, '#FFD700', target.x, target.y);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const pts = Math.round((1 + sizeBonus) * streakMultiplier);
      setScore(s => s + pts);
      setStreak(s => {
        const newS = s + 1;
        setBestStreak(b => Math.max(b, newS));
        if (newS >= FRENZY_THRESHOLD && !frenzy) triggerFrenzy();
        return newS;
      });
      addFloat(`+${pts}`, '#34C759', target.x, target.y);
    }

    setTargets(prev => prev.filter(t => t.id !== target.id));
  }, [gameOver, streak, frenzy, triggerFrenzy, addFloat]);

  const timeColor = timeLeft <= 10 ? 'text-pet-pink-dark' : 'text-pet-purple-dark';

  return (
    <View className="flex-1 bg-pet-background px-4 pt-4">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <TouchableOpacity onPress={onCancel}>
          <Text className="text-pet-purple font-bold text-[14px]">{'\u2190'} Back</Text>
        </TouchableOpacity>
        <View className="flex-row items-center">
          {streak >= 3 && (
            <View className={`px-2.5 py-1.5 rounded-full mr-2 ${frenzy ? 'bg-pet-gold/30' : 'bg-pet-orange-light/30'}`}>
              <Text className={`font-black text-[11px] ${frenzy ? 'text-pet-gold-dark' : 'text-pet-orange-dark'}`}>
                {frenzy ? '\u{1F525} FRENZY!' : `\u{1F525} ${streak}`}
              </Text>
            </View>
          )}
          <View className="bg-pet-purple-light/30 px-3 py-1.5 rounded-full mr-2">
            <Text className={`font-black text-[12px] ${timeColor}`}>{'\u23F1'} {timeLeft}s</Text>
          </View>
          <View className="bg-pet-gold-light/40 px-3 py-1.5 rounded-full">
            <Text className="text-pet-gold-dark font-black text-[12px]">{'\u2B50'} {score}</Text>
          </View>
        </View>
      </View>

      {/* Legend */}
      <View className="flex-row justify-center mb-3 space-x-4">
        <View className="flex-row items-center">
          <Text className="text-[13px] mr-1">{'\u{1F436}'}</Text>
          <Text className="text-[10px] text-gray-500 font-semibold">+1</Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-[13px] mr-1">{'\u{1F31F}'}</Text>
          <Text className="text-[10px] text-pet-gold-dark font-semibold">+3</Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-[13px] mr-1">{'\u{2744}'}</Text>
          <Text className="text-[10px] text-pet-blue-dark font-semibold">+3s</Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-[13px] mr-1">{'\u{1F4A3}'}</Text>
          <Text className="text-[10px] text-pet-pink-dark font-semibold">-5</Text>
        </View>
      </View>

      {/* Play area */}
      <View
        className={`rounded-3xl border overflow-hidden ${frenzyFlash ? 'border-pet-gold border-2' : 'border-gray-100'}`}
        style={{
          height: PLAY_AREA_H,
          backgroundColor: frenzy ? '#FFFDF0' : '#FFFFFF',
          shadowColor: frenzy ? '#FFD700' : '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: frenzy ? 0.15 : 0.05,
          shadowRadius: 8,
          elevation: frenzy ? 5 : 3,
        }}
      >
        {targets.map(target => (
          <Animated.View
            key={target.id}
            style={{
              position: 'absolute',
              left: target.x,
              top: target.y,
              opacity: target.opacity,
              transform: [{ scale: target.scale }],
            }}
          >
            <TouchableOpacity onPress={() => handleTap(target)} activeOpacity={0.7}>
              <View
                style={{ width: target.size, height: target.size }}
                className={`rounded-full items-center justify-center ${
                  target.type === 'golden' ? 'bg-pet-gold-light/50 border-2 border-pet-gold' :
                  target.type === 'bomb' ? 'bg-pet-pink-light/50 border-2 border-pet-pink-dark' :
                  target.type === 'freeze' ? 'bg-pet-blue-light/50 border-2 border-pet-blue' :
                  'bg-pet-blue-light/30 border-2 border-pet-blue'
                }`}
              >
                <Text style={{ fontSize: target.size <= 40 ? 18 : target.size <= 50 ? 22 : 28 }}>
                  {target.type === 'golden' ? '\u{1F31F}' :
                   target.type === 'bomb' ? '\u{1F4A3}' :
                   target.type === 'freeze' ? '\u{2744}' :
                   '\u{1F436}'}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}

        {/* Floating scores */}
        {floats.map(f => (
          <Animated.View
            key={f.id}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: f.x + 10,
              top: f.y,
              opacity: f.anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.8, 0] }),
              transform: [{ translateY: f.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -35] }) }],
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '900', color: f.color }}>{f.text}</Text>
          </Animated.View>
        ))}

        {/* Game over overlay */}
        {gameOver && (
          <Pressable className="absolute inset-0 bg-black/30 items-center justify-center" onPress={handleDismiss}>
            <Pressable>
              <View className="bg-white rounded-3xl p-8 items-center">
                <Text className="text-[48px] mb-2">{score > 20 ? '\u{1F389}' : '\u{1F44D}'}</Text>
                <Text className="text-[24px] font-black text-gray-800 mb-1">Time's Up!</Text>
                <Text className="text-[16px] text-gray-500 font-semibold">Score: {score}</Text>
                {bestStreak >= 3 && (
                  <Text className="text-[13px] text-pet-orange-dark font-black mt-1">
                    {'\u{1F525}'} Best Streak: {bestStreak}
                  </Text>
                )}
                <TouchableOpacity onPress={handleDismiss} activeOpacity={0.85} className="mt-4 bg-pet-purple px-8 py-3 rounded-full">
                  <Text className="text-white font-black text-[14px]">Done</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        )}
      </View>
    </View>
  );
}
