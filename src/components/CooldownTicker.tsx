import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { usePetStore } from '../store/petStore';
import { getVariantsForAction } from '../data/careVariants';
import { petTypography } from '../theme/typography';

/*
 * CooldownTicker
 *
 * Persistent next-ready widget for HomeScreen. Care actions live behind
 * cooldown timers, but those timers are buried in the per-action modal — a
 * user closing the modal has no way to see "feed is ready in 2:34" without
 * tapping back in. This widget surfaces all three (feed/play/rest) at a
 * glance so dead time becomes anticipation instead of confusion.
 *
 * Design notes:
 *   - Each row reads the MIN cooldown across that action's variants. As long
 *     as one variant is ready, the action is tappable, so showing the
 *     soonest-ready time is honest.
 *   - "Ready" rows render in green so the eye scans straight to actionable
 *     items. Auto-hides when ALL three are ready (no value-add).
 *   - 1-second tick — cheap because it only re-renders this small component.
 */

const ACTIONS: Array<{ key: 'feed' | 'play' | 'rest'; label: string; emoji: string }> = [
  { key: 'feed', label: 'Feed', emoji: '\u{1F356}' },
  { key: 'play', label: 'Play', emoji: '\u{1F389}' },
  { key: 'rest', label: 'Rest', emoji: '\u{1F4A4}' },
];

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Ready';
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return `${min}:${sec.toString().padStart(2, '0')}`;
  return `${sec}s`;
}

export function CooldownTicker() {
  const isOnCooldown = usePetStore((s) => s.isOnCooldown);
  const getCooldownRemaining = usePetStore((s) => s.getCooldownRemaining);
  const [, setTick] = useState(0);

  // Re-render every 5s. Care cooldowns are minutes long (5/8/10), so per-second
  // updates were overkill — they triggered ~720 render cycles/hour on Home for
  // basically no visual change after the first minute. 5s keeps the ticker
  // useful (sub-minute precision when getting close to ready) without spamming
  // the render queue.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  // For each action, find the soonest-ready variant. If ANY variant is off
  // cooldown, the action is ready right now (remaining=0).
  const rows = ACTIONS.map((action) => {
    const variants = getVariantsForAction(action.key);
    const allOnCooldown = variants.every((v) => isOnCooldown(v.cooldownKey));
    const remaining = allOnCooldown
      ? Math.min(...variants.map((v) => getCooldownRemaining(v.cooldownKey)))
      : 0;
    return { ...action, remaining, ready: !allOnCooldown };
  });

  // Always render the ticker so users can see "everything's ready"
  // unambiguously. Previously this hid itself when all actions were
  // ready, which caused users to miss it and assume features were
  // missing. A persistent green-row state communicates "go ahead!" much
  // better than nothing.

  return (
    <View className="px-6 mt-4">
      <View
        className="bg-white rounded-[24px] border border-pet-blue-light/40 px-4 py-3"
        style={{
          shadowColor: '#4FB0C6',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 2,
        }}
      >
        <View className="flex-row items-center justify-between mb-2">
          <Text
            className="text-[10px] font-black text-pet-blue-dark tracking-[1px] uppercase"
            style={{ fontFamily: petTypography.strong }}
          >
            Next Up
          </Text>
          <Text className="text-[9px] text-gray-400 font-semibold">live</Text>
        </View>

        <View className="flex-row" style={{ gap: 8 }}>
          {rows.map((row) => (
            <View
              key={row.key}
              className="flex-1 rounded-2xl px-2 py-2 items-center"
              style={{
                backgroundColor: row.ready ? '#ECFDF5' : '#F8FAFC',
                borderWidth: 1,
                borderColor: row.ready ? '#A7F3D0' : '#E5E7EB',
              }}
            >
              <Text className="text-base mb-0.5">{row.emoji}</Text>
              <Text
                className="text-[10px] font-black tracking-[0.4px] uppercase"
                style={{ color: row.ready ? '#047857' : '#6B7C8E' }}
              >
                {row.label}
              </Text>
              <Text
                className="text-[11px] font-black mt-0.5"
                style={{ color: row.ready ? '#047857' : '#374151' }}
              >
                {formatRemaining(row.remaining)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
