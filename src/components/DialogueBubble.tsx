import { useRef, useEffect, useState, memo } from 'react';
import { View, Text, Animated } from 'react-native';

interface DialogueBubbleProps {
  message: string | null;
}

export const DialogueBubble = memo(function DialogueBubble({ message }: DialogueBubbleProps) {
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
      style={{ opacity: fadeAnim, transform: [{ scale: bounceAnim }] }}
      className="absolute top-1 left-0 right-0 z-20 items-center px-4"
    >
      <View
        className="bg-white px-4 py-2 rounded-2xl border border-pet-blue-light/70"
        style={{
          shadowColor: '#4FB0C6',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.14,
          shadowRadius: 10,
          elevation: 5,
          maxWidth: '85%',
        }}
      >
        <Text className="text-[12px] font-semibold text-gray-700 text-center">
          {displayedText}
          {isTyping && <Text className="text-pet-blue">|</Text>}
        </Text>
      </View>
    </Animated.View>
  );
});
