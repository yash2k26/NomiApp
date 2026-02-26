import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const EMOJIS = ['\u{1F436}', '\u{1F431}', '\u{1F430}', '\u{1F43C}', '\u{1F438}', '\u{1F427}',
                '\u{1F981}', '\u{1F422}', '\u{1F98A}', '\u{1F40D}', '\u{1F419}', '\u{1F41D}'];
const GAME_TIME = 60;

interface Card {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

function createCards(pairs: number): Card[] {
  const selected = EMOJIS.slice(0, pairs);
  const cards = [...selected, ...selected].map((emoji, i) => ({
    id: i,
    emoji,
    flipped: false,
    matched: false,
  }));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function MemoryCard({ card, onPress, disabled }: { card: Card; onPress: () => void; disabled: boolean }) {
  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(flipAnim, {
      toValue: card.flipped || card.matched ? 1 : 0,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [card.flipped, card.matched, flipAnim]);

  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
  const backOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] });

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || card.flipped || card.matched}
      activeOpacity={0.8}
      style={{ width: '23%', aspectRatio: 1, margin: '1%' }}
    >
      <View className="flex-1 rounded-xl overflow-hidden">
        <Animated.View
          style={{ opacity: backOpacity, position: 'absolute', width: '100%', height: '100%' }}
          className="bg-pet-purple items-center justify-center rounded-xl border-2 border-pet-purple-dark"
        >
          <Text className="text-[20px]">{'\u2753'}</Text>
        </Animated.View>
        <Animated.View
          style={{ opacity: frontOpacity, position: 'absolute', width: '100%', height: '100%' }}
          className={`items-center justify-center rounded-xl border-2 ${card.matched ? 'bg-pet-green-light/40 border-pet-green' : 'bg-white border-pet-blue-light'}`}
        >
          <Text className="text-[24px]">{card.emoji}</Text>
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

// Floating text that drifts up and fades out
function FloatingText({ text, color, x, y }: { text: string; color: string; x: number; y: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, [anim]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity: anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }) }],
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: '900', color }}>{text}</Text>
    </Animated.View>
  );
}

interface MemoryMatchProps {
  onComplete: (score: number, xp: number) => void;
  onCancel: () => void;
}

export function MemoryMatch({ onComplete, onCancel }: MemoryMatchProps) {
  const PAIRS = 6;
  const [cards, setCards] = useState(() => createCards(PAIRS));
  const [selected, setSelected] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [mistakes, setMistakes] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [checking, setChecking] = useState(false);

  // Combo system
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [floats, setFloats] = useState<{ id: number; text: string; color: string; x: number; y: number }[]>([]);
  const floatId = useRef(0);

  // Peek power-up: briefly reveal all cards (once per game)
  const [peekUsed, setPeekUsed] = useState(false);
  const [peeking, setPeeking] = useState(false);

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

  // Check win
  useEffect(() => {
    if (matchedCount >= PAIRS && !gameOver) {
      setGameOver(true);
    }
  }, [matchedCount, gameOver]);

  // End game
  useEffect(() => {
    if (!gameOver) return;
    const won = matchedCount >= PAIRS;
    const timeBonus = Math.max(0, timeLeft * 0.5);
    const comboBonus = bestCombo * 3;
    const mistakePenalty = mistakes * 2;
    const score = won
      ? Math.round(Math.max(10, 100 - mistakePenalty + timeBonus + comboBonus))
      : Math.round(matchedCount * 8 + comboBonus);
    const xp = won ? Math.round(20 + timeBonus + comboBonus * 0.5) : Math.round(10 + matchedCount * 3);

    const timer = setTimeout(() => onComplete(score, Math.min(xp, 50)), 1800);
    return () => clearTimeout(timer);
  }, [gameOver, matchedCount, timeLeft, mistakes, bestCombo, onComplete]);

  const addFloat = (text: string, color: string) => {
    const id = floatId.current++;
    // Random position near center
    const x = 100 + Math.random() * 120;
    const y = 60 + Math.random() * 40;
    setFloats(prev => [...prev.slice(-4), { id, text, color, x, y }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 900);
  };

  const handlePeek = () => {
    if (peekUsed || peeking || checking || gameOver) return;
    setPeekUsed(true);
    setPeeking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Briefly show all unmatched cards
    setCards(prev => prev.map(c => c.matched ? c : { ...c, flipped: true }));
    setTimeout(() => {
      setCards(prev => prev.map(c => c.matched ? c : { ...c, flipped: false }));
      setPeeking(false);
    }, 1200);
  };

  const handleCardPress = useCallback((index: number) => {
    if (checking || selected.length >= 2 || peeking) return;

    const card = cards[index];
    if (card.flipped || card.matched) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newCards = [...cards];
    newCards[index] = { ...newCards[index], flipped: true };
    setCards(newCards);

    const newSelected = [...selected, index];
    setSelected(newSelected);

    if (newSelected.length === 2) {
      setChecking(true);
      const [first, second] = newSelected;
      const isMatch = newCards[first].emoji === newCards[second].emoji;

      setTimeout(() => {
        if (isMatch) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setCards(prev => prev.map((c, i) =>
            i === first || i === second ? { ...c, matched: true } : c
          ));
          setMatchedCount(m => m + 1);

          // Combo logic
          setCombo(prev => {
            const newCombo = prev + 1;
            if (newCombo > 1) {
              addFloat(`${newCombo}x Combo!`, '#9381FF');
            } else {
              addFloat('+Match!', '#34C759');
            }
            setBestCombo(b => Math.max(b, newCombo));
            return newCombo;
          });
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setCards(prev => prev.map((c, i) =>
            i === first || i === second ? { ...c, flipped: false } : c
          ));
          setMistakes(m => m + 1);
          setCombo(0); // Reset combo
          addFloat('Miss!', '#FF6B6B');
        }
        setSelected([]);
        setChecking(false);
      }, 800);
    }
  }, [cards, selected, checking, peeking]);

  const timeColor = timeLeft <= 10 ? 'text-pet-pink-dark' : 'text-pet-purple-dark';

  return (
    <View className="flex-1 bg-pet-background px-4 pt-4">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <TouchableOpacity onPress={onCancel}>
          <Text className="text-pet-purple font-bold text-[14px]">{'\u2190'} Back</Text>
        </TouchableOpacity>
        <View className="flex-row items-center">
          {combo > 1 && (
            <View className="bg-pet-purple/20 px-2.5 py-1.5 rounded-full mr-2">
              <Text className="text-pet-purple font-black text-[11px]">{'\u{1F525}'} {combo}x</Text>
            </View>
          )}
          <View className="bg-pet-purple-light/30 px-3 py-1.5 rounded-full mr-2">
            <Text className={`font-black text-[12px] ${timeColor}`}>{'\u23F1'} {timeLeft}s</Text>
          </View>
          <View className="bg-pet-pink-light/30 px-3 py-1.5 rounded-full">
            <Text className="text-pet-pink-dark font-black text-[12px]">{matchedCount}/{PAIRS}</Text>
          </View>
        </View>
      </View>

      {/* Peek button */}
      <View className="flex-row justify-center mb-3">
        <TouchableOpacity onPress={handlePeek} disabled={peekUsed || peeking || gameOver} activeOpacity={0.8}>
          <View className={`flex-row items-center px-4 py-2 rounded-full border ${
            peekUsed ? 'bg-gray-100 border-gray-200' : 'bg-pet-gold-light/30 border-pet-gold'
          }`}>
            <Text className="text-[14px] mr-1.5">{'\u{1F441}'}</Text>
            <Text className={`text-[11px] font-black ${peekUsed ? 'text-gray-400' : 'text-pet-gold-dark'}`}>
              {peekUsed ? 'Peek Used' : 'Peek (1x)'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Game grid */}
      <View className="flex-row flex-wrap justify-center">
        {cards.map((card, i) => (
          <MemoryCard
            key={card.id}
            card={card}
            onPress={() => handleCardPress(i)}
            disabled={checking || gameOver || peeking}
          />
        ))}
      </View>

      {/* Floating combo/miss text */}
      {floats.map(f => (
        <FloatingText key={f.id} text={f.text} color={f.color} x={f.x} y={f.y} />
      ))}

      {/* Game over overlay */}
      {gameOver && (
        <View className="absolute inset-0 bg-black/30 items-center justify-center">
          <View className="bg-white rounded-3xl p-8 items-center mx-8">
            <Text className="text-[48px] mb-2">{matchedCount >= PAIRS ? '\u{1F389}' : '\u{23F0}'}</Text>
            <Text className="text-[24px] font-black text-gray-800 mb-1">
              {matchedCount >= PAIRS ? 'You Won!' : 'Time\'s Up!'}
            </Text>
            <Text className="text-[14px] text-gray-500 font-semibold">
              {matchedCount}/{PAIRS} pairs {'\u2022'} {mistakes} mistakes
            </Text>
            {bestCombo > 1 && (
              <Text className="text-[13px] text-pet-purple font-black mt-1">
                {'\u{1F525}'} Best Combo: {bestCombo}x
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
