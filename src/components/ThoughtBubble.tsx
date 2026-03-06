import { useEffect, useRef, useState, useMemo } from 'react';
import { View, Animated, Dimensions } from 'react-native';

const HUNGER_THOUGHTS = ['\u{1F355}', '\u{1F354}', '\u{1F347}', '\u{1F958}', '\u{1F34E}', '\u{1F9C1}'];
const HAPPINESS_THOUGHTS = ['\u{1F3AE}', '\u{1F3BE}', '\u{1F9E9}', '\u{1F57A}', '\u{1F3AA}', '\u{1F3AF}'];
const ENERGY_THOUGHTS = ['\u{1F634}', '\u{1F6CF}\uFE0F', '\u{1F319}', '\u{2601}\uFE0F', '\u{1F4A4}', '\u{1F9D8}'];

const SCREEN_WIDTH = Dimensions.get('window').width;

interface ThoughtBubbleProps {
  hunger: number;
  happiness: number;
  energy: number;
}

export function ThoughtBubble({ hunger, happiness, energy }: ThoughtBubbleProps) {
  const isActive = hunger < 50 || happiness < 50 || energy < 50;

  const pool = useMemo(() => {
    const combined: string[] = [];
    if (hunger < 50) combined.push(...HUNGER_THOUGHTS);
    if (happiness < 50) combined.push(...HAPPINESS_THOUGHTS);
    if (energy < 50) combined.push(...ENERGY_THOUGHTS);
    return combined;
  }, [hunger < 50, happiness < 50, energy < 50]);

  const [currentEmoji, setCurrentEmoji] = useState(() =>
    pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : ''
  );

  const cloudAnim = useRef(new Animated.Value(0)).current;
  const emojiAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(cloudAnim, {
      toValue: isActive ? 1 : 0,
      friction: 8,
      tension: 80,
      useNativeDriver: true,
    }).start();

    if (isActive) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, { toValue: -5, duration: 1800, useNativeDriver: true }),
          Animated.timing(floatAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isActive, cloudAnim, floatAnim]);

  useEffect(() => {
    if (!isActive || pool.length === 0) return;

    setCurrentEmoji(pool[Math.floor(Math.random() * pool.length)]);
    emojiAnim.setValue(1);

    const scheduleNext = () => {
      const delay = 5000 + Math.random() * 2000;
      return setTimeout(() => {
        Animated.timing(emojiAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(() => {
          setCurrentEmoji(pool[Math.floor(Math.random() * pool.length)]);
          Animated.timing(emojiAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }).start();
        });
        timer = scheduleNext();
      }, delay);
    };

    let timer = scheduleNext();
    return () => clearTimeout(timer);
  }, [isActive, pool, emojiAnim]);

  if (!isActive) return null;

  // Center the bubble above Nomi's head
  // Pet view is 390px tall, Nomi's head is roughly at ~35% from top
  // Bubble is 56px wide, center it on screen
  const bubbleLeft = (SCREEN_WIDTH / 2) + 30;

  return (
    <Animated.View
      style={{
        opacity: cloudAnim,
        transform: [
          { scale: cloudAnim },
          { translateY: floatAnim },
        ],
        position: 'absolute',
        top: 100,
        left: bubbleLeft,
        zIndex: 20,
        alignItems: 'center',
      }}
      pointerEvents="none"
    >
      {/* Cloud */}
      <View style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.55)',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Animated.Text
          style={{
            fontSize: 22,
            opacity: emojiAnim,
            transform: [{ scale: emojiAnim }],
          }}
        >
          {currentEmoji}
        </Animated.Text>
      </View>

      {/* Dot 1 */}
      <View style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'rgba(255, 255, 255, 0.45)',
        marginTop: 3,
        marginLeft: -14,
      }} />
      {/* Dot 2 */}
      <View style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.35)',
        marginTop: 2,
        marginLeft: -24,
      }} />
    </Animated.View>
  );
}
