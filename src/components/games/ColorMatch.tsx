import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Pressable, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { playMusic, stopMusic, playSfx } from '../../lib/soundManager';

const GAME_TIME = 30;

const COLORS: { name: string; hex: string }[] = [
  { name: 'RED', hex: '#EF4444' },
  { name: 'BLUE', hex: '#3B82F6' },
  { name: 'GREEN', hex: '#22C55E' },
  { name: 'YELLOW', hex: '#EAB308' },
  { name: 'PURPLE', hex: '#A855F7' },
  { name: 'ORANGE', hex: '#F97316' },
];

function pickRound(): { word: string; textColor: string; correctIndex: number; options: string[] } {
  const wordIdx = Math.floor(Math.random() * COLORS.length);
  let colorIdx = Math.floor(Math.random() * COLORS.length);
  while (colorIdx === wordIdx) colorIdx = Math.floor(Math.random() * COLORS.length);

  const correctHex = COLORS[colorIdx].hex;
  const correctName = COLORS[colorIdx].name;

  // Build 4 options, one is correct
  const optionSet = new Set<string>([correctName]);
  while (optionSet.size < 4) {
    optionSet.add(COLORS[Math.floor(Math.random() * COLORS.length)].name);
  }
  const options = Array.from(optionSet).sort(() => Math.random() - 0.5);
  const correctIndex = options.indexOf(correctName);

  return { word: COLORS[wordIdx].name, textColor: correctHex, correctIndex, options };
}

function getHexForName(name: string): string {
  return COLORS.find(c => c.name === name)?.hex ?? '#000';
}

// Floating score text
function FloatingScore({ text, color }: { text: string; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, [anim]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', alignSelf: 'center', top: 200,
        opacity: anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] }),
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -50] }) }],
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: '900', color }}>{text}</Text>
    </Animated.View>
  );
}

interface ColorMatchProps {
  onComplete: (score: number, xp: number) => void;
  onCancel: () => void;
}

export function ColorMatch({ onComplete, onCancel }: ColorMatchProps) {
  const [round, setRound] = useState(() => pickRound());
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [floatKey, setFloatKey] = useState(0);
  const [floatText, setFloatText] = useState('');
  const [floatColor, setFloatColor] = useState('');

  const scaleAnim = useRef(new Animated.Value(1)).current;

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
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameOver]);

  // Final results state
  const [finalResult, setFinalResult] = useState<{ score: number; xp: number } | null>(null);

  // End game
  useEffect(() => {
    if (!gameOver) return;
    const streakBonus = bestStreak * 3;
    const finalScore = Math.max(0, score + streakBonus);
    const xp = Math.round(15 + correct * 2 + bestStreak * 2);
    setFinalResult({ score: finalScore, xp: Math.min(xp, 60) });
    playSfx('gamevictory').catch(() => {});
  }, [gameOver, score, bestStreak, correct]);

  const handleDismiss = () => {
    if (finalResult) onComplete(finalResult.score, finalResult.xp);
  };

  const showFloat = (text: string, color: string) => {
    setFloatText(text);
    setFloatColor(color);
    setFloatKey(k => k + 1);
  };

  const handleAnswer = useCallback((optionName: string) => {
    if (gameOver) return;

    const isCorrect = optionName === round.options[round.correctIndex];

    if (isCorrect) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const streakMultiplier = Math.min(streak + 1, 5);
      const points = 10 * streakMultiplier;
      setScore(s => s + points);
      setStreak(s => {
        const newS = s + 1;
        setBestStreak(b => Math.max(b, newS));
        return newS;
      });
      setCorrect(c => c + 1);
      showFloat(`+${points}`, '#22C55E');
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setScore(s => Math.max(0, s - 5));
      setStreak(0);
      setWrong(w => w + 1);
      showFloat('-5', '#EF4444');
    }

    // Pulse animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.15, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    setRound(pickRound());
  }, [gameOver, round, streak, scaleAnim]);

  const timeColor = timeLeft <= 10 ? 'text-red-500' : 'text-gray-700';

  return (
    <View className="flex-1 bg-pet-background px-4 pt-4">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <TouchableOpacity onPress={onCancel}>
          <Text className="text-pet-purple font-bold text-[14px]">{'\u2190'} Back</Text>
        </TouchableOpacity>
        <View className="flex-row items-center">
          {streak > 1 && (
            <View className="bg-orange-100 px-2.5 py-1.5 rounded-full mr-2">
              <Text className="text-orange-600 font-black text-[11px]">{'\u{1F525}'} {streak}x</Text>
            </View>
          )}
          <View className="bg-gray-100 px-3 py-1.5 rounded-full mr-2">
            <Text className={`font-black text-[12px] ${timeColor}`}>{'\u23F1'} {timeLeft}s</Text>
          </View>
          <View className="bg-blue-50 px-3 py-1.5 rounded-full">
            <Text className="text-blue-600 font-black text-[12px]">{'\u2B50'} {score}</Text>
          </View>
        </View>
      </View>

      {/* Instruction */}
      <Text className="text-center text-gray-400 font-bold text-[12px] mb-6">
        Tap the color of the TEXT, not the word!
      </Text>

      {/* Word display */}
      <View className="items-center mb-10">
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Text style={{ fontSize: 52, fontWeight: '900', color: round.textColor, letterSpacing: 4 }}>
            {round.word}
          </Text>
        </Animated.View>
      </View>

      {/* Answer buttons - 2x2 grid */}
      <View className="flex-row flex-wrap justify-center" style={{ gap: 12, paddingHorizontal: 16 }}>
        {round.options.map((opt, i) => (
          <TouchableOpacity
            key={`${opt}-${i}`}
            onPress={() => handleAnswer(opt)}
            disabled={gameOver}
            activeOpacity={0.85}
            style={{ width: '46%' }}
          >
            <View
              className="rounded-2xl py-5 items-center border-2"
              style={{
                backgroundColor: getHexForName(opt) + '20',
                borderColor: getHexForName(opt) + '60',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '900', color: getHexForName(opt) }}>{opt}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Floating score */}
      {floatText ? <FloatingScore key={floatKey} text={floatText} color={floatColor} /> : null}

      {/* Game over overlay */}
      {gameOver && (
        <Pressable className="absolute inset-0 bg-black/30 items-center justify-center" onPress={handleDismiss}>
          <Pressable>
            <View className="bg-white rounded-3xl p-8 items-center mx-8">
              <Text className="text-[48px] mb-2">{'\u{1F3A8}'}</Text>
              <Text className="text-[24px] font-black text-gray-800 mb-1">Time's Up!</Text>
              <Text className="text-[14px] text-gray-500 font-semibold">
                {correct} correct {'\u2022'} {wrong} wrong
              </Text>
              <Text className="text-[18px] font-black text-blue-600 mt-2">{score} pts</Text>
              {bestStreak > 1 && (
                <Text className="text-[13px] text-orange-500 font-black mt-1">
                  {'\u{1F525}'} Best Streak: {bestStreak}x
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
  );
}
