import { useRef, useCallback } from 'react';
import { View, GestureResponderEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { usePersonalityStore, getActionDialogue } from '../store/personalityStore';
import { usePetStore } from '../store/petStore';

interface TouchInteractionLayerProps {
  children: React.ReactNode;
  viewHeight: number;
  onDoubleTap: (e: GestureResponderEvent) => void;
}

export function TouchInteractionLayer({ children, viewHeight, onDoubleTap }: TouchInteractionLayerProps) {
  const lastTapRef = useRef(0);
  const lastTapXRef = useRef(0);
  const lastTapYRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const touchStartRef = useRef(0);

  const { canTouch, setTouchCooldown, recordMemory, setCurrentDialogue } = usePersonalityStore.getState();
  const traits = usePersonalityStore((s) => s.traits);

  const handleTouchStart = useCallback((_e: GestureResponderEvent) => {
    touchStartRef.current = Date.now();
    isLongPressRef.current = false;

    // Start long press timer (1 second)
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      const ps = usePersonalityStore.getState();
      if (!ps.canTouch()) return;

      // Hug reaction
      ps.setTouchCooldown();
      ps.recordMemory('touched_hug');
      ps.setCurrentDialogue(
        getRandomHugDialogue(traits)
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      // Small happiness boost
      const petStore = usePetStore;
      petStore.setState((s) => ({
        happiness: Math.min(100, s.happiness + 3),
      }));
    }, 1000);
  }, [traits]);

  const handleTouchEnd = useCallback((e: GestureResponderEvent) => {
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // If it was a long press, don't process tap
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }

    const now = Date.now();
    const { pageX, pageY } = e.nativeEvent;
    const timeSinceTouchStart = now - touchStartRef.current;

    // Ignore if held too long (but not long enough for long press)
    if (timeSinceTouchStart > 500) return;

    // Check for double tap first
    const dx = Math.abs(pageX - lastTapXRef.current);
    const dy = Math.abs(pageY - lastTapYRef.current);
    const timeDiff = now - lastTapRef.current;

    if (timeDiff < 400 && dx < 50 && dy < 50) {
      // Double tap — delegate to existing handler
      lastTapRef.current = 0;
      onDoubleTap(e);
      return;
    }

    lastTapRef.current = now;
    lastTapXRef.current = pageX;
    lastTapYRef.current = pageY;

    // Single tap — determine zone (after a brief delay to rule out double tap)
    setTimeout(() => {
      // If another tap happened (double tap detected), skip
      if (lastTapRef.current !== now) return;

      const ps = usePersonalityStore.getState();
      if (!ps.canTouch()) return;
      ps.setTouchCooldown();

      // Calculate relative Y position within the pet view
      const relativeY = pageY; // approximate — works for zone detection
      const upperThreshold = viewHeight * 0.35;

      if (relativeY < upperThreshold) {
        // Head pat — upper area
        ps.recordMemory('touched_headpat');
        ps.setCurrentDialogue(getRandomHeadpatDialogue(traits));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Small happiness boost
        usePetStore.setState((s) => ({
          happiness: Math.min(100, s.happiness + 2),
        }));
      } else {
        // Poke — middle/lower area
        ps.recordMemory('touched_poke');
        ps.setCurrentDialogue(getRandomPokeDialogue(traits));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }, 420); // Slightly longer than double-tap window
  }, [onDoubleTap, viewHeight, traits]);

  return (
    <View
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ flex: 1 }}
    >
      {children}
    </View>
  );
}

// ── Touch dialogue pools ──

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomHeadpatDialogue(traits: { playful: number; foodie: number; sleepy: number }): string {
  const lines = [
    'Hehe, that tickles!',
    'More pats please~',
    "Mmm, that feels so nice!",
    '*purrs happily*',
    'I love head pats!',
    "You're the best at this.",
    '*leans into your hand*',
    'Right there... perfect!',
  ];
  if (traits.playful > 50) lines.push('Hehe! Again again!', 'Wheee!');
  if (traits.sleepy > 50) lines.push('Mmm... so relaxing...', '*getting drowsy*');
  return pick(lines);
}

function getRandomPokeDialogue(traits: { playful: number }): string {
  const lines = [
    'Hey! What was that?!',
    'Eep! You poked me!',
    '*jumps* Oh! Hi!',
    "That surprised me!",
    'Excuse me?! Rude!',
    "*giggles* Don't do that!",
    'Boop!',
    'Hey hey hey!',
  ];
  if (traits.playful > 50) lines.push("Oh you wanna play? Let's go!", 'Poke me again, I dare you!');
  return pick(lines);
}

function getRandomHugDialogue(traits: { social: number }): string {
  const lines = [
    'I feel so loved right now...',
    '*melts into the hug*',
    "Never let go...",
    'This is the best feeling ever.',
    '*happy sigh*',
    'I needed this. Thank you.',
    "You're so warm~",
    'Hugs are the best medicine.',
  ];
  if (traits.social > 50) lines.push("I love you so much!", "You're my favorite person in the whole world.");
  return pick(lines);
}
