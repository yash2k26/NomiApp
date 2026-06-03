import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { usePetStore } from '../store/petStore';
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
    repairInFlightRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    applyStreakRepair({ useFreeze: true });
    notify.success(`Streak restored: ${lostStreak} days`, 'Used 1 streak freeze. Keep it going!', { category: 'streak' });
    onDismiss();
    // No need to reset the ref — modal is closing and component will unmount.
  };

  const payWith = async (currency: 'SOL' | 'SKR') => {
    if (repairInFlightRef.current) return;
    if (!authToken) {
      notify.warning('Wallet disconnected', 'Reconnect your wallet to repair the streak.');
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

    repairInFlightRef.current = true;
    setMode('paying');
    try {
      if (currency === 'SOL') {
        await transferSOL(authToken, SHOP_TREASURY, REPAIR_COST_SOL, `oracle-pet:streak-repair`);
        applyStreakRepair({ cost_sol: REPAIR_COST_SOL });
        await refreshBalance().catch(() => {});
      } else {
        await transferSkr(authToken, SHOP_TREASURY, REPAIR_COST_SKR, `oracle-pet:streak-repair`);
        applyStreakRepair({ cost_skr: REPAIR_COST_SKR });
        await refreshSkrBalance().catch(() => {});
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
