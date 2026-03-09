import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Pressable, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { playMusic, stopMusic, playSfx } from '../../lib/soundManager';

const GAME_TIME = 30;

type Op = '+' | '-' | '\u00D7';

function generateProblem(difficulty: number): { question: string; answer: number; choices: number[] } {
  const ops: Op[] = difficulty < 5 ? ['+', '-'] : ['+', '-', '\u00D7'];
  const op = ops[Math.floor(Math.random() * ops.length)];

  let a: number, b: number, answer: number;
  const maxNum = Math.min(12 + difficulty * 3, 50);

  switch (op) {
    case '+':
      a = Math.floor(Math.random() * maxNum) + 1;
      b = Math.floor(Math.random() * maxNum) + 1;
      answer = a + b;
      break;
    case '-':
      a = Math.floor(Math.random() * maxNum) + 2;
      b = Math.floor(Math.random() * a) + 1;
      answer = a - b;
      break;
    case '\u00D7':
      a = Math.floor(Math.random() * 12) + 2;
      b = Math.floor(Math.random() * 12) + 2;
      answer = a * b;
      break;
    default:
      a = 1; b = 1; answer = 2;
  }

  const question = `${a} ${op} ${b}`;

  // Generate 3 wrong answers near the correct one
  const wrongSet = new Set<number>();
  while (wrongSet.size < 3) {
    const offset = Math.floor(Math.random() * 10) - 5;
    const wrong = answer + (offset === 0 ? (Math.random() > 0.5 ? 1 : -1) : offset);
    if (wrong !== answer && wrong >= 0) wrongSet.add(wrong);
  }

  const choices = [answer, ...Array.from(wrongSet)].sort(() => Math.random() - 0.5);
  return { question, answer, choices };
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
        position: 'absolute', alignSelf: 'center', top: 180,
        opacity: anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] }),
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -50] }) }],
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: '900', color }}>{text}</Text>
    </Animated.View>
  );
}

interface MathRushProps {
  onComplete: (score: number, xp: number) => void;
  onCancel: () => void;
}

export function MathRush({ onComplete, onCancel }: MathRushProps) {
  const [solved, setSolved] = useState(0);
  const [problem, setProblem] = useState(() => generateProblem(0));
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
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
    const xp = Math.round(15 + solved * 2 + bestStreak * 2);
    setFinalResult({ score: finalScore, xp: Math.min(xp, 55) });
    playSfx('gamevictory').catch(() => {});
  }, [gameOver, score, bestStreak, solved]);

  const handleDismiss = () => {
    if (finalResult) onComplete(finalResult.score, finalResult.xp);
  };

  const showFloat = (text: string, color: string) => {
    setFloatText(text);
    setFloatColor(color);
    setFloatKey(k => k + 1);
  };

  const handleAnswer = useCallback((choice: number) => {
    if (gameOver) return;

    const isCorrect = choice === problem.answer;

    if (isCorrect) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const multiplier = Math.min(streak + 1, 5);
      const points = 10 * multiplier;
      setScore(s => s + points);
      setStreak(s => {
        const newS = s + 1;
        setBestStreak(b => Math.max(b, newS));
        return newS;
      });
      setSolved(c => c + 1);
      showFloat(`+${points}`, '#22C55E');
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setScore(s => Math.max(0, s - 5));
      setStreak(0);
      setWrong(w => w + 1);
      showFloat('-5', '#EF4444');
    }

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.12, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();

    setProblem(generateProblem(solved));
  }, [gameOver, problem, streak, solved, scaleAnim]);

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
          <View className="bg-green-50 px-3 py-1.5 rounded-full">
            <Text className="text-green-600 font-black text-[12px]">{'\u2B50'} {score}</Text>
          </View>
        </View>
      </View>

      {/* Solved count */}
      <Text className="text-center text-gray-400 font-bold text-[12px] mb-8">
        Solved: {solved} {'\u2022'} Wrong: {wrong}
      </Text>

      {/* Problem display */}
      <View className="items-center mb-10">
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Text className="text-[52px] font-black text-gray-800" style={{ letterSpacing: 2 }}>
            {problem.question}
          </Text>
        </Animated.View>
        <Text className="text-[32px] font-black text-gray-400 mt-2">= ?</Text>
      </View>

      {/* Answer buttons - 2x2 grid */}
      <View className="flex-row flex-wrap justify-center" style={{ gap: 12, paddingHorizontal: 16 }}>
        {problem.choices.map((choice, i) => (
          <TouchableOpacity
            key={`${choice}-${i}-${floatKey}`}
            onPress={() => handleAnswer(choice)}
            disabled={gameOver}
            activeOpacity={0.85}
            style={{ width: '46%' }}
          >
            <View className="bg-white rounded-2xl py-5 items-center border-2 border-gray-200"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
            >
              <Text className="text-[22px] font-black text-gray-700">{choice}</Text>
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
              <Text className="text-[48px] mb-2">{'\u{1F9EE}'}</Text>
              <Text className="text-[24px] font-black text-gray-800 mb-1">Time's Up!</Text>
              <Text className="text-[14px] text-gray-500 font-semibold">
                {solved} solved {'\u2022'} {wrong} wrong
              </Text>
              <Text className="text-[18px] font-black text-green-600 mt-2">{score} pts</Text>
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
