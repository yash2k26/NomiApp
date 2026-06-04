import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { usePetStore, getStreakRepairWindowMs } from '../store/petStore';
import { useWalletStore } from '../store/walletStore';
import { petTypography } from '../theme/typography';
import { transferSOL } from '../lib/solanaTransactions';
import { transferSkr } from '../lib/skrToken';
import { SHOP_TREASURY } from '../lib/solanaClient';
import { parseTxError } from '../lib/transactionErrors';
import { captureError } from '../lib/analytics';
import { notify } from '../lib/notify';

const REPAIR_COST_SOL = 0.01;
const REPAIR_COST_SKR = 10;

type Mode = 'idle' | 'paying';

export function StreakRepairModal({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const lostStreak = usePetStore((s) => s.lastBrokenStreak);
  const streakBrokenAt = usePetStore((s) => s.streakBrokenAt);
  const freezes = usePetStore((s) => s.streakFreezes);
  const applyStreakRepair = usePetStore((s) => s.applyStreakRepair);
  const dismissStreakRepair = usePetStore((s) => s.dismissStreakRepair);
  const balance = useWalletStore((s) => s.balance);
  const skrBalance = useWalletStore((s) => s.skrBalance);
  const authToken = useWalletStore((s) => s.authToken);
  const refreshBalance = useWalletStore((s) => s.refreshBalance);
  const refreshSkrBalance = useWalletStore((s) => s.refreshSkrBalance);
  const [mode, setMode] = useState<Mode>('idle');
  // Synchronous re-entry guard. Without it, a user who taps Freeze and SOL
  // in rapid succession would fire BOTH paths — applyStreakRepair runs from
  // useFreeze synchronously, then payWith fires its own transferSOL. Result:
  // streak repaired AND charged in SOL. The ref blocks the second tap before
  // either side starts.
  const repairInFlightRef = useRef(false);

  if (!visible || !lostStreak) return null;

  const useFreeze = () => {
    if (freezes < 1) return;
    if (repairInFlightRef.current) return;
    // Confirmation before consuming a freeze — they're a real, finite resource.
    // The audit caught users tapping this by accident and losing one with no
    // warning.
    Alert.alert(
      'Use 1 streak freeze?',
      `Restore your ${lostStreak}-day streak. You have ${freezes} freeze${freezes === 1 ? '' : 's'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use freeze',
          style: 'default',
          onPress: async () => {
            if (repairInFlightRef.current) return;
            repairInFlightRef.current = true;
            const ok = await applyStreakRepair({ useFreeze: true });
            if (ok) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              notify.success(`Streak restored: ${lostStreak} days`, 'Used 1 streak freeze. Keep it going!', { category: 'streak' });
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              notify.warning('Repair window expired', "We couldn't restore the streak — start a fresh one!", { category: 'streak' });
            }
            onDismiss();
          },
        },
      ],
    );
  };

  const payWith = async (currency: 'SOL' | 'SKR') => {
    if (repairInFlightRef.current) return;
    if (!authToken) {
      notify.warning('Wallet disconnected', 'Reconnect your wallet to repair the streak.');
      return;
    }
    // CRITICAL pre-check: never charge real SOL/SKR for a repair we can't
    // apply. If the repair window expired between the modal opening and the
    // user tapping pay, or the broken-streak state was cleared elsewhere,
    // abort BEFORE the transfer. Previously we'd take the user's money and
    // then silently no-op the local repair.
    if (!lostStreak || lostStreak < 1 || Date.now() - streakBrokenAt > getStreakRepairWindowMs(lostStreak)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      notify.warning('Repair window expired', "We can't restore this streak anymore — start a fresh one!", { category: 'streak' });
      onDismiss();
      return;
    }
    const cost = currency === 'SOL' ? REPAIR_COST_SOL : REPAIR_COST_SKR;
    const userBalance = currency === 'SOL' ? balance : skrBalance;
    if (userBalance < cost) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      notify.warning(
        `Not enough ${currency}`,
        `Need ${cost} ${currency}, you have ${userBalance.toFixed(currency === 'SOL' ? 4 : 2)}.`,
      );
      return;
    }

    // Confirm before charging real money. The audit caught users hitting Pay
    // by accident and seeing real SOL leave their wallet with no second-tap
    // safety net.
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        `Pay ${cost} ${currency}?`,
        `This will charge ${cost} ${currency}${currency === 'SOL' ? ' + a small network fee' : ''} to restore your ${lostStreak}-day streak.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: `Pay ${cost} ${currency}`, style: 'destructive', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
    if (!confirmed) return;

    repairInFlightRef.current = true;
    setMode('paying');
    try {
      let applied: boolean;
      if (currency === 'SOL') {
        await transferSOL(authToken, SHOP_TREASURY, REPAIR_COST_SOL, `oracle-pet:streak-repair`);
        applied = await applyStreakRepair({ cost_sol: REPAIR_COST_SOL });
        await refreshBalance().catch(() => {});
      } else {
        await transferSkr(authToken, SHOP_TREASURY, REPAIR_COST_SKR, `oracle-pet:streak-repair`);
        applied = await applyStreakRepair({ cost_skr: REPAIR_COST_SKR });
        await refreshSkrBalance().catch(() => {});
      }
      if (!applied) {
        // The pre-check passed but the apply failed — race (state cleared
        // mid-tx) or window crossed during the wallet prompt. User has paid
        // on-chain. Surface this loudly + capture to analytics so we can
        // help them manually if it ever happens. The on-chain memo we wrote
        // (`oracle-pet:streak-repair`) is the audit trail.
        captureError(new Error('applyStreakRepair returned false after on-chain payment'), {
          surface: 'streak_repair_race',
          currency,
          lost_streak: lostStreak,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        notify.warning(
          'Payment landed — streak not restored',
          'The repair window closed during the transfer. Your ' + currency + ' was sent; reach out and we will help.',
          { category: 'streak' },
        );
        onDismiss();
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      notify.success(
        `Streak restored: ${lostStreak} days`,
        `${cost} ${currency} paid · keep showing up!`,
        {
          category: 'streak',
          details: [
            { label: 'Days restored', value: String(lostStreak) },
            { label: 'Cost', value: `${cost} ${currency}` },
          ],
        },
      );
      onDismiss();
    } catch (err: any) {
      const parsed = parseTxError(err);
      if (parsed.type !== 'cancelled') {
        captureError(err, { surface: 'streak_repair', currency });
        notify.error(parsed.title, parsed.message, { category: 'streak' });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setMode('idle');
      // Reset the lock so the user can retry after a tx failure (cancel,
      // network drop, etc.). On success the modal dismisses and the
      // component unmounts, so we never reach a state where a stale lock
      // blocks future repair attempts.
      repairInFlightRef.current = false;
    }
  };

  const acceptLoss = () => {
    dismissStreakRepair();
    onDismiss();
  };

  const busy = mode === 'paying';

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View className="flex-1 bg-black/55 items-center justify-center px-7">
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 30,
            width: '100%',
            paddingHorizontal: 26,
            paddingVertical: 30,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#f3f4f6',
            shadowColor: '#3E8AB3',
            shadowOffset: { width: 0, height: 18 },
            shadowOpacity: 0.22,
            shadowRadius: 26,
            elevation: 16,
          }}
        >
          <View
            style={{
              width: 78,
              height: 78,
              borderRadius: 39,
              backgroundColor: '#fff7ed',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
              borderWidth: 2,
              borderColor: '#fed7aa',
            }}
          >
            <Text style={{ fontSize: 38 }}>{'\u{1F494}'}</Text>
          </View>

          <Text style={{ fontSize: 11, letterSpacing: 1.6, color: '#92400e', fontFamily: petTypography.strong, textTransform: 'uppercase', marginBottom: 6 }}>
            Streak Broken
          </Text>

          <Text style={{ fontSize: 24, color: '#1f2937', fontFamily: petTypography.display, marginBottom: 4 }}>
            {lostStreak} days lost
          </Text>

          <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', fontFamily: petTypography.body, lineHeight: 19, marginBottom: 22, paddingHorizontal: 6 }}>
            Your pet missed you. Restore your {lostStreak}-day streak before the offer expires.
          </Text>

          {freezes >= 1 && (
            <TouchableOpacity onPress={useFreeze} disabled={busy} activeOpacity={0.85} style={{ width: '100%', marginBottom: 10 }}>
              <LinearGradient
                colors={['#67BCD6', '#3E8AB3']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 10, letterSpacing: 1.6, fontFamily: petTypography.strong, marginBottom: 2 }}>
                  FREE · RECOMMENDED
                </Text>
                <Text style={{ color: '#fff', fontSize: 14, fontFamily: petTypography.strong, letterSpacing: 0.8 }}>
                  Use Streak Freeze ({freezes} left)
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => payWith('SOL')} disabled={busy} activeOpacity={0.85} style={{ width: '100%', marginBottom: 10 }}>
            <View
              style={{
                paddingVertical: 14,
                borderRadius: 16,
                alignItems: 'center',
                backgroundColor: '#f9fafb',
                borderWidth: 1,
                borderColor: '#e5e7eb',
              }}
            >
              {busy ? (
                <ActivityIndicator color="#3E8AB3" />
              ) : (
                <Text style={{ color: '#1f2937', fontSize: 14, fontFamily: petTypography.strong, letterSpacing: 0.6 }}>
                  Pay {REPAIR_COST_SOL} SOL
                </Text>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => payWith('SKR')} disabled={busy} activeOpacity={0.85} style={{ width: '100%', marginBottom: 14 }}>
            <View
              style={{
                paddingVertical: 14,
                borderRadius: 16,
                alignItems: 'center',
                backgroundColor: '#f9fafb',
                borderWidth: 1,
                borderColor: '#e5e7eb',
              }}
            >
              <Text style={{ color: '#1f2937', fontSize: 14, fontFamily: petTypography.strong, letterSpacing: 0.6 }}>
                Pay {REPAIR_COST_SKR} SKR
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={acceptLoss} disabled={busy} activeOpacity={0.7}>
            <Text style={{ color: '#9ca3af', fontSize: 12, fontFamily: petTypography.body, letterSpacing: 0.4 }}>
              No thanks, start over
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
