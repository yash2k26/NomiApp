import { useRef, useEffect, useState, memo } from 'react';
import { View, Text, Animated } from 'react-native';

interface DialogueBubbleProps {
  message: string | null;
  /** Bubble sits high (crown clearance) when true, lower (just above body) when false. */
  crownEquipped?: boolean;
}

export const DialogueBubble = memo(function DialogueBubble({ message, crownEquipped = false }: DialogueBubbleProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0.92)).current;
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const prevMessageRef = useRef<string | null>(null);

  // Animate in when message changes
  useEffect(() => {
    if (!message) {
      fadeAnim.setValue(0);
      setDisplayedText('');
      prevMessageRef.current = null;
      return;
    }

    if (message === prevMessageRef.current) return;
    prevMessageRef.current = message;

    // Reset and animate in
    fadeAnim.setValue(0);
    bounceAnim.setValue(0.92);
    setDisplayedText('');
    setIsTyping(true);

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
  }, [message, fadeAnim, bounceAnim]);

  // Typing effect
  useEffect(() => {
    if (!message || !isTyping) return;

    let charIndex = 0;
    const interval = setInterval(() => {
      charIndex++;
      if (charIndex >= message.length) {
        setDisplayedText(message);
        setIsTyping(false);
        clearInterval(interval);
      } else {
        setDisplayedText(message.slice(0, charIndex));
      }
    }, 28); // ~28ms per character for natural feel

    return () => clearInterval(interval);
  }, [message, isTyping]);

  if (!message) return null;

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ scale: bounceAnim }],
        top: crownEquipped ? 4 : 12,
      }}
      className="absolute left-0 right-0 z-20 items-center px-5"
    >
      <View
        className="bg-white px-4 py-2 rounded-[20px] border border-pet-blue-light/70"
        style={{
          shadowColor: '#4FB0C6',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 4,
          maxWidth: '90%',
        }}
      >
        <Text
          numberOfLines={2}
          ellipsizeMode="tail"
          className="text-[11px] font-semibold text-gray-700 text-center"
          style={{ lineHeight: 15 }}
        >
          {displayedText}
          {isTyping && <Text className="text-pet-blue">|</Text>}
        </Text>
      </View>
    </Animated.View>
  );
});
