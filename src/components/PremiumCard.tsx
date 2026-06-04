import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { usePremiumStore } from '../store/premiumStore';
import { useWalletStore } from '../store/walletStore';
import { type PremiumTier, type TierCurrency, TIER_CONFIGS, TIER_ORDER, getTierOrdinal } from '../data/premiumTiers';
import { playSfx } from '../lib/soundManager';
import { parseTxError } from '../lib/transactionErrors';
import { events, captureError } from '../lib/analytics';
import { notify, truncateMid } from '../lib/notify';
import { restorePurchases } from '../lib/purchaseRestore';

const TIER_PERKS: Record<Exclude<PremiumTier, 'none'>, { emoji: string; text: string }[]> = {
  plus: [
    { emoji: '\u26A1', text: '2x stamina regen speed' },
    { emoji: '\u{23F1}', text: '50% faster cooldowns' },
    { emoji: '\u{2B50}', text: '+35% XP bonus' },
    { emoji: '\u{1F3B0}', text: '3 free spins/day' },
    { emoji: '\u{1F4E6}', text: '+10% rare & legendary loot' },
    { emoji: '\u{1F31F}', text: 'Access to Plus-only items' },
  ],
  pro: [
    { emoji: '\u26A1', text: '3x stamina regen speed' },
    { emoji: '\u{23F1}', text: '75% faster cooldowns' },
    { emoji: '\u{2B50}', text: '+75% XP bonus' },
    { emoji: '\u{1F3B0}', text: '5 free spins/day' },
    { emoji: '\u{1F4E6}', text: '+20% rare & legendary loot' },
    { emoji: '\u{1F451}', text: "All today's accessories free" },
    { emoji: '\u{1F48E}', text: 'Access to Pro-only items' },
    { emoji: '\u{1F3AE}', text: 'No mini-game cooldowns' },
  ],
};

interface TierOptionProps {
  tier: Exclude<PremiumTier, 'none'>;
  currentTier: PremiumTier;
  onPurchase: (tier: PremiumTier, currency: TierCurrency) => void;
  purchasing?: boolean;
}

function TierOption({ tier, currentTier, onPurchase, purchasing }: TierOptionProps) {
  const config = TIER_CONFIGS[tier];
  const isActive = currentTier === tier;
  const isBelow = getTierOrdinal(currentTier) > getTierOrdinal(tier);
  const cost = config.price;
  const perks = TIER_PERKS[tier];
  const isPopular = tier === 'plus';
  const hasAlt = config.alternativePrice != null && config.alternativeCurrency != null;

  return (
    <View
      className="rounded-3xl overflow-hidden mb-4 border-2"
      style={{
        borderColor: isActive ? config.badgeColor : '#E5E7EB',
        opacity: isBelow ? 0.5 : 1,
      }}
    >
      {/* Tier header */}
      <LinearGradient
        colors={config.gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="px-4 py-2.5 flex-row items-center justify-between"
      >
        <View className="flex-row items-center">
          <Text className="text-base mr-2">{config.emoji}</Text>
          <Text className="text-[12px] font-black text-white tracking-[0.8px] uppercase">{config.label}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          {isPopular && !isActive && !isBelow && (
            <View className="bg-white/30 px-2 py-0.5 rounded-full">
              <Text className="text-white text-[9px] font-black">POPULAR</Text>
            </View>
          )}
          {isActive ? (
            <View className="bg-white/30 px-2.5 py-0.5 rounded-full">
              <Text className="text-white text-[10px] font-bold">{'\u2705'} Active</Text>
            </View>
          ) : (
            <View className="bg-white/20 px-2.5 py-0.5 rounded-full">
              <Text className="text-white text-[10px] font-bold">{config.price} {config.currency}</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Perks list */}
      <View className="bg-white px-4 py-3">
        {perks.map((perk, i) => (
          <View key={i} className="flex-row items-center py-1">
            <Text className="text-[12px] mr-2">{perk.emoji}</Text>
            <Text className="text-[11px] font-semibold text-gray-600 flex-1">{perk.text}</Text>
            {isActive && <Text className="text-[10px] text-green-500 font-bold">{'\u2713'}</Text>}
          </View>
        ))}
        {tier === 'pro' && (
          <Text className="text-[9px] text-gray-400 italic mt-1.5 leading-[12px]">
            Future accessory drops not included \u2014 they'll be available to buy at their listed price.
          </Text>
        )}

        {/* Purchase/upgrade button(s) */}
        {!isActive && !isBelow && (
          purchasing ? (
            <View style={{ marginTop: 8, paddingVertical: 14, borderRadius: 18, alignItems: 'center', backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' }}>
              <ActivityIndicator size="small" color="#3792A6" />
            </View>
          ) : (
            <View style={{ marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => onPurchase(tier, config.currency)}
                disabled={purchasing}
                activeOpacity={0.85}
                style={{ opacity: purchasing ? 0.6 : 1 }}
              >
                <LinearGradient
                  colors={config.gradientColors}
                  style={{ paddingVertical: 14, borderRadius: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                >
                  {purchasing ? <ActivityIndicator size="small" color="#fff" /> : null}
                  <Text className="text-white font-black text-[13px] uppercase tracking-[0.5px]" style={{ marginLeft: purchasing ? 8 : 0 }}>
                    {purchasing
                      ? 'Processing…'
                      : currentTier === 'none'
                        ? `Get ${config.label} for ${cost} ${config.currency}`
                        : `Upgrade for ${cost} ${config.currency}`}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
              {hasAlt && (
                <TouchableOpacity
                  onPress={() => onPurchase(tier, config.alternativeCurrency!)}
                  disabled={purchasing}
                  activeOpacity={0.85}
                  style={{
                    marginTop: 8,
                    paddingVertical: 12,
                    borderRadius: 16,
                    alignItems: 'center',
                    backgroundColor: '#fff',
                    borderWidth: 1.5,
                    borderColor: config.badgeColor,
                    opacity: purchasing ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: config.badgeColor }} className="font-black text-[12px] uppercase tracking-[0.5px]">
                    or pay {config.alternativePrice} {config.alternativeCurrency}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )
        )}
      </View>
    </View>
  );
}

export function PremiumCard() {
  const tier = usePremiumStore((s) => s.tier);
  const purchaseTier = usePremiumStore((s) => s.purchaseTier);
  const balance = useWalletStore((s) => s.balance);
  const skrBalance = useWalletStore((s) => s.skrBalance);
  const walletAddress = useWalletStore((s) => s.address);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // Synchronous re-entry guard: setPurchasing is async (next render) so two
  // rapid taps would both pass the `purchasing` check and queue two wallet
  // approvals. The ref flips immediately, so the second tap exits cleanly.
  const inFlightRef = useRef(false);
  // Watchdog: 60s covers a realistic Phantom approval (8-12s observed) plus
  // the user reading the Alert. Previously 120s — that locked users out for
  // 2 full minutes if Phantom died, with no escape but force-quitting NomiApp.
  // The new confirm-wallet modal also has its OWN escape (Cancel button +
  // self-dismiss after 75s), so the watchdog is now a soft backstop, not the
  // primary unlock path.
  const inFlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lockInFlight = () => {
    inFlightRef.current = true;
    if (inFlightTimerRef.current) clearTimeout(inFlightTimerRef.current);
    inFlightTimerRef.current = setTimeout(() => {
      inFlightRef.current = false;
      inFlightTimerRef.current = null;
    }, 60000);
  };
  const unlockInFlight = () => {
    inFlightRef.current = false;
    if (inFlightTimerRef.current) {
      clearTimeout(inFlightTimerRef.current);
      inFlightTimerRef.current = null;
    }
  };

  // Self-dismiss the "Confirm in Wallet" modal if the wallet never responds.
  // Without this, a user whose Phantom died mid-flow has no escape but to
  // force-quit NomiApp (the modal had no close button + no max duration).
  useEffect(() => {
    if (!purchasing) return;
    const t = setTimeout(() => {
      if (purchasing) {
        setPurchasing(false);
        unlockInFlight();
        notify.warning(
          'Wallet didn\'t respond',
          'No charge — try again, or check Solscan if you already approved.',
          { category: 'tx' },
        );
      }
    }, 75_000);
    return () => clearTimeout(t);
  }, [purchasing]);

  const handleRestore = async () => {
    if (!walletAddress || restoring || purchasing) return;
    setRestoring(true);
    try {
      const result = await restorePurchases(walletAddress);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (result.premiumTierRestored && result.premiumTierRestored !== 'none') {
        notify.success(
          `${TIER_CONFIGS[result.premiumTierRestored].label} restored`,
          'Your premium perks are active again.',
          { category: 'tx' },
        );
      } else {
        notify.info(
          'No premium found on chain',
          'No matching purchase found for this wallet. If you paid from another wallet, connect that one.',
          { category: 'tx' },
        );
      }
    } catch (err: any) {
      captureError(err, { surface: 'premium_restore' });
      notify.error(
        'Restore failed',
        'Could not reach the chain right now. Check your connection and try again.',
        { category: 'tx' },
      );
    } finally {
      setRestoring(false);
    }
  };

  const handlePurchase = (targetTier: PremiumTier, chosenCurrency: TierCurrency) => {
    if (purchasing || inFlightRef.current) return;
    lockInFlight();
    const config = TIER_CONFIGS[targetTier];
    const useAlt =
      config.alternativeCurrency != null &&
      chosenCurrency === config.alternativeCurrency &&
      chosenCurrency !== config.currency;
    const cost = useAlt ? config.alternativePrice! : config.price;
    const currency: TierCurrency = useAlt ? config.alternativeCurrency! : config.currency;
    const userBalance = currency === 'SKR' ? skrBalance : balance;

    if (userBalance < cost) {
      unlockInFlight();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Surface BOTH currency options if the tier has an alternative — saves
      // the user from tapping the other button just to discover that's also
      // out of reach.
      const altLine =
        config.alternativeCurrency != null &&
        config.alternativePrice != null &&
        config.alternativeCurrency !== config.currency
          ? ` Or ${config.alternativePrice} ${config.alternativeCurrency} (you have ${
              config.alternativeCurrency === 'SKR' ? skrBalance.toFixed(2) : balance.toFixed(4)
            }).`
          : '';
      notify.warning(
        `Not enough ${currency}`,
        `${config.label} costs ${cost} ${currency}. You have ${userBalance.toFixed(2)}.${altLine}`,
      );
      return;
    }

    const action = tier === 'none' ? 'Get' : 'Upgrade to';
    Alert.alert(
      `${action} ${config.label}`,
      `${action} ${config.label} tier for ${cost} ${currency}?\nThis will open Phantom for approval.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => { unlockInFlight(); } },
        {
          text: `${action}!`,
          onPress: async () => {
            setPurchasing(true);
            try {
              const txSig = await purchaseTier(targetTier, currency);
              events.premiumPurchase({
                tier: targetTier as 'plus' | 'pro',
                currency,
                amount: cost,
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              playSfx('money').catch(() => {});
              setTimeout(() => playSfx('happymoney').catch(() => {}), 800);
              notify.success(
                `Welcome to ${config.label}!`,
                `${cost} ${currency} paid · perks active immediately`,
                {
                  category: 'tx',
                  details: [
                    { label: 'Tier', value: config.label },
                    { label: 'Cost', value: `${cost} ${currency}` },
                    ...(txSig ? [{ label: 'Transaction', value: truncateMid(txSig, 8, 8) }] : []),
                  ],
                  // Solscan link → users can verify the on-chain charge
                  // themselves. The single biggest trust signal for crypto
                  // users: "I paid, here's proof."
                  solscanTxSignature: txSig || undefined,
                },
              );
            } catch (err: any) {
              const parsed = parseTxError(err);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              if (parsed.type !== 'cancelled') {
                captureError(err, { surface: 'premium_purchase', tier: targetTier });
                notify.error(parsed.title, parsed.message, { category: 'tx' });
              }
            } finally {
              setPurchasing(false);
              unlockInFlight();
            }
          },
        },
      ],
      // onDismiss may not fire reliably on Android outside-tap. We have a
      // 10s watchdog in unlockInFlight as a backstop, but still try here.
      { onDismiss: () => { unlockInFlight(); } },
    );
  };

  return (
    <View
      className="bg-white rounded-[28px] overflow-hidden mb-5 border border-gray-100"
      style={{
        shadowColor: tier !== 'none' ? TIER_CONFIGS[tier].badgeColor : '#9381FF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 14,
        elevation: 5,
      }}
    >
      {/* Main header */}
      <LinearGradient
        colors={tier !== 'none' ? TIER_CONFIGS[tier].gradientColors : ['#9381FF', '#766BD1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="px-5 py-3 flex-row items-center justify-between"
      >
        <View className="flex-row items-center">
          <Text className="text-base mr-2">{tier !== 'none' ? TIER_CONFIGS[tier].emoji : '\u{1F31F}'}</Text>
          <Text className="text-[11px] font-black text-white tracking-[0.9px] uppercase">
            Nomi Plus
          </Text>
        </View>
        {tier !== 'none' && (
          <View className="bg-white/30 px-2.5 py-0.5 rounded-full">
            <Text className="text-white text-[10px] font-bold">{TIER_CONFIGS[tier].label} Member</Text>
          </View>
        )}
      </LinearGradient>

      <View className="px-4 py-4">
        {tier === 'pro' ? (
          <View className="items-center mb-2">
            <Text className="text-[18px] font-black text-gray-800">
              {'\u{1F48E}'} Pro Member
            </Text>
            <Text className="text-[12px] text-gray-500 font-semibold mt-1">
              All perks active. You're legendary!
            </Text>
          </View>
        ) : (
          <View className="items-center mb-4">
            <Text className="text-[18px] font-black text-gray-800">
              {tier === 'none' ? 'Upgrade Your Experience' : 'Go Higher'}
            </Text>
            <Text className="text-[12px] text-gray-500 font-semibold mt-1">
              {tier === 'none'
                ? 'Choose a tier to unlock premium perks'
                : 'Upgrade to the next tier for more perks'}
            </Text>
          </View>
        )}

        {/* Tier options — show tiers above current */}
        {(TIER_ORDER.filter(t => t !== 'none') as Exclude<PremiumTier, 'none'>[]).map((t) => (
          <TierOption
            key={t}
            tier={t}
            currentTier={tier}
            onPurchase={handlePurchase}
            purchasing={purchasing}
          />
        ))}

        {/* In-card "Restore Purchases" link. A reinstalled Pro user landing on
            this screen previously saw "Get Plus / Get Pro" with no way to
            recover what they already paid for — easy to double-pay. The link
            is intentionally subtle so happy users aren't tempted to tap it
            instead of buying. */}
        {tier === 'none' && (
          <TouchableOpacity
            onPress={handleRestore}
            disabled={restoring || purchasing}
            activeOpacity={0.6}
            style={{ alignItems: 'center', paddingVertical: 8, marginTop: 2 }}
          >
            {restoring ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#9381FF" />
                <Text className="text-[12px] text-gray-500 ml-2 font-semibold">
                  Checking on-chain…
                </Text>
              </View>
            ) : (
              <Text className="text-[12px] text-gray-500 font-semibold">
                Already paid? <Text className="text-pet-blue underline">Restore purchases</Text>
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Full-screen wallet confirmation overlay */}
      <Modal transparent animationType="fade" visible={purchasing}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View
            style={{
              backgroundColor: '#fff',
              width: '100%',
              paddingHorizontal: 28,
              paddingVertical: 40,
              borderRadius: 32,
              alignItems: 'center',
              shadowColor: '#9381FF',
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.25,
              shadowRadius: 28,
              elevation: 20,
            }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#9381FF20',
                borderWidth: 2,
                borderColor: '#9381FF40',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <Text style={{ fontSize: 36 }}>{'\u{1F48E}'}</Text>
            </View>

            <Text className="text-[20px] font-black text-gray-800 text-center mb-2">
              Confirm in Wallet
            </Text>
            <Text className="text-[13px] text-gray-400 font-semibold text-center mb-8">
              Approve the transaction in your wallet app
            </Text>

            <ActivityIndicator size="large" color="#9381FF" />

            <Text className="text-[11px] text-gray-300 font-semibold mt-5">
              Taking a while? It's safe to cancel and try again.
            </Text>

            {/* Cancel escape. Previously this modal had no close path — if
                Phantom died or never responded, the user's only option was
                to force-quit NomiApp. Now they can bail out cleanly. */}
            <TouchableOpacity
              onPress={() => {
                setPurchasing(false);
                unlockInFlight();
              }}
              activeOpacity={0.7}
              style={{ marginTop: 16, paddingVertical: 8, paddingHorizontal: 16 }}
            >
              <Text className="text-[13px] text-gray-500 font-bold underline">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
