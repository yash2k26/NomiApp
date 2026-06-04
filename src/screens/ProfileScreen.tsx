import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking, Share } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useWalletStore } from '../store/walletStore';
import { usePetStore } from '../store/petStore';
import { useXpStore, getTitleForLevel } from '../store/xpStore';
import { useAdventureStore, EVOLUTION_STAGES } from '../store/adventureStore';
import { useTxHistoryStore, type LabeledTransaction } from '../store/txHistoryStore';
import { XpBar } from '../components/XpBar';
import { AchievementBadge } from '../components/AchievementBadge';
import { PremiumCard } from '../components/PremiumCard';
import { ReferralCard } from '../components/ReferralCard';
import { PersonalityTraitsCard } from '../components/PersonalityTraitsCard';
import { usePremiumStore } from '../store/premiumStore';
import { TIER_CONFIGS } from '../data/premiumTiers';
import { useShopStore } from '../store/shopStore';
import { useNotificationStore } from '../store/notificationStore';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SharePetCard } from '../components/SharePetCard';
import { NotificationBell } from '../components/notifications/NotificationBell';
import { notify } from '../lib/notify';
import { TransactionHistoryScreen } from './TransactionHistoryScreen';
import { getSolscanTxUrl, getSolscanNftUrl, getSolscanAddressUrl, SOLANA_NETWORK, getActiveRpcLabel } from '../lib/solanaClient';
import { writeMemo } from '../lib/solanaTransactions';
import { setMuted, isMuted } from '../lib/soundManager';
import { usePendingTxStore } from '../store/pendingTxStore';

interface InfoCardProps {
  title: string;
  icon: string;
  accent: string;
  children: React.ReactNode;
}

function InfoCard({ title, icon, accent, children }: InfoCardProps) {
  return (
    <View
      className="bg-white rounded-[28px] overflow-hidden mb-5 border border-gray-100"
      style={{
        shadowColor: '#1F2E45',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.07,
        shadowRadius: 14,
        elevation: 4,
      }}
    >
      <View className={`${accent} px-5 py-3 flex-row items-center`}>
        <Text className="text-base mr-2">{icon}</Text>
        <Text className="text-[11px] font-black text-white tracking-[0.9px] uppercase">{title}</Text>
      </View>
      <View className="px-5 py-2">{children}</View>
    </View>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
  valueColor?: string;
}

function InfoRow({ label, value, valueColor = 'text-gray-800' }: InfoRowProps) {
  return (
    <View className="flex-row justify-between py-3.5 border-b border-gray-100 last:border-b-0">
      <Text className="text-[12px] font-semibold text-gray-500">{label}</Text>
      <Text className={`text-[12px] font-black ${valueColor}`}>{value}</Text>
    </View>
  );
}

function ProgressCard() {
  const { level, totalXp, achievements } = useXpStore();
  const title = getTitleForLevel(level);
  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <View
      className="bg-white rounded-[28px] overflow-hidden mb-5 border border-pet-blue-light/70"
      style={{
        shadowColor: '#2D6B90',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      <View className="bg-pet-blue-dark px-5 py-3 flex-row items-center">
        <Text className="text-base mr-2">{'\u{2B50}'}</Text>
        <Text className="text-[11px] font-black text-white tracking-[0.9px] uppercase">Progress</Text>
        <View className="bg-white/20 px-2 py-0.5 rounded-full ml-auto">
          <Text className="text-white text-[10px] font-bold">{unlockedCount}/{achievements.length}</Text>
        </View>
      </View>

      <View className="px-3 pt-3 pb-1">
        <XpBar />
      </View>

      <View className="flex-row justify-between px-5 pt-3 pb-4">
        <View className="items-center" style={{ gap: 4 }}>
          <View className="px-3 py-1.5 rounded-full bg-pet-blue-light/40 border border-pet-blue-light/90">
            <Text className="text-[15px] font-black text-pet-blue-dark">{totalXp}</Text>
          </View>
          <Text className="text-[9px] font-bold text-gray-400 uppercase">Total XP</Text>
        </View>
        <View className="items-center" style={{ gap: 4 }}>
          <View className="px-3 py-1.5 rounded-full bg-pet-blue-light/40 border border-pet-blue-light/90">
            <Text className="text-[15px] font-black text-pet-blue-dark">{title}</Text>
          </View>
          <Text className="text-[9px] font-bold text-gray-400 uppercase">Title</Text>
        </View>
        <View className="items-center" style={{ gap: 4 }}>
          <View className="px-3 py-1.5 rounded-full bg-pet-blue-light/40 border border-pet-blue-light/90">
            <Text className="text-[15px] font-black text-pet-blue-dark">{unlockedCount}</Text>
          </View>
          <Text className="text-[9px] font-bold text-gray-400 uppercase">Badges</Text>
        </View>
      </View>

      {/* Divider */}
      <View className="mx-5 h-[1px] bg-pet-blue-light/40" />

      {/* Achievement Grid */}
      <View className="px-4 pt-4 pb-5">
        <Text className="text-[11px] font-black text-gray-500 uppercase tracking-[0.6px] mb-3 px-1">Achievements</Text>
        <View className="flex-row flex-wrap" style={{ gap: 10 }}>
          {achievements.map(a => (
            <View key={a.id} style={{ width: '22%' }}>
              <AchievementBadge achievement={a} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function EvolutionCard() {
  const { evolutionStage, evolutionShards, canEvolve, evolve } = useAdventureStore();
  const level = useXpStore((s) => s.level);
  const currentStage = EVOLUTION_STAGES[evolutionStage - 1];
  const nextStage = evolutionStage < 5 ? EVOLUTION_STAGES[evolutionStage] : null;
  const canDoEvolve = canEvolve(level);

  // Synchronous re-entry guard: evolve() deducts shards. A rapid double-tap
  // before React's next render hid the button could fire evolve() twice and
  // deduct double the shards.
  const evolveInFlightRef = useRef(false);
  const handleEvolve = () => {
    if (!canDoEvolve) return;
    if (evolveInFlightRef.current) return;
    evolveInFlightRef.current = true;
    evolve();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Short cooldown — evolve mutates state which propagates to canEvolve
    // and hides the button, but the re-render is async. Half a second is
    // plenty to bridge the gap.
    setTimeout(() => { evolveInFlightRef.current = false; }, 500);
  };

  return (
    <View
      className="bg-white rounded-[28px] overflow-hidden mb-5 border border-gray-100"
      style={{ shadowColor: '#2D6B90', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 }}
    >
      <LinearGradient
        colors={['#4FABC9', '#6CBAD8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="px-5 py-3 flex-row items-center justify-between"
      >
        <View className="flex-row items-center">
          <Text className="text-base mr-2">{'\u{1F48E}'}</Text>
          <Text className="text-[11px] font-black text-white tracking-[0.9px] uppercase">Evolution</Text>
        </View>
        <View className="bg-white/30 px-2 py-0.5 rounded-full">
          <Text className="text-white text-[10px] font-bold">Stage {evolutionStage}/5</Text>
        </View>
      </LinearGradient>

      <View className="px-5 py-4">
        {/* Current stage */}
        <View className="items-center mb-4">
          <Text className="text-[32px] mb-1">{currentStage?.stage === 1 ? '\u{1F423}' : currentStage?.stage === 2 ? '\u{1F431}' : currentStage?.stage === 3 ? '\u{1F981}' : currentStage?.stage === 4 ? '\u{1F409}' : '\u{1F451}'}</Text>
          <Text className="text-[18px] font-black text-gray-800">{currentStage?.name}</Text>
          <Text className="text-[12px] text-gray-500 font-semibold">Scale: {currentStage?.scale}x</Text>
        </View>

        {/* Evolution progress */}
        {nextStage && (
          <View className="bg-pet-blue-light/30 rounded-2xl p-4 mb-3 border border-pet-blue-light/70">
            <Text className="text-[12px] font-black text-gray-700 mb-2">Next: {nextStage.name}</Text>
            <View className="flex-row justify-between mb-1">
              <Text className="text-[11px] text-gray-500 font-semibold">Level {level}/{nextStage.levelRequired}</Text>
              <Text className="text-[11px] text-gray-500 font-semibold">{'\u{1F48E}'} {evolutionShards}/{nextStage.shardsRequired} Shards</Text>
            </View>
            <View className="h-2 rounded-full bg-pet-blue-light/50 overflow-hidden">
              <View
                className="h-full rounded-full bg-pet-blue"
                style={{ width: `${Math.min(100, (evolutionShards / nextStage.shardsRequired) * 100)}%` }}
              />
            </View>
          </View>
        )}

        {/* Evolve button */}
        {canDoEvolve && (
          <TouchableOpacity onPress={handleEvolve} activeOpacity={0.85}>
            <LinearGradient colors={['#4FABC9', '#3E8AB3']} className="py-3 rounded-2xl items-center">
              <Text className="text-white font-black text-[13px] uppercase tracking-[0.8px]">
                {'\u2728'} Evolve Now!
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Shard sources */}
        <Text className="text-[10px] text-gray-400 font-semibold text-center mt-3">
          Earn shards from adventures, login rewards, and the lucky wheel
        </Text>
      </View>
    </View>
  );
}

function TransactionHistoryCard({ address, onSeeAll }: { address: string; onSeeAll?: () => void }) {
  const { transactions, isLoading, fetchHistory } = useTxHistoryStore();

  useEffect(() => {
    if (address) {
      fetchHistory(address);
    }
  }, [address, fetchHistory]);

  const formatTime = (ts: number | null) => {
    if (!ts) return '';
    const diff = Math.floor((Date.now() / 1000) - ts);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <View
      className="bg-white rounded-[28px] overflow-hidden mb-5 border border-gray-100"
      style={{ shadowColor: '#1F2E45', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 4 }}
    >
      <View className="bg-pet-blue px-5 py-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Text className="text-base mr-2">{'\u{1F4DC}'}</Text>
          <Text className="text-[11px] font-black text-white tracking-[0.9px] uppercase">Recent Transactions</Text>
        </View>
        <TouchableOpacity onPress={() => fetchHistory(address)} activeOpacity={0.7}>
          <MaterialCommunityIcons name="refresh" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
      <View className="px-5 py-2">
        {isLoading ? (
          <View className="py-6 items-center">
            <ActivityIndicator size="small" color="#3792A6" />
            <Text className="text-[11px] text-gray-400 mt-2">Loading from chain...</Text>
          </View>
        ) : transactions.length === 0 ? (
          <View className="py-6 items-center">
            <Text className="text-[12px] text-gray-400 font-semibold">No transactions yet</Text>
          </View>
        ) : (
          transactions.slice(0, 10).map((tx) => (
            <TouchableOpacity
              key={tx.signature}
              onPress={() => Linking.openURL(getSolscanTxUrl(tx.signature))}
              activeOpacity={0.7}
              className="flex-row items-center py-3 border-b border-gray-100"
            >
              <View className={`w-7 h-7 rounded-full items-center justify-center ${tx.err ? 'bg-red-100' : 'bg-pet-blue-light/40'}`}>
                <MaterialCommunityIcons
                  name={tx.err ? 'close-circle-outline' : 'check-circle-outline'}
                  size={16}
                  color={tx.err ? '#dc2626' : '#3792A6'}
                />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-[12px] font-bold text-gray-700" numberOfLines={1}>{tx.label}</Text>
                <Text className="text-[10px] text-gray-400 font-medium">{tx.signature.slice(0, 8)}...{tx.signature.slice(-6)}</Text>
              </View>
              <View className="items-end">
                <Text className="text-[10px] text-gray-400 font-semibold">{formatTime(tx.timestamp)}</Text>
                <MaterialCommunityIcons name="open-in-new" size={12} color="#9ca3af" />
              </View>
            </TouchableOpacity>
          ))
        )}
        {transactions.length > 0 && onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} activeOpacity={0.7} className="py-3 items-center">
            <View className="flex-row items-center">
              <Text className="text-[11px] font-black text-pet-blue uppercase tracking-[0.5px]">View All Transactions</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color="#4FABC9" />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/**
 * Local payments log. Pulls from pendingTxStore. Shows the user every
 * paid action this app initiated (including failures and pending mid-
 * flight tx state), with Solscan links for verification.
 *
 * Complement to TransactionHistoryCard: the chain-fetched view shows only
 * what's actually on chain, this one shows what the APP did regardless of
 * chain state — including dropped/failed txs that never landed.
 */
function PaymentsLogCard() {
  const entries = usePendingTxStore((s) => s.entries);

  if (entries.length === 0) return null;

  const formatTime = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const statusColor = (s: string) =>
    s === 'failed' ? '#dc2626'
      : s === 'pending' ? '#f59e0b'
      : s === 'finalized' ? '#16a34a' // green-600 — strongest visual confidence
      : '#3792A6'; // confirmed → pet-blue

  const statusBg = (s: string) =>
    s === 'failed' ? 'bg-red-100'
      : s === 'pending' ? 'bg-amber-100'
      : s === 'finalized' ? 'bg-green-100'
      : 'bg-pet-blue-light/40';

  const statusLabel = (s: string) =>
    s === 'finalized' ? 'Finalized' : s === 'confirmed' ? 'Confirmed' : s === 'pending' ? 'Pending' : 'Failed';

  return (
    <View
      className="bg-white rounded-[28px] overflow-hidden mb-5 border border-gray-100"
      style={{ shadowColor: '#1F2E45', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 4 }}
    >
      <View className="bg-pet-blue-dark px-5 py-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Text className="text-base mr-2">{'\u{1F9FE}'}</Text>
          <Text className="text-[11px] font-black text-white tracking-[0.9px] uppercase">Payments Log</Text>
        </View>
        <View className="bg-white/20 px-2 py-0.5 rounded-full">
          <Text className="text-[9px] font-black text-white">LOCAL</Text>
        </View>
      </View>
      <View className="px-5 py-2">
        {entries.slice(0, 8).map((e) => (
          <TouchableOpacity
            key={e.id}
            disabled={!e.signature}
            onPress={() => e.signature && Linking.openURL(getSolscanTxUrl(e.signature))}
            activeOpacity={e.signature ? 0.7 : 1}
            className="flex-row items-center py-3 border-b border-gray-100"
          >
            <View className={`w-7 h-7 rounded-full items-center justify-center ${statusBg(e.status)}`}>
              <MaterialCommunityIcons
                name={
                  e.status === 'failed' ? 'close-circle-outline'
                    : e.status === 'pending' ? 'clock-outline'
                    : e.status === 'finalized' ? 'shield-check'
                    : 'check-circle-outline'
                }
                size={16}
                color={statusColor(e.status)}
              />
            </View>
            <View className="flex-1 ml-3">
              <View className="flex-row items-center">
                <Text className="text-[12px] font-bold text-gray-700 flex-1" numberOfLines={1}>{e.label}</Text>
                <Text className="text-[9px] font-black ml-2" style={{ color: statusColor(e.status) }}>
                  {statusLabel(e.status).toUpperCase()}
                </Text>
              </View>
              {e.amountDisplay ? (
                <Text className="text-[10px] text-gray-400 font-medium">{e.amountDisplay}</Text>
              ) : null}
              {e.status === 'failed' && e.failureMessage ? (
                <Text className="text-[9px] text-red-500 font-medium" numberOfLines={1}>{e.failureMessage}</Text>
              ) : null}
            </View>
            <View className="items-end">
              <Text className="text-[10px] text-gray-400 font-semibold">{formatTime(e.createdAt)}</Text>
              {e.signature ? <MaterialCommunityIcons name="open-in-new" size={12} color="#9ca3af" /> : null}
            </View>
          </TouchableOpacity>
        ))}
        <Text className="text-[10px] text-gray-400 font-semibold text-center mt-2 px-3 py-1.5">
          Every paid action you take in this app. Includes failures so you know if a tx didn't land.
        </Text>
      </View>
    </View>
  );
}

function CollectiblesRow() {
  const items = useShopStore((s) => s.items);
  const owned = items.filter((i) => i.owned);
  const byRarity = {
    common: owned.filter((i) => i.rarity === 'common').length,
    rare: owned.filter((i) => i.rarity === 'rare').length,
    epic: owned.filter((i) => i.rarity === 'epic').length,
    legendary: owned.filter((i) => i.rarity === 'legendary').length,
  };

  return (
    <View className="py-3.5 border-b border-gray-100">
      <Text className="text-[12px] font-semibold text-gray-500 mb-2">Collectibles</Text>
      <View className="flex-row" style={{ gap: 8 }}>
        {byRarity.common > 0 && (
          <View className="bg-gray-100 px-2.5 py-1 rounded-full">
            <Text className="text-[10px] font-black text-gray-500">{byRarity.common} Common</Text>
          </View>
        )}
        {byRarity.rare > 0 && (
          <View className="bg-pet-blue-light/40 px-2.5 py-1 rounded-full border border-pet-blue-light/90">
            <Text className="text-[10px] font-black text-pet-blue-dark">{byRarity.rare} Rare</Text>
          </View>
        )}
        {byRarity.epic > 0 && (
          <View className="bg-pet-blue-light/40 px-2.5 py-1 rounded-full border border-pet-blue-light/90">
            <Text className="text-[10px] font-black text-pet-blue-dark">{byRarity.epic} Epic</Text>
          </View>
        )}
        {byRarity.legendary > 0 && (
          <View className="bg-pet-blue-light/40 px-2.5 py-1 rounded-full border border-pet-blue-light/90">
            <Text className="text-[10px] font-black text-pet-blue-dark">{byRarity.legendary} Legendary</Text>
          </View>
        )}
        {owned.length === 0 && (
          <Text className="text-[11px] text-gray-400 font-semibold">No items yet</Text>
        )}
      </View>
    </View>
  );
}

// Translates raw Solana / wallet errors into messages a regular user can act
// on. Without this the backup/restore toasts were surfacing strings like
// "Transaction simulation failed: ... 0x1" and
// "WalletSignTransactionError: User rejected the request" — meaningless to
// anyone who hasn't read the Solana docs. Module-level so it doesn't break
// the useCallback dep array.
function friendlyChainError(err: any, defaultMsg: string): string {
  const raw = String(err?.message ?? err ?? '');
  const lower = raw.toLowerCase();
  if (lower.includes('user rejected') || lower.includes('cancelled')) {
    return 'You cancelled the transaction. Safe to try again anytime.';
  }
  if (lower.includes('insufficientfundsforrent') || lower.includes('insufficient funds for rent')) {
    return 'Not enough SOL for the rent-exempt minimum. Top up your wallet and try again.';
  }
  if (lower.includes('blockhash') && (lower.includes('not found') || lower.includes('expired'))) {
    return 'The transaction expired before confirming. Try again — it should land this time.';
  }
  if (lower.includes('0x1') || lower.includes('insufficient funds')) {
    return 'Not enough SOL to cover the fee. Top up your wallet and try again.';
  }
  if (lower.includes('rate limit') || lower.includes('429')) {
    return 'Too many requests right now. Wait a minute and try again.';
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('timeout')) {
    return 'Could not reach the network. Check your connection and try again.';
  }
  if (lower.includes('simulation failed')) {
    return 'The wallet rejected the transaction during pre-check. No charge was made — try again.';
  }
  return defaultMsg;
}

export function ProfileScreen() {
  const { address, balance, skrBalance, balanceLoadOk, skrBalanceLoadOk, appCoins, walletBrand, disconnectWallet, refreshBalance, refreshSkrBalance, authToken } = useWalletStore();
  const { name, ownerName, mintAddress, mintTxSignature, skin, clearPet, streakDays, hunger, happiness, energy, streakFreezes } = usePetStore();
  const premium = usePremiumStore((s) => s.isPremium);
  const tier = usePremiumStore((s) => s.tier);
  const [memoLoading, setMemoLoading] = useState(false);
  const [lastMemoTime, setLastMemoTime] = useState<string | null>(null);
  const [showTxHistory, setShowTxHistory] = useState(false);
  const notificationsEnabled = useNotificationStore((s) => s.enabled);
  const toggleNotifications = useNotificationStore((s) => s.setEnabled);
  const [soundEnabled, setSoundEnabled] = useState(() => !isMuted());
  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      setMuted(!next);
      return next;
    });
  }, []);
  const completedAdventures = useAdventureStore((s) => s.completedAdventures);
  const miniGamesWon = useAdventureStore((s) => s.miniGamesWon);
  const freeItemTokens = useAdventureStore((s) => s.freeItemTokens);
  const totalLoginDays = useAdventureStore((s) => s.totalLoginDays);

  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected';
  const shortMintAddress = mintAddress ? `${mintAddress.slice(0, 6)}...${mintAddress.slice(-4)}` : 'N/A';

  /**
   * Pre-fill a support email with the user's wallet, recent tx history, app
   * version, and premium tier. Saves support roundtrips — the user hands us
   * everything we need to diagnose in one DM.
   *
   * mailto: works on iOS + Android. On platforms where it fails, we fall
   * back to copying the body so the user can paste it manually.
   */
  const handleReportIssue = useCallback(async () => {
    const recent = usePendingTxStore.getState().entries.slice(0, 5);
    const tier = usePremiumStore.getState().tier;
    const recentLines = recent.length
      ? recent.map((e) => `- ${e.label} (${e.status}) ${e.amountDisplay ?? ''} ${e.signature ? '· ' + e.signature.slice(0, 12) + '...' : ''}`).join('\n')
      : '(none)';
    const body = [
      'Describe the issue:',
      '',
      '',
      '---- Diagnostics (please keep) ----',
      `Wallet: ${address || '(not connected)'}`,
      `Wallet brand: ${walletBrand || 'unknown'}`,
      `Pet mint: ${mintAddress || '(none)'}`,
      `Premium tier: ${tier}`,
      `App version: 2.1.0`,
      `Recent paid actions:`,
      recentLines,
    ].join('\n');
    const subject = encodeURIComponent('[Nomi support] Issue report');
    const encodedBody = encodeURIComponent(body);
    const url = `mailto:team@talkamore.com?subject=${subject}&body=${encodedBody}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return;
      }
    } catch {}
    // Fallback — mailto failed (no email client / locked-down device).
    // Show the body in an Alert so the user can read + copy it.
    Alert.alert(
      'Email not available',
      `Please email team@talkamore.com and paste the diagnostics below:\n\n${body}`,
    );
  }, [address, walletBrand, mintAddress]);

  const handleDisconnect = () => {
    // Disconnect cascades a full local reset (pet/xp/adventure/premium/
    // personality stores all cleared). One-tap that destruction was easy
    // to do by accident — confirm so users who tapped expecting a UX
    // sub-menu don't blow away their session.
    Alert.alert(
      'Disconnect wallet?',
      `This will clear your local pet data on this device. Your NFT and premium tier are safe on chain — they'll come back when you reconnect this wallet.`,
      [
        { text: 'Stay connected', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            clearPet();
            disconnectWallet();
          },
        },
      ],
    );
  };

  const handleSyncPetState = useCallback(async () => {
    if (!authToken || memoLoading) return;
    // Confirm before charging the network fee — the audit caught users
    // expecting the backup to be "free" and seeing SOL leave their wallet
    // with no second-tap safety. ~0.000005 SOL is small but real.
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Back up to chain?',
        'Writes your streak + name as a tiny on-chain memo (~0.000005 SOL network fee).',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Back up', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
    if (!confirmed) return;
    setMemoLoading(true);
    try {
      const syncPayload = JSON.stringify({
        streak: streakDays,
        name,
        lastActive: new Date().toISOString().slice(0, 10),
      });
      const memo = `oracle-pet:sync|${syncPayload}`;
      const txSig = await writeMemo(authToken, memo);
      try {
        const { labelTransaction } = require('../store/txHistoryStore');
        labelTransaction(txSig, 'Pet State Sync');
      } catch {}
      setLastMemoTime(new Date().toLocaleTimeString());
      await refreshBalance();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      notify.success(
        'Backup written',
        'Your streak + name are saved on chain. Your future you (and any new device) can recover them anytime.',
        { category: 'tx' },
      );
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      notify.error(
        'Backup failed',
        friendlyChainError(err, 'Failed to write pet state on-chain. Try again in a moment.'),
        { category: 'tx' },
      );
    } finally {
      setMemoLoading(false);
    }
  }, [authToken, memoLoading, name, streakDays, refreshBalance]);

  const [restoreLoading, setRestoreLoading] = useState(false);
  const handleRestorePurchases = useCallback(async () => {
    if (!address || restoreLoading) return;
    setRestoreLoading(true);
    try {
      const { restorePurchases } = require('../lib/purchaseRestore');
      const result = await restorePurchases(address);

      // Build a structured summary for the in-app notification center
      // (toast + bell entry) instead of using the OS Alert. The Alert was
      // jarring against the rest of the app's design and gave no
      // permanent breadcrumb — users couldn't review what was restored.
      const parts: string[] = [];
      const details: { label: string; value: string }[] = [];
      if (result.petRestored) {
        parts.push('Pet identity');
        details.push({ label: 'Pet', value: result.petRestoredFromHoldings ? 'Found via on-chain holdings' : 'Found via memo' });
      }
      if (result.shopItemsRestored.length > 0) {
        parts.push(`${result.shopItemsRestored.length} shop item${result.shopItemsRestored.length === 1 ? '' : 's'}`);
        details.push({ label: 'Items', value: `${result.shopItemsRestored.length} restored` });
      }
      if (result.premiumTierRestored) {
        const label = result.premiumTierRestored.charAt(0).toUpperCase() + result.premiumTierRestored.slice(1);
        parts.push(`${label} tier`);
        details.push({ label: 'Premium', value: `${label} tier active` });
      }
      if (result.streakRestored !== null) {
        parts.push(`${result.streakRestored}-day streak`);
        details.push({ label: 'Streak', value: `${result.streakRestored} days` });
      }

      Haptics.notificationAsync(
        parts.length > 0
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );

      if (parts.length > 0) {
        notify.success(
          'Restore complete',
          `Restored ${parts.join(' · ')}`,
          { category: 'restore', details },
        );
      } else {
        notify.info(
          'Nothing to restore',
          'We checked the chain and found no Nomi history for this wallet. If you minted with a different wallet, disconnect and reconnect with that one.',
          { category: 'restore' },
        );
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      notify.error(
        'Restore failed',
        friendlyChainError(err, 'Could not reach the chain. Try again in a moment.'),
        { category: 'restore' },
      );
    } finally {
      setRestoreLoading(false);
    }
  }, [address, restoreLoading]);

  const skinDisplayName = skin === 'default' ? 'Default' : skin.charAt(0).toUpperCase() + skin.slice(1);

  if (showTxHistory) {
    return <TransactionHistoryScreen onBack={() => setShowTxHistory(false)} />;
  }

  return (
    <View className="flex-1 bg-pet-background">
      <LinearGradient
        colors={['#EFF7FF', '#E8F3FD', '#F5FAFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />
      <View className="absolute -top-6 -right-8 w-36 h-36 rounded-full bg-pet-blue-light/30" />
      <View className="absolute top-52 -left-10 w-44 h-44 rounded-full bg-pet-blue-light/20" />
      <View className="absolute top-[520px] -right-12 w-48 h-48 rounded-full bg-pet-blue-light/25" />

      {/* Notification bell — floats top-right so users can access the
          notification center from any screen, not just Home. */}
      <View style={{ position: 'absolute', top: 16, right: 20, zIndex: 30 }}>
        <NotificationBell />
      </View>

      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          eyebrow={premium ? `${TIER_CONFIGS[tier].label} Member` : 'Player Card'}
          title="Profile"
          subtitle="Wallet, title progress, and companion identity."
          badge={premium ? `${TIER_CONFIGS[tier].emoji} Nomi Plus` : 'All synced \u00B7 v2'}
          rightSlot={(
            <View className="w-14 h-14 rounded-2xl bg-white/20 border border-white/40 items-center justify-center">
              <Text className="text-2xl">{premium ? TIER_CONFIGS[tier].emoji : '\u{1F984}'}</Text>
            </View>
          )}
        />

        <View style={{ height: 16 }} />

        <ProgressCard />

        <EvolutionCard />

        <PremiumCard />

        <View className="mt-4 mb-1">
          <ReferralCard />
        </View>

        <View className="mt-4 mb-1">
          <PersonalityTraitsCard />
        </View>

        <SharePetCard />

        <View className="mt-1" />

        <InfoCard title="Wallet" icon={'\u{1F4B0}'} accent="bg-pet-blue-dark">
          {/* Tap → open in Solscan. Long-press → native share sheet (lets
              the user copy/share without us shipping a clipboard dep).
              Hint text below tells the user about both gestures. */}
          <TouchableOpacity
            onPress={() => address && Linking.openURL(getSolscanAddressUrl(address))}
            onLongPress={() => {
              if (!address) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Share.share({ message: address }).catch(() => {});
            }}
            activeOpacity={0.7}
          >
            <View className="flex-row justify-between py-3.5 border-b border-gray-100 items-center">
              <Text className="text-[12px] font-semibold text-gray-500">Address</Text>
              <View className="flex-row items-center">
                <Text className="text-[12px] font-black text-gray-800 mr-1">{shortAddress}</Text>
                <MaterialCommunityIcons name="open-in-new" size={11} color="#9ca3af" />
              </View>
            </View>
            <Text className="text-[9px] font-semibold text-gray-400 -mt-2 mb-1.5 text-right">
              Tap to view · long-press to copy/share
            </Text>
          </TouchableOpacity>
          <View className="flex-row justify-between py-3.5 border-b border-gray-100 items-center">
            <Text className="text-[12px] font-semibold text-gray-500">Balance</Text>
            <View className="flex-row items-center">
              {balanceLoadOk ? (
                <Text className="text-[12px] font-black text-pet-blue-dark mr-2">{balance.toFixed(4)} SOL</Text>
              ) : (
                <Text className="text-[11px] font-bold text-orange-500 mr-2">Unavailable · tap retry</Text>
              )}
              <TouchableOpacity onPress={refreshBalance} activeOpacity={0.7}>
                <MaterialCommunityIcons name="refresh" size={14} color="#3792A6" />
              </TouchableOpacity>
            </View>
          </View>
          <View className="flex-row justify-between py-3.5 border-b border-gray-100 items-center">
            <Text className="text-[12px] font-semibold text-gray-500">SKR Balance</Text>
            <View className="flex-row items-center">
              {skrBalanceLoadOk ? (
                <Text className="text-[12px] font-black text-purple-600 mr-2">{skrBalance.toFixed(2)} SKR</Text>
              ) : (
                <Text className="text-[11px] font-bold text-orange-500 mr-2">Unavailable · tap retry</Text>
              )}
              <TouchableOpacity onPress={refreshSkrBalance} activeOpacity={0.7}>
                <MaterialCommunityIcons name="refresh" size={14} color="#9333ea" />
              </TouchableOpacity>
            </View>
          </View>
          <View className="flex-row justify-between py-3.5 border-b border-gray-100 items-center">
            <View className="flex-row items-center">
              <Text className="text-[12px] font-semibold text-gray-500">In-game Coins</Text>
              <View className="ml-2 px-1.5 py-0.5 rounded-full bg-gray-100">
                <Text className="text-[8px] font-bold text-gray-500 uppercase tracking-[0.4px]">Off-chain</Text>
              </View>
            </View>
            <Text className="text-[12px] font-black text-amber-700">
              {Math.floor(appCoins).toLocaleString()}
            </Text>
          </View>
          <InfoRow label="Network" value={`Solana ${SOLANA_NETWORK === 'mainnet' ? 'Mainnet' : SOLANA_NETWORK === 'devnet' ? 'Devnet' : 'Testnet'}`} valueColor="text-pet-blue-dark" />
          {walletBrand ? (
            <InfoRow
              label="Wallet"
              value={walletBrand.charAt(0).toUpperCase() + walletBrand.slice(1)}
              valueColor="text-pet-blue-dark"
            />
          ) : null}
        </InfoCard>

        <InfoCard title="Companion" icon={'\u{1F43E}'} accent="bg-pet-blue">
          <InfoRow label="Name" value={name} />
          {ownerName ? <InfoRow label="Owner" value={ownerName} valueColor="text-pet-blue-dark" /> : null}
          <TouchableOpacity
            onPress={() => mintAddress && Linking.openURL(getSolscanNftUrl(mintAddress))}
            activeOpacity={0.7}
            disabled={!mintAddress}
          >
            <View className="flex-row justify-between py-3.5 border-b border-gray-100 items-center">
              <Text className="text-[12px] font-semibold text-gray-500">NFT Mint</Text>
              <View className="flex-row items-center">
                <Text className="text-[12px] font-black text-gray-800 mr-1">{shortMintAddress}</Text>
                {mintAddress && <MaterialCommunityIcons name="open-in-new" size={11} color="#9ca3af" />}
              </View>
            </View>
          </TouchableOpacity>
          {premium && (
            <InfoRow
              label="Tier"
              value={`${TIER_CONFIGS[tier].emoji} ${TIER_CONFIGS[tier].label}`}
              valueColor="text-pet-blue-dark"
            />
          )}
          <InfoRow label="Outfit" value={skinDisplayName} valueColor="text-pet-blue" />
          <InfoRow label="Streak" value={`${streakDays} day${streakDays === 1 ? '' : 's'}`} valueColor="text-pet-blue-dark" />
          <InfoRow label="Streak Freezes" value={`${streakFreezes} in stock`} valueColor="text-pet-blue-dark" />
          <InfoRow label="Adventures" value={`${completedAdventures} completed`} valueColor="text-pet-blue-dark" />
          <InfoRow label="Mini-Games" value={`${miniGamesWon} won`} valueColor="text-pet-blue-dark" />
          <InfoRow label="Login Days" value={`${totalLoginDays} total`} valueColor="text-pet-blue-dark" />
          {freeItemTokens > 0 && (
            <InfoRow label="Free Item Tokens" value={`${freeItemTokens} unused`} valueColor="text-pet-blue-dark" />
          )}
          <CollectiblesRow />
          <View className="py-3">
            <TouchableOpacity onPress={handleSyncPetState} disabled={memoLoading} activeOpacity={0.85}>
              <View style={{ paddingVertical: 12, borderRadius: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: 'rgba(167,215,230,0.4)', borderWidth: 1, borderColor: 'rgba(167,215,230,0.8)' }}>
                {memoLoading ? (
                  <>
                    <ActivityIndicator size="small" color="#3792A6" />
                    <Text className="text-pet-blue-dark text-[11px] font-black ml-2">Saving to blockchain…</Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons name="shield-lock-outline" size={14} color="#3792A6" />
                    <Text className="text-pet-blue-dark text-[11px] font-black ml-1.5 uppercase tracking-[0.5px]">Back Up to Blockchain</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
            <Text className="text-[10px] text-gray-400 font-semibold text-center mt-1.5 px-3">
              Cloud backup runs automatically. This adds an extra on-chain snapshot of your streak and pet — costs only the network fee.
            </Text>
            {lastMemoTime && (
              <Text className="text-[10px] text-gray-400 font-semibold text-center mt-0.5">Last saved: {lastMemoTime}</Text>
            )}
            <View style={{ height: 12 }} />
            <TouchableOpacity onPress={handleRestorePurchases} disabled={restoreLoading} activeOpacity={0.85}>
              <View style={{ paddingVertical: 12, borderRadius: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: 'rgba(200,167,230,0.3)', borderWidth: 1, borderColor: 'rgba(200,167,230,0.7)' }}>
                {restoreLoading ? (
                  <>
                    <ActivityIndicator size="small" color="#7C3AED" />
                    <Text className="text-purple-700 text-[11px] font-black ml-2">Searching the chain…</Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons name="magnify-scan" size={14} color="#7C3AED" />
                    <Text className="text-purple-700 text-[11px] font-black ml-1.5 uppercase tracking-[0.5px]">Recover My Pet & Items</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
            <Text className="text-[10px] text-gray-400 font-semibold text-center mt-1.5 px-3">
              Missing your pet, items, or premium tier? This finds them on-chain and brings them back.
            </Text>
          </View>
        </InfoCard>

        <PaymentsLogCard />
        {address && <TransactionHistoryCard address={address} onSeeAll={() => setShowTxHistory(true)} />}

        {/* Transparency card \u2014 built for the technical/skeptical user who
            wants to verify the app is talking to the right chain endpoints
            and using their wallet correctly. Showing this earns trust from
            the crypto-native subset of the audience for almost free. */}
        <InfoCard title="On-chain settings" icon={'\u{1F517}'} accent="bg-pet-blue">
          <InfoRow label="Network" value={SOLANA_NETWORK === 'mainnet' ? 'Solana Mainnet' : SOLANA_NETWORK} valueColor="text-pet-blue-dark" />
          <InfoRow label="RPC" value={getActiveRpcLabel()} valueColor="text-gray-700" />
          <View className="flex-row justify-between py-3.5 border-b border-gray-100 items-center">
            <Text className="text-[12px] font-semibold text-gray-500">Wallet</Text>
            {address ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(getSolscanAddressUrl(address))}
                activeOpacity={0.7}
                className="flex-row items-center"
              >
                <Text className="text-[12px] font-black text-pet-blue-dark mr-1">
                  {address.slice(0, 4)}\u2026{address.slice(-4)}
                </Text>
                <MaterialCommunityIcons name="open-in-new" size={11} color="#9ca3af" />
              </TouchableOpacity>
            ) : (
              <Text className="text-[11px] font-bold text-gray-400">Not connected</Text>
            )}
          </View>
          <View className="flex-row justify-between py-3.5 items-center">
            <Text className="text-[12px] font-semibold text-gray-500">Nomi NFT</Text>
            {mintAddress ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(getSolscanNftUrl(mintAddress))}
                activeOpacity={0.7}
                className="flex-row items-center"
              >
                <Text className="text-[12px] font-black text-pet-blue-dark mr-1">
                  {mintAddress.slice(0, 4)}\u2026{mintAddress.slice(-4)}
                </Text>
                <MaterialCommunityIcons name="open-in-new" size={11} color="#9ca3af" />
              </TouchableOpacity>
            ) : (
              <Text className="text-[11px] font-bold text-gray-400">Not minted</Text>
            )}
          </View>
          <Text className="text-[10px] text-gray-400 font-semibold text-center mt-1 px-2">
            All paid actions go through these endpoints. Tap any value to verify on Solscan.
          </Text>
        </InfoCard>

        <InfoCard title="App" icon={'\u2699'} accent="bg-pet-blue-dark">
          <InfoRow label="Version" value="2.1.0" />
          <InfoRow label="Build" value="Design Refresh" valueColor="text-pet-blue-dark" />
          <View className="flex-row justify-between py-3.5 border-b border-gray-100 items-center">
            <Text className="text-[12px] font-semibold text-gray-500">Notifications</Text>
            <TouchableOpacity
              onPress={() => toggleNotifications(!notificationsEnabled)}
              activeOpacity={0.7}
            >
              <View className={`px-3 py-1 rounded-full ${notificationsEnabled ? 'bg-pet-green' : 'bg-gray-300'}`}>
                <Text className="text-[10px] font-black text-white">
                  {notificationsEnabled ? 'ON' : 'OFF'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          <View className="flex-row justify-between py-3.5 border-b border-gray-100 items-center">
            <Text className="text-[12px] font-semibold text-gray-500">Sound</Text>
            <TouchableOpacity onPress={toggleSound} activeOpacity={0.7}>
              <View className={`px-3 py-1 rounded-full ${soundEnabled ? 'bg-pet-green' : 'bg-gray-300'}`}>
                <Text className="text-[10px] font-black text-white">
                  {soundEnabled ? 'ON' : 'OFF'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={handleReportIssue}
            activeOpacity={0.7}
            className="flex-row justify-between items-center py-3.5"
          >
            <View className="flex-row items-center">
              <MaterialCommunityIcons name="email-alert-outline" size={14} color="#EA580C" />
              <Text className="text-[12px] font-semibold text-orange-600 ml-2">Report an issue</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={16} color="#9ca3af" />
          </TouchableOpacity>
        </InfoCard>

        <TouchableOpacity onPress={handleDisconnect} activeOpacity={0.9}>
          <View
            style={{
              paddingVertical: 16,
              borderRadius: 18,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: 'rgba(55,146,166,0.3)',
              backgroundColor: 'white',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#4FB0C6',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.15,
              shadowRadius: 10,
              elevation: 4,
            }}
          >
            <MaterialCommunityIcons name="logout" size={18} color="#3792A6" />
            <Text className="ml-2 text-pet-blue-dark font-black text-[13px] tracking-[0.6px] uppercase">Disconnect Wallet</Text>
          </View>
        </TouchableOpacity>

        {/* Solana branding */}
        <View className="items-center mb-10 py-4">
          <Text className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: '#b0b8c1' }}>
            Powered by Solana
          </Text>
          <Text className="text-[10px] font-semibold mt-1.5" style={{ color: '#c8cfd6' }}>
            Real on-chain transactions {'\u00B7'} Devnet {'\u00B7'} Mobile Wallet Adapter
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}


