import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Pressable, Animated, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { playMusic, stopMusic, playSfx } from '../../lib/soundManager';

const GAME_TIME = 25;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PLAY_W = SCREEN_W - 48;
const PLAY_H = Math.min(420, SCREEN_H * 0.50);
const EMOJI_SIZE = 44;

const ALL_EMOJIS = [
  '\u{1F34E}', '\u{1F34A}', '\u{1F34B}', '\u{1F34D}', '\u{1F347}',
  '\u{1F353}', '\u{1F352}', '\u{1F351}', '\u{1F95D}', '\u{1F346}',
  '\u{1F955}', '\u{1F33D}',
];

interface FallingEmoji {
  id: number;
  emoji: string;
  x: number;
  fallAnim: Animated.Value;
  isTarget: boolean;
}

// Floating score text
function FloatingScore({ text, color, x, y }: { text: string; color: string; x: number; y: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [anim]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: x, top: y,
        opacity: anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] }),
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }) }],
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: '900', color }}>{text}</Text>
    </Animated.View>
  );
}

interface EmojiCatchProps {
  onComplete: (score: number, xp: number) => void;
  onCancel: () => void;
}

export function EmojiCatch({ onComplete, onCancel }: EmojiCatchProps) {
  const [targetEmoji, setTargetEmoji] = useState(() => ALL_EMOJIS[Math.floor(Math.random() * ALL_EMOJIS.length)]);
  const [emojis, setEmojis] = useState<FallingEmoji[]>([]);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [score, setScore] = useState(0);
  const [caught, setCaught] = useState(0);
  const [missed, setMissed] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [floats, setFloats] = useState<{ id: number; text: string; color: string; x: number; y: number }[]>([]);

  const nextId = useRef(0);
  const floatId = useRef(0);
  const spawnRate = useRef(900);

  // Music
  useEffect(() => {
    playMusic('game1');
    return () => { stopMusic(); };
  }, []);

  // Timer
  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { setGameOver(true); return 0; }
        // Speed up spawn rate as time passes
        spawnRate.current = Math.max(400, 900 - (GAME_TIME - t + 1) * 20);
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameOver]);

  // Spawn emojis
  useEffect(() => {
    if (gameOver) return;
    let timeout: ReturnType<typeof setTimeout>;

    const spawn = () => {
      const id = nextId.current++;
      const isTarget = Math.random() < 0.4; // 40% chance target
      const emoji = isTarget ? targetEmoji : ALL_EMOJIS.filter(e => e !== targetEmoji)[Math.floor(Math.random() * (ALL_EMOJIS.length - 1))];
      const x = Math.random() * (PLAY_W - EMOJI_SIZE);
      const fallAnim = new Animated.Value(0);

      const newEmoji: FallingEmoji = { id, emoji, x, fallAnim, isTarget };

      setEmojis(prev => [...prev.slice(-12), newEmoji]); // keep max 12 on screen

      // Animate falling
      const fallDuration = 2500 + Math.random() * 1000;
      Animated.timing(fallAnim, {
        toValue: 1,
        duration: fallDuration,
        useNativeDriver: true,
      }).start(() => {
        // Remove emoji when it reaches bottom
        setEmojis(prev => prev.filter(e => e.id !== id));
      });

      timeout = setTimeout(spawn, spawnRate.current);
    };

    timeout = setTimeout(spawn, 300);
    return () => clearTimeout(timeout);
  }, [gameOver, targetEmoji]);

  // Final results state
  const [finalResult, setFinalResult] = useState<{ score: number; xp: number } | null>(null);

  // End game
  useEffect(() => {
    if (!gameOver) return;
    const finalScore = Math.max(0, score);
    const xp = Math.round(10 + caught * 3);
    setFinalResult({ score: finalScore, xp: Math.min(xp, 50) });
    playSfx('gamevictory').catch(() => {});
  }, [gameOver, score, caught]);

  const handleDismiss = () => {
    if (finalResult) onComplete(finalResult.score, finalResult.xp);
  };

  const addFloat = useCallback((text: string, color: string, x: number, y: number) => {
    const id = floatId.current++;
    setFloats(prev => [...prev.slice(-4), { id, text, color, x, y }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 700);
  }, []);

  const handleTap = useCallback((emoji: FallingEmoji, tapY: number) => {
    if (gameOver) return;

    // Remove the tapped emoji
    setEmojis(prev => prev.filter(e => e.id !== emoji.id));

    if (emoji.isTarget) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setScore(s => s + 10);
      setCaught(c => c + 1);
      addFloat('+10', '#22C55E', emoji.x, tapY);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setScore(s => Math.max(0, s - 5));
      setMissed(m => m + 1);
      addFloat('-5', '#EF4444', emoji.x, tapY);
    }
  }, [gameOver, addFloat]);

  const timeColor = timeLeft <= 8 ? 'text-red-500' : 'text-gray-700';

  return (
    <View className="flex-1 bg-pet-background px-4 pt-4">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <TouchableOpacity onPress={onCancel}>
          <View className="flex-row items-center"><MaterialCommunityIcons name="arrow-left" size={16} color="#7C3AED" style={{ marginRight: 4 }} /><Text className="text-pet-purple font-bold text-[14px]">Back</Text></View>
        </TouchableOpacity>
        <View className="flex-row items-center">
          <View className="bg-gray-100 px-3 py-1.5 rounded-full mr-2">
            <Text className={`font-black text-[12px] ${timeColor}`}>{'\u23F1'} {timeLeft}s</Text>
          </View>
          <View className="bg-green-50 px-3 py-1.5 rounded-full">
            <Text className="text-green-600 font-black text-[12px]">{'\u2B50'} {score}</Text>
          </View>
        </View>
      </View>

      {/* Target indicator */}
      <View className="items-center mb-3">
        <View className="flex-row items-center bg-white rounded-full px-5 py-2.5 border-2 border-green-200"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}
        >
          <Text className="text-gray-500 font-bold text-[13px] mr-2">Catch:</Text>
          <Text className="text-[32px]">{targetEmoji}</Text>
        </View>
      </View>

      {/* Play area */}
      <View
        className="bg-white/50 rounded-3xl border border-gray-200 overflow-hidden"
        style={{ height: PLAY_H, width: PLAY_W, alignSelf: 'center' }}
      >
        {emojis.map(e => (
          <Animated.View
            key={e.id}
            style={{
              position: 'absolute',
              left: e.x,
              transform: [{
                translateY: e.fallAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-EMOJI_SIZE, PLAY_H],
                }),
              }],
            }}
          >
            <TouchableOpacity
              onPress={() => handleTap(e, PLAY_H * 0.3)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: EMOJI_SIZE - 8 }}>{e.emoji}</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}

        {/* Floating scores */}
        {floats.map(f => (
          <FloatingScore key={f.id} text={f.text} color={f.color} x={f.x} y={f.y} />
        ))}
      </View>

      {/* Stats bar */}
      <View className="flex-row justify-center mt-3" style={{ gap: 16 }}>
        <Text className="text-green-600 font-bold text-[12px]">{'\u2705'} {caught} caught</Text>
        <Text className="text-red-400 font-bold text-[12px]">{'\u274C'} {missed} wrong</Text>
      </View>

      {/* Game over overlay */}
      {gameOver && (
        <Pressable className="absolute inset-0 bg-black/30 items-center justify-center" onPress={handleDismiss}>
          <Pressable>
            <View className="bg-white rounded-3xl p-8 items-center mx-8">
              <Text className="text-[48px] mb-2">{targetEmoji}</Text>
              <Text className="text-[24px] font-black text-gray-800 mb-1">Time's Up!</Text>
              <Text className="text-[14px] text-gray-500 font-semibold">
                {caught} caught {'\u2022'} {missed} wrong
              </Text>
              <Text className="text-[18px] font-black text-green-600 mt-2">{score} pts</Text>
              <TouchableOpacity onPress={handleDismiss} activeOpacity={0.85} className="mt-4 bg-pet-purple px-8 py-3 rounded-full">
                <Text className="text-white font-black text-[14px]">Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}
