import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useShopStore, type ShopItem, type ItemRarity, getItemLockState } from '../store/shopStore';
import { useWalletStore } from '../store/walletStore';
import { usePremiumStore } from '../store/premiumStore';
import { isAtLeastTier, type PremiumTier } from '../data/premiumTiers';
import { getPerksForLevel } from '../store/xpStore';
import { useXpStore } from '../store/xpStore';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { petTypography } from '../theme/typography';
import { playSfx } from '../lib/soundManager';
import { friendlyTxError } from '../lib/transactionErrors';

const BUTTON_RADIUS = 10;
const PILL_RADIUS = 12;

type ShopSection = 'All' | 'Accessories' | 'Animations' | 'Clothes' | 'Shoes' | 'Other';
const SECTIONS: ShopSection[] = ['All', 'Accessories', 'Animations', 'Clothes', 'Shoes', 'Other'];

type OwnershipFilter = 'all' | 'owned' | 'available';
const OWNERSHIP_FILTERS: { key: OwnershipFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'owned', label: 'Owned' },
  { key: 'available', label: 'Available' },
];
const SECTION_META: Record<ShopSection, { icon: string; tone: string }> = {
  All: { icon: '\u{1F31F}', tone: 'bg-pet-blue' },
  Accessories: { icon: '\u{1F451}', tone: 'bg-pet-blue-dark' },
  Animations: { icon: '\u{1F3AC}', tone: 'bg-pet-blue' },
  Clothes: { icon: '\u{1F455}', tone: 'bg-pet-blue-dark' },
  Shoes: { icon: '\u{1F45F}', tone: 'bg-pet-blue' },
  Other: { icon: '\u{1F381}', tone: 'bg-pet-blue-dark' },
};

function CategoryPill({
  label,
  active,
  icon,
  onPress,
}: {
  label: string;
  active: boolean;
  icon: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <View
        className={`px-5 py-3 mr-2.5 flex-row items-center ${
          active ? 'bg-pet-blue' : 'bg-white border border-gray-200'
        }`}
        style={{ borderRadius: PILL_RADIUS }}
      >
        <Text className={`text-[13px] mr-1.5 ${active ? '' : 'opacity-60'}`}>{icon}</Text>
        <Text
          className={`text-[12px] font-bold tracking-[0.4px] ${
            active ? 'text-white' : 'text-gray-500'
          }`}
          style={{ fontFamily: petTypography.heading }}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const RARITY_COLORS: Record<ItemRarity, { bg: string; text: string; label: string }> = {
  common: { bg: 'bg-pet-blue-light/35', text: 'text-pet-blue-dark', label: 'Common' },
  rare: { bg: 'bg-pet-blue-light/45', text: 'text-pet-blue-dark', label: 'Rare' },
  epic: { bg: 'bg-pet-blue-light/55', text: 'text-pet-blue-dark', label: 'Epic' },
  legendary: { bg: 'bg-pet-blue-light/65', text: 'text-pet-blue-dark', label: 'Legendary' },
};

const RARITY_BORDER: Record<ItemRarity, string> = {
  common: '#C9DEEE',
  rare: '#B1D1E8',
  epic: '#9BC5E1',
  legendary: '#83B8DA',
};

function CardPrice({ item, isPremium }: { item: ShopItem; isPremium: boolean }) {
  // Show "Owned" badge once purchased
  if (item.owned) {
    return (
      <View className="items-center mt-3 mb-4">
        <View className="flex-row items-center bg-green-50 rounded-full px-3 py-1 border border-green-200">
          <Text className="text-[10px] font-black text-green-600 uppercase tracking-wider">{'\u2713'} Owned</Text>
        </View>
      </View>
    );
  }

  const level = useXpStore((s) => s.level);
  const discount = getPerksForLevel(level).shopDiscount;
  const discountPercent = Math.round(discount * 100);
  const finalPrice = Math.round(item.price * (1 - discount) * 1000000) / 1000000;
  const hasDiscount = discount > 0 && item.price > 0;

  if (isPremium) {
    return (
      <View className="items-center mt-3 mb-4">
        <Text className="text-[14px] font-black text-pet-blue-dark">FREE</Text>
      </View>
    );
  }

  return (
    <View className="items-center mt-3 mb-4">
      <View className="flex-row items-center justify-center">
        {hasDiscount ? (
          <>
            <Text className="text-[11px] font-semibold text-gray-300 line-through mr-1.5">{item.price}</Text>
            <Text className="text-[14px] font-black text-pet-blue-dark">{finalPrice}</Text>
          </>
        ) : (
          <Text className="text-[14px] font-black text-pet-blue-dark">{item.price}</Text>
        )}
        <Text className="text-[11px] font-bold text-gray-400 ml-1">SOL</Text>
      </View>
      {hasDiscount && (
        <View className="bg-green-100 rounded-full px-2 py-0.5 mt-1">
          <Text className="text-[9px] font-black text-green-700">-{discountPercent}% LVL {level}</Text>
        </View>
      )}
      {item.skrPrice && (
        <View className="flex-row items-center justify-center mt-1">
          <Text className="text-[11px] font-black text-purple-600">{item.skrPrice}</Text>
          <Text className="text-[9px] font-bold text-purple-400 ml-1">SKR</Text>
        </View>
      )}
    </View>
  );
}

function ShopCard({
  item,
  equipped,
  isPremium,
  purchasing,
  onBuy,
  onEquip,
  onUnequip,
}: {
  item: ShopItem;
  equipped: boolean;
  isPremium: boolean;
  purchasing: boolean;
  onBuy: () => void;
  onEquip: () => void;
  onUnequip: () => void;
}) {
  const rarityInfo = RARITY_COLORS[item.rarity];
  const lockState = getItemLockState(item);
  const isLocked = (lockState.locked || item.comingSoon) && !item.owned;

  const handlePress = () => {
    if (isLocked || item.comingSoon) return;
    if (!item.owned) {
      onBuy();
    } else if (equipped) {
      onUnequip();
    } else {
      onEquip();
    }
  };

  return (
    <View
      className={`flex-1 bg-white p-5 border-2 ${
        equipped ? 'border-pet-blue' : ''
      }`}
      style={{
        borderRadius: 32,
        borderColor: equipped ? undefined : RARITY_BORDER[item.rarity],
        shadowColor: equipped ? '#4FB0C6' : '#22314A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: equipped ? 0.15 : 0.05,
        shadowRadius: 10,
        elevation: equipped ? 5 : 2,
        opacity: isLocked ? 0.6 : 1,
      }}
    >
      <LinearGradient
        colors={equipped ? ['#DAF1F9', '#EFF9FF'] : ['#F8FBFF', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
        style={{ borderRadius: 32 }}
      />
      <View className="flex-row mb-2" style={{ gap: 4 }}>
        <View className={`px-1 rounded-full ${rarityInfo.bg}`}>
          <Text className={`text-[9px] font-black ${rarityInfo.text}`}>{rarityInfo.label.toUpperCase()}</Text>
        </View>
        {item.tierTag && (
          <View className="px-2.5 py-1 rounded-full bg-pet-blue-light/70 border border-pet-blue-light">
            <Text className="text-[9px] font-black text-pet-blue-dark">
              {item.tierTag === 'pro_exclusive' ? '\u{1F48E}' : '\u{2B50}'}
            </Text>
          </View>
        )}
      </View>
      <View className="items-center mb-4">
        <View
          className={`w-16 h-16 rounded-2xl items-center justify-center border ${
            equipped ? 'bg-pet-blue/15 border-pet-blue/30' : 'bg-gray-50 border-gray-100'
          }`}
        >
          <Text className="text-4xl">{isLocked ? '\u{1F512}' : item.image}</Text>
        </View>
      </View>

      <Text className="text-[15px] font-black text-gray-800 text-center" numberOfLines={1} style={{ fontFamily: petTypography.heading }}>
        {item.name}
      </Text>
      <Text className="text-[10px] font-semibold text-gray-400 text-center mt-0.5 uppercase tracking-wider">
        {item.category}
      </Text>

      <CardPrice item={item} isPremium={isPremium} />

      {item.comingSoon && !item.owned ? (
        <LinearGradient
          colors={['#F3E8FF', '#EDE5FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="py-2.5 px-2 items-center justify-center border border-purple-200"
          style={{ borderRadius: BUTTON_RADIUS }}
        >
          <Text className="text-[10px] font-black text-purple-400 uppercase tracking-wider text-center">
            {'\u{1F6A7}'} Coming Soon
          </Text>
        </LinearGradient>
      ) : isLocked ? (
        <View className="py-2.5 px-2 items-center justify-center bg-gray-200 border border-gray-300" style={{ borderRadius: BUTTON_RADIUS }}>
          <Text className="text-[9px] font-black text-gray-500 uppercase tracking-wider text-center">
            {'\u{1F512}'} {lockState.reason}
          </Text>
        </View>
      ) : purchasing ? (
        <View className="py-3 items-center bg-pet-blue-light/20 border border-pet-blue-light/50" style={{ borderRadius: BUTTON_RADIUS }}>
          <ActivityIndicator size="small" color="#3792A6" />
        </View>
      ) : (
        <TouchableOpacity onPress={handlePress} activeOpacity={0.85} style={{ borderRadius: BUTTON_RADIUS }} className="overflow-hidden">
          {!item.owned ? (
            <LinearGradient
              colors={isPremium ? ['#4AA2CB', '#3B8BB4'] : ['#48B4CD', '#66CBE1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="py-3 items-center"
              style={{ borderRadius: BUTTON_RADIUS }}
            >
              <Text className="text-white text-[12px] font-black tracking-wider uppercase">
                {isPremium ? '\u{1F48E} Claim Free' : 'Adopt'}
              </Text>
            </LinearGradient>
          ) : equipped ? (
            <View className="py-3 items-center bg-pet-blue/15 border border-pet-blue/40" style={{ borderRadius: BUTTON_RADIUS }}>
              <Text className="text-pet-blue-dark text-[12px] font-black tracking-wider uppercase">Equipped</Text>
            </View>
          ) : (
            <View className="py-3 items-center bg-gray-100 border border-gray-200" style={{ borderRadius: BUTTON_RADIUS }}>
              <Text className="text-gray-600 text-[12px] font-black tracking-wider uppercase">Equip</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function PaymentModal({
  item,
  visible,
  onClose,
  onPaySol,
  onPaySkr,
  solBalance,
  skrBalance,
}: {
  item: ShopItem | null;
  visible: boolean;
  onClose: () => void;
  onPaySol: () => void;
  onPaySkr: () => void;
  solBalance: number;
  skrBalance: number;
}) {
  const [payMode, setPayMode] = useState<'choose' | 'sol' | 'skr'>('choose');
  if (!item) return null;

  // Calculate level discount
  const level = useXpStore.getState().level;
  const perks = getPerksForLevel(level);
  const discount = perks.shopDiscount;
  const discountPercent = Math.round(discount * 100);
  const discountAmount = Math.round(item.price * discount * 1000000) / 1000000;
  const finalPrice = Math.round(item.price * (1 - discount) * 1000000) / 1000000;
  const networkFee = 0.000005; // Solana base tx fee
  const totalSol = Math.round((finalPrice + networkFee) * 1000000) / 1000000;

  const canAffordSol = solBalance >= totalSol;
  const canAffordSkr = !!item.skrPrice && skrBalance >= item.skrPrice;

  const handleClose = () => {
    setPayMode('choose');
    onClose();
  };

  const handlePaySol = () => {
    setPayMode('choose');
    onPaySol();
  };

  const handlePaySkr = () => {
    setPayMode('choose');
    onPaySkr();
  };

  // ── Bill / Invoice view (SOL) ──
  if (payMode === 'sol') {
    return (
      <Modal transparent animationType="fade" visible={visible}>
        <View className="flex-1 bg-black/50 items-center justify-center px-6">
          <View
            className="bg-white w-full px-6 py-7"
            style={{ borderRadius: 28, shadowColor: '#4FB0C6', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 15 }}
          >
            {/* Header */}
            <View className="items-center mb-5">
              <View className="w-14 h-14 rounded-2xl items-center justify-center bg-pet-blue-light/30 border border-pet-blue-light/60 mb-3">
                <Text className="text-3xl">{item.image}</Text>
              </View>
              <Text className="text-[17px] font-black text-gray-800" style={{ fontFamily: petTypography.heading }}>{item.name}</Text>
              <Text className="text-[11px] text-gray-400 font-semibold mt-0.5">Purchase Summary</Text>
            </View>

            {/* Bill rows */}
            <View className="bg-gray-50 rounded-2xl px-5 py-4 mb-5 border border-gray-100">
              {/* Item price */}
              <View className="flex-row justify-between items-center mb-2.5">
                <Text className="text-[13px] text-gray-600 font-semibold">Item Price</Text>
                <Text className="text-[13px] text-gray-800 font-bold">{item.price} SOL</Text>
              </View>

              {/* Discount */}
              {discount > 0 && (
                <View className="flex-row justify-between items-center mb-2.5">
                  <View className="flex-row items-center">
                    <Text className="text-[13px] text-green-600 font-semibold">Level {level} Discount</Text>
                    <View className="bg-green-100 rounded-full px-2 py-0.5 ml-2">
                      <Text className="text-[10px] font-black text-green-700">-{discountPercent}%</Text>
                    </View>
                  </View>
                  <Text className="text-[13px] text-green-600 font-bold">-{discountAmount} SOL</Text>
                </View>
              )}

              {/* Network fee */}
              <View className="flex-row justify-between items-center mb-2.5">
                <Text className="text-[13px] text-gray-600 font-semibold">Network Fee</Text>
                <Text className="text-[13px] text-gray-500 font-bold">~0.000005 SOL</Text>
              </View>

              {/* Divider */}
              <View className="border-t border-dashed border-gray-200 my-2" />

              {/* Total */}
              <View className="flex-row justify-between items-center">
                <Text className="text-[15px] text-gray-800 font-black">Total</Text>
                <Text className="text-[15px] text-pet-blue-dark font-black">{finalPrice} SOL</Text>
              </View>
            </View>

            {/* Wallet balance */}
            <View className="flex-row items-center justify-center mb-5">
              <MaterialCommunityIcons name="wallet-outline" size={14} color="#9CA3AF" />
              <Text className="text-[11px] text-gray-400 font-semibold ml-1">
                Wallet Balance: {solBalance.toFixed(4)} SOL
              </Text>
              {!canAffordSol && (
                <Text className="text-[11px] text-red-400 font-bold ml-2">Insufficient</Text>
              )}
            </View>

            {/* Pay button */}
            <TouchableOpacity
              onPress={handlePaySol}
              disabled={!canAffordSol}
              activeOpacity={0.85}
              className="mb-4"
            >
              <LinearGradient
                colors={canAffordSol ? ['#48B4CD', '#3B8BB4'] : ['#D1D5DB', '#D1D5DB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="py-4 items-center flex-row justify-center"
                style={{ borderRadius: 14 }}
              >
                <MaterialCommunityIcons name="wallet" size={18} color="#fff" />
                <Text className="text-white text-[14px] font-black tracking-wider uppercase ml-2">
                  Pay with Phantom
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Back */}
            <TouchableOpacity onPress={() => setPayMode('choose')} activeOpacity={0.85} className="items-center">
              <Text className="text-[13px] font-bold text-gray-400">Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Bill / Invoice view (SKR) ──
  if (payMode === 'skr' && item.skrPrice) {
    return (
      <Modal transparent animationType="fade" visible={visible}>
        <View className="flex-1 bg-black/50 items-center justify-center px-6">
          <View
            className="bg-white w-full px-6 py-7"
            style={{ borderRadius: 28, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 15 }}
          >
            {/* Header */}
            <View className="items-center mb-5">
              <View className="w-14 h-14 rounded-2xl items-center justify-center bg-purple-100 border border-purple-200 mb-3">
                <Text className="text-3xl">{item.image}</Text>
              </View>
              <Text className="text-[17px] font-black text-gray-800" style={{ fontFamily: petTypography.heading }}>{item.name}</Text>
              <Text className="text-[11px] text-gray-400 font-semibold mt-0.5">Purchase Summary</Text>
            </View>

            {/* Bill rows */}
            <View className="bg-gray-50 rounded-2xl px-5 py-4 mb-5 border border-gray-100">
              <View className="flex-row justify-between items-center mb-2.5">
                <Text className="text-[13px] text-gray-600 font-semibold">Item Price</Text>
                <Text className="text-[13px] text-gray-800 font-bold">{item.skrPrice} SKR</Text>
              </View>
              <View className="flex-row justify-between items-center mb-2.5">
                <Text className="text-[13px] text-gray-600 font-semibold">Network Fee</Text>
                <Text className="text-[13px] text-gray-500 font-bold">~0.000005 SOL</Text>
              </View>
              <View className="border-t border-dashed border-gray-200 my-2" />
              <View className="flex-row justify-between items-center">
                <Text className="text-[15px] text-gray-800 font-black">Total</Text>
                <Text className="text-[15px] text-purple-600 font-black">{item.skrPrice} SKR</Text>
              </View>
            </View>

            {/* Wallet balance */}
            <View className="flex-row items-center justify-center mb-5">
              <MaterialCommunityIcons name="wallet-outline" size={14} color="#9CA3AF" />
              <Text className="text-[11px] text-gray-400 font-semibold ml-1">
                SKR Balance: {skrBalance.toFixed(0)} SKR
              </Text>
              {!canAffordSkr && (
                <Text className="text-[11px] text-red-400 font-bold ml-2">Insufficient</Text>
              )}
            </View>

            {/* Pay button */}
            <TouchableOpacity
              onPress={handlePaySkr}
              disabled={!canAffordSkr}
              activeOpacity={0.85}
              className="mb-4"
            >
              <LinearGradient
                colors={canAffordSkr ? ['#7C3AED', '#6D28D9'] : ['#D1D5DB', '#D1D5DB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="py-4 items-center flex-row justify-center"
                style={{ borderRadius: 14 }}
              >
                <MaterialCommunityIcons name="wallet" size={18} color="#fff" />
                <Text className="text-white text-[14px] font-black tracking-wider uppercase ml-2">
                  Pay with Phantom
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Back */}
            <TouchableOpacity onPress={() => setPayMode('choose')} activeOpacity={0.85} className="items-center">
              <Text className="text-[13px] font-bold text-gray-400">Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Payment method chooser (default) ──
  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View className="flex-1 bg-black/50 items-center justify-center px-8">
        <View
          className="bg-white w-full px-6 py-7 items-center"
          style={{ borderRadius: 28, shadowColor: '#4FB0C6', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 15 }}
        >
          <View className="w-16 h-16 rounded-2xl items-center justify-center bg-pet-blue-light/30 border border-pet-blue-light/60 mb-4">
            <Text className="text-4xl">{item.image}</Text>
          </View>
          <Text className="text-[18px] font-black text-gray-800 mb-1" style={{ fontFamily: petTypography.heading }}>{item.name}</Text>
          <Text className="text-[12px] text-gray-400 font-semibold mb-5">Choose payment method</Text>

          {/* SOL option */}
          <TouchableOpacity
            onPress={() => setPayMode('sol')}
            disabled={!canAffordSol}
            activeOpacity={0.85}
            className="w-full mb-3"
          >
            <View
              className={`flex-row items-center justify-between px-5 py-4 border ${canAffordSol ? 'bg-white border-pet-blue-light/60' : 'bg-gray-50 border-gray-200'}`}
              style={{ borderRadius: 16 }}
            >
              <View className="flex-row items-center">
                <View className="w-9 h-9 rounded-full bg-pet-blue-light/30 items-center justify-center mr-3">
                  <Text className="text-[16px]">{'\u{2B50}'}</Text>
                </View>
                <View>
                  <Text className={`text-[14px] font-black ${canAffordSol ? 'text-gray-800' : 'text-gray-400'}`}>Pay with SOL</Text>
                  <Text className={`text-[11px] font-semibold ${canAffordSol ? 'text-gray-400' : 'text-gray-300'}`}>Balance: {solBalance.toFixed(2)} SOL</Text>
                </View>
              </View>
              <View className="items-end">
                {discount > 0 ? (
                  <>
                    <Text className={`text-[11px] font-semibold line-through ${canAffordSol ? 'text-gray-300' : 'text-gray-200'}`}>{item.price} SOL</Text>
                    <Text className={`text-[15px] font-black ${canAffordSol ? 'text-pet-blue-dark' : 'text-gray-300'}`}>{finalPrice} SOL</Text>
                  </>
                ) : (
                  <Text className={`text-[16px] font-black ${canAffordSol ? 'text-pet-blue-dark' : 'text-gray-300'}`}>{item.price} SOL</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* SKR option */}
          {item.skrPrice ? (
            <TouchableOpacity
              onPress={() => setPayMode('skr')}
              disabled={!canAffordSkr}
              activeOpacity={0.85}
              className="w-full mb-5"
            >
              <View
                className={`flex-row items-center justify-between px-5 py-4 border ${canAffordSkr ? 'bg-white border-purple-200' : 'bg-gray-50 border-gray-200'}`}
                style={{ borderRadius: 16 }}
              >
                <View className="flex-row items-center">
                  <View className="w-9 h-9 rounded-full bg-purple-100 items-center justify-center mr-3">
                    <Text className="text-[16px]">{'\u{1F48E}'}</Text>
                  </View>
                  <View>
                    <Text className={`text-[14px] font-black ${canAffordSkr ? 'text-gray-800' : 'text-gray-400'}`}>Pay with SKR</Text>
                    <Text className={`text-[11px] font-semibold ${canAffordSkr ? 'text-gray-400' : 'text-gray-300'}`}>Balance: {skrBalance.toFixed(0)} SKR</Text>
                  </View>
                </View>
                <Text className={`text-[16px] font-black ${canAffordSkr ? 'text-purple-600' : 'text-gray-300'}`}>{item.skrPrice} SKR</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View className="mb-5" />
          )}

          <TouchableOpacity onPress={handleClose} activeOpacity={0.85}>
            <Text className="text-[13px] font-bold text-gray-400">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function InsufficientFundsModal({
  visible,
  currency,
  required,
  available,
  onClose,
}: {
  visible: boolean;
  currency: 'SOL' | 'SKR';
  required: number;
  available: number;
  onClose: () => void;
}) {
  const shortage = currency === 'SOL'
    ? (required - available).toFixed(4)
    : (required - available).toFixed(0);

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View className="flex-1 bg-black/50 items-center justify-center px-6">
        <View
          className="bg-white w-full px-6 py-7"
          style={{
            borderRadius: 28,
            shadowColor: '#EF4444',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.2,
            shadowRadius: 24,
            elevation: 15,
          }}
        >
          {/* Icon */}
          <View className="items-center mb-4">
            <View className="w-16 h-16 rounded-full items-center justify-center bg-orange-100">
              <Text className="text-3xl">{'\u{1F4B8}'}</Text>
            </View>
          </View>

          <Text
            className="text-[18px] font-black text-center text-orange-600 mb-1"
            style={{ fontFamily: petTypography.heading }}
          >
            Insufficient {currency}
          </Text>
          <Text className="text-[11px] text-gray-400 font-semibold text-center mb-5">
            You don't have enough to complete this purchase
          </Text>

          {/* Breakdown */}
          <View className="bg-gray-50 rounded-2xl px-5 py-4 mb-5 border border-gray-100">
            <View className="flex-row justify-between items-center mb-2.5">
              <Text className="text-[13px] text-gray-600 font-semibold">Required</Text>
              <Text className="text-[13px] text-gray-800 font-bold">
                {currency === 'SOL' ? required.toFixed(4) : required.toFixed(0)} {currency}
              </Text>
            </View>
            <View className="flex-row justify-between items-center mb-2.5">
              <Text className="text-[13px] text-gray-600 font-semibold">Your Balance</Text>
              <Text className="text-[13px] text-gray-800 font-bold">
                {currency === 'SOL' ? available.toFixed(4) : available.toFixed(0)} {currency}
              </Text>
            </View>
            <View className="border-t border-dashed border-gray-200 my-2" />
            <View className="flex-row justify-between items-center">
              <Text className="text-[15px] text-gray-800 font-black">Shortage</Text>
              <Text className="text-[15px] font-black text-red-500">{shortage} {currency}</Text>
            </View>
          </View>

          {/* Close */}
          <TouchableOpacity onPress={onClose} activeOpacity={0.85}>
            <LinearGradient
              colors={['#6B7280', '#4B5563']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="py-3.5 items-center"
              style={{ borderRadius: 14 }}
            >
              <Text className="text-white text-[14px] font-black tracking-wider uppercase">
                Got It
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function WalletConfirmModal({
  visible,
  item,
}: {
  visible: boolean;
  item: ShopItem | null;
}) {
  if (!item) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View className="flex-1 bg-black/60 items-center justify-center px-8">
        <View
          className="bg-white w-full px-7 py-10 items-center"
          style={{
            borderRadius: 32,
            shadowColor: '#4FB0C6',
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.25,
            shadowRadius: 28,
            elevation: 20,
          }}
        >
          {/* Pulsing wallet icon */}
          <View
            className="w-20 h-20 rounded-full items-center justify-center bg-pet-blue-light/30 border-2 border-pet-blue-light/60 mb-5"
          >
            <MaterialCommunityIcons name="wallet" size={36} color="#3792A6" />
          </View>

          <Text
            className="text-[20px] font-black text-gray-800 text-center mb-2"
            style={{ fontFamily: petTypography.heading }}
          >
            Confirm in Wallet
          </Text>
          <Text className="text-[13px] text-gray-400 font-semibold text-center mb-6">
            Approve the transaction in your wallet app
          </Text>

          {/* Item being purchased */}
          <View className="flex-row items-center bg-gray-50 rounded-2xl px-5 py-4 w-full border border-gray-100 mb-6">
            <View className="w-12 h-12 rounded-xl items-center justify-center bg-white border border-gray-100 mr-3">
              <Text className="text-2xl">{item.image}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-black text-gray-800" style={{ fontFamily: petTypography.heading }}>
                {item.name}
              </Text>
              <Text className="text-[11px] font-semibold text-gray-400 uppercase">{item.category}</Text>
            </View>
          </View>

          <ActivityIndicator size="large" color="#3792A6" />

          <Text className="text-[11px] text-gray-300 font-semibold mt-4">
            Do not close this screen
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function ReceiptModal({
  visible,
  success,
  item,
  paidWithSkr,
  errorMsg,
  onClose,
}: {
  visible: boolean;
  success: boolean;
  item: ShopItem | null;
  paidWithSkr: boolean;
  errorMsg: string;
  onClose: () => void;
}) {
  if (!item) return null;

  const level = useXpStore.getState().level;
  const perks = getPerksForLevel(level);
  const discount = perks.shopDiscount;
  const discountPercent = Math.round(discount * 100);
  const discountAmount = Math.round(item.price * discount * 1000000) / 1000000;
  const finalPrice = Math.round(item.price * (1 - discount) * 1000000) / 1000000;
  const networkFee = 0.000005;

  const isCancelled = errorMsg.includes('rejected') || errorMsg.includes('declined') || errorMsg.includes('Cancelled');

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View className="flex-1 bg-black/50 items-center justify-center px-6">
        <View
          className="bg-white w-full px-6 py-7"
          style={{
            borderRadius: 28,
            shadowColor: success ? '#4FB0C6' : '#EF4444',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.2,
            shadowRadius: 24,
            elevation: 15,
          }}
        >
          {/* Status icon */}
          <View className="items-center mb-4">
            <View
              className={`w-16 h-16 rounded-full items-center justify-center ${
                success ? 'bg-green-100' : isCancelled ? 'bg-orange-100' : 'bg-red-100'
              }`}
            >
              <Text className="text-3xl">
                {success ? '\u2705' : isCancelled ? '\u{1F6AB}' : '\u274C'}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text
            className={`text-[18px] font-black text-center mb-1 ${
              success ? 'text-green-700' : isCancelled ? 'text-orange-600' : 'text-red-600'
            }`}
            style={{ fontFamily: petTypography.heading }}
          >
            {success ? 'Purchase Complete!' : isCancelled ? 'Transaction Cancelled' : 'Purchase Failed'}
          </Text>
          <Text className="text-[11px] text-gray-400 font-semibold text-center mb-5">
            {success ? 'Receipt' : isCancelled ? 'No charges were made' : 'Something went wrong'}
          </Text>

          {/* Item info */}
          <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-3 mb-4 border border-gray-100">
            <View className="w-12 h-12 rounded-xl items-center justify-center bg-white border border-gray-100 mr-3">
              <Text className="text-2xl">{item.image}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-black text-gray-800" style={{ fontFamily: petTypography.heading }}>
                {item.name}
              </Text>
              <Text className="text-[11px] font-semibold text-gray-400 uppercase">{item.category}</Text>
            </View>
            {success && (
              <View className="bg-green-100 rounded-full px-2.5 py-1">
                <Text className="text-[10px] font-black text-green-700">OWNED</Text>
              </View>
            )}
          </View>

          {/* Bill breakdown */}
          <View className="bg-gray-50 rounded-2xl px-5 py-4 mb-5 border border-gray-100">
            {paidWithSkr && item.skrPrice ? (
              <>
                <View className="flex-row justify-between items-center mb-2.5">
                  <Text className="text-[13px] text-gray-600 font-semibold">Item Price</Text>
                  <Text className="text-[13px] text-gray-800 font-bold">{item.skrPrice} SKR</Text>
                </View>
                <View className="flex-row justify-between items-center mb-2.5">
                  <Text className="text-[13px] text-gray-600 font-semibold">Network Fee</Text>
                  <Text className="text-[13px] text-gray-500 font-bold">~0.000005 SOL</Text>
                </View>
                <View className="border-t border-dashed border-gray-200 my-2" />
                <View className="flex-row justify-between items-center">
                  <Text className="text-[15px] text-gray-800 font-black">Total</Text>
                  <Text className={`text-[15px] font-black ${success ? 'text-purple-600' : 'text-gray-400 line-through'}`}>
                    {item.skrPrice} SKR
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View className="flex-row justify-between items-center mb-2.5">
                  <Text className="text-[13px] text-gray-600 font-semibold">Item Price</Text>
                  <Text className="text-[13px] text-gray-800 font-bold">{item.price} SOL</Text>
                </View>
                {discount > 0 && (
                  <View className="flex-row justify-between items-center mb-2.5">
                    <View className="flex-row items-center">
                      <Text className="text-[13px] text-green-600 font-semibold">Level {level} Discount</Text>
                      <View className="bg-green-100 rounded-full px-2 py-0.5 ml-2">
                        <Text className="text-[10px] font-black text-green-700">-{discountPercent}%</Text>
                      </View>
                    </View>
                    <Text className="text-[13px] text-green-600 font-bold">-{discountAmount} SOL</Text>
                  </View>
                )}
                <View className="flex-row justify-between items-center mb-2.5">
                  <Text className="text-[13px] text-gray-600 font-semibold">Network Fee</Text>
                  <Text className="text-[13px] text-gray-500 font-bold">~{networkFee} SOL</Text>
                </View>
                <View className="border-t border-dashed border-gray-200 my-2" />
                <View className="flex-row justify-between items-center">
                  <Text className="text-[15px] text-gray-800 font-black">Total</Text>
                  <Text className={`text-[15px] font-black ${success ? 'text-pet-blue-dark' : 'text-gray-400 line-through'}`}>
                    {finalPrice} SOL
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Status message */}
          {success && (
            <View className="flex-row items-center justify-center mb-5 bg-green-50 rounded-xl py-2.5 px-3 border border-green-100">
              <MaterialCommunityIcons name="check-circle" size={16} color="#15803D" />
              <Text className="text-[12px] font-bold text-green-700 ml-2">Item added to your collection</Text>
            </View>
          )}
          {!success && !isCancelled && (
            <View className="flex-row items-center justify-center mb-5 bg-red-50 rounded-xl py-2.5 px-3 border border-red-100">
              <MaterialCommunityIcons name="alert-circle" size={16} color="#DC2626" />
              <Text className="text-[11px] font-semibold text-red-600 ml-2 flex-1" numberOfLines={2}>{errorMsg}</Text>
            </View>
          )}

          {/* Close button */}
          <TouchableOpacity onPress={onClose} activeOpacity={0.85}>
            <LinearGradient
              colors={success ? ['#48B4CD', '#3B8BB4'] : ['#6B7280', '#4B5563']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="py-3.5 items-center"
              style={{ borderRadius: 14 }}
            >
              <Text className="text-white text-[14px] font-black tracking-wider uppercase">
                {success ? 'Done' : 'Close'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function ShopScreen() {
  const { items, buyItem, equipItem, unequipItem, equippedItemId, equippedAnimationId, hydrateShop } = useShopStore();
  const [selectedSection, setSelectedSection] = useState<ShopSection>('All');
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>('all');
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [paymentItem, setPaymentItem] = useState<ShopItem | null>(null);
  const [receiptItem, setReceiptItem] = useState<ShopItem | null>(null);
  const [receiptSuccess, setReceiptSuccess] = useState(false);
  const [receiptSkr, setReceiptSkr] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  const [fundsModal, setFundsModal] = useState<{ currency: 'SOL' | 'SKR'; required: number; available: number } | null>(null);
  const balance = useWalletStore((s) => s.balance);
  const skrBalance = useWalletStore((s) => s.skrBalance);
  const premium = usePremiumStore((s) => s.isPremium);
  const tier = usePremiumStore((s) => s.tier);

  useEffect(() => {
    hydrateShop();
  }, [hydrateShop]);

  // Filter out items locked behind a higher tier
  const TIER_TAG_MAP: Record<string, PremiumTier> = {
    plus_exclusive: 'plus',
    pro_exclusive: 'pro',
  };

  const visibleItems = useMemo(() => {
    return items.filter((i) => {
      if (!i.tierTag) return true;
      const required = TIER_TAG_MAP[i.tierTag];
      return required ? isAtLeastTier(tier, required) : true;
    }).filter((i) => {
      if (ownershipFilter === 'all') return true;
      return ownershipFilter === 'owned' ? i.owned : !i.owned;
    });
  }, [items, tier, ownershipFilter]);

  const sectioned = useMemo(() => {
    const bySection: Record<Exclude<ShopSection, 'All'>, ShopItem[]> = {
      Accessories: visibleItems.filter((i) => i.category === 'Accessories'),
      Animations: visibleItems.filter((i) => i.category === 'Animations'),
      Clothes: visibleItems.filter((i) => i.category === 'Hats' || i.category === 'Shirts'),
      Shoes: visibleItems.filter((i) => i.category === 'Shoes'),
      Other: visibleItems.filter((i) => !['Accessories', 'Animations', 'Hats', 'Shirts', 'Shoes'].includes(i.category)),
    };
    return bySection;
  }, [visibleItems]);

  const filtered =
    selectedSection === 'All'
      ? visibleItems
      : sectioned[selectedSection as Exclude<ShopSection, 'All'>] ?? [];

  const sectionOrder: Exclude<ShopSection, 'All'>[] = [
    'Accessories',
    'Animations',
    'Clothes',
    'Shoes',
    'Other',
  ];

  const doPurchase = async (item: ShopItem, withSkr: boolean) => {
    const start = Date.now();
    console.log('[ShopScreen] doPurchase start', {
      itemId: item.id,
      itemName: item.name,
      withSkr,
      solBalance: balance,
      skrBalance,
    });
    setPurchasingId(item.id);
    try {
      await buyItem(item.id, withSkr);
      console.log('[ShopScreen] doPurchase success', {
        itemId: item.id,
        withSkr,
        elapsedMs: Date.now() - start,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Play money sounds: Money.mp3 immediately, then HappyMoney.mp3 after a short delay
      playSfx('money').catch(() => {});
      setTimeout(() => playSfx('happymoney').catch(() => {}), 800);
      setReceiptItem(item);
      setReceiptSuccess(true);
      setReceiptSkr(withSkr);
      setReceiptError('');
    } catch (err: any) {
      console.error('[ShopScreen] doPurchase failed', {
        itemId: item.id,
        withSkr,
        elapsedMs: Date.now() - start,
        error: err?.message,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setReceiptItem(item);
      setReceiptSuccess(false);
      setReceiptSkr(withSkr);
      setReceiptError(friendlyTxError(err));
    } finally {
      setPurchasingId(null);
    }
  };

  const handleBuy = (item: ShopItem) => {
    if (purchasingId) return;
    setPaymentItem(item);
  };

  const handlePaySol = () => {
    if (!paymentItem) return;
    const lvl = useXpStore.getState().level;
    const disc = getPerksForLevel(lvl).shopDiscount;
    const discountedPrice = Math.round(paymentItem.price * (1 - disc) * 100) / 100;
    if (balance < discountedPrice) {
      console.warn('[ShopScreen] handlePaySol insufficient balance', {
        itemId: paymentItem.id,
        required: discountedPrice,
        available: balance,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFundsModal({ currency: 'SOL', required: discountedPrice, available: balance });
      return;
    }
    console.log('[ShopScreen] handlePaySol proceed', {
      itemId: paymentItem.id,
      discountedPrice,
      balance,
    });
    const item = paymentItem;
    setPaymentItem(null);
    doPurchase(item, false);
  };

  const handlePaySkr = () => {
    if (!paymentItem || !paymentItem.skrPrice) return;
    if (skrBalance < paymentItem.skrPrice) {
      console.warn('[ShopScreen] handlePaySkr insufficient balance', {
        itemId: paymentItem.id,
        required: paymentItem.skrPrice,
        available: skrBalance,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFundsModal({ currency: 'SKR', required: paymentItem.skrPrice, available: skrBalance });
      return;
    }
    console.log('[ShopScreen] handlePaySkr proceed', {
      itemId: paymentItem.id,
      skrPrice: paymentItem.skrPrice,
      skrBalance,
    });
    const item = paymentItem;
    setPaymentItem(null);
    doPurchase(item, true);
  };

  const handleEquip = (item: ShopItem) => {
    equipItem(item.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleUnequip = (item: ShopItem) => {
    unequipItem(item.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const rows: ShopItem[][] = [];
  for (let i = 0; i < filtered.length; i += 2) {
    rows.push(filtered.slice(i, i + 2));
  }

  return (
    <View className="flex-1 bg-pet-background">
      <LinearGradient
        colors={['#EFF7FF', '#E8F3FD', '#F4FAFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />
      <View className="absolute -top-8 -left-12 w-44 h-44 rounded-full bg-pet-blue-light/30" />
      <View className="absolute top-44 -right-12 w-52 h-52 rounded-full bg-pet-blue-light/20" />
      <Text className="absolute top-12 left-8 text-[16px] opacity-45">{'\u2728'}</Text>
      <Text className="absolute top-20 right-8 text-[14px] opacity-35">{'\u{1F31F}'}</Text>

      <View className="px-6 pt-5 pb-4">
        <ScreenHeader
          eyebrow="Nomi Boutique"
          title="Shop"
          subtitle="Cute gear and outfits for your companion."
          badge="Fresh drops daily · v2"
          rightSlot={(
            <View className="bg-white/20 rounded-2xl px-3.5 py-2 border border-white/40">
              <View className="flex-row items-center">
                <MaterialCommunityIcons name="wallet-outline" size={15} color="#ffffff" />
                <Text className="text-[12px] font-black text-white ml-1.5">{balance.toFixed(2)}</Text>
                <Text className="text-[10px] font-bold text-white/85 ml-1">SOL</Text>
              </View>
              {skrBalance > 0 && (
                <View className="flex-row items-center mt-0.5">
                  <Text className="text-[10px] font-black text-white/90 ml-5">{skrBalance.toFixed(0)}</Text>
                  <Text className="text-[9px] font-bold text-white/70 ml-1">SKR</Text>
                </View>
              )}
            </View>
          )}
        />
      </View>

      <View className="px-6 mb-5">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 16 }}
        >
          {SECTIONS.map((cat) => (
            <CategoryPill
              key={cat}
              label={cat}
              icon={SECTION_META[cat].icon}
              active={selectedSection === cat}
              onPress={() => setSelectedSection(cat)}
            />
          ))}
        </ScrollView>
      </View>

      <View className="px-6 mb-4 flex-row" style={{ gap: 8 }}>
        {OWNERSHIP_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setOwnershipFilter(f.key)}
            activeOpacity={0.85}
          >
            <View
              className={`px-4 py-2 ${
                ownershipFilter === f.key ? 'bg-pet-blue-dark' : 'bg-white border border-gray-200'
              }`}
              style={{ borderRadius: PILL_RADIUS }}
            >
              <Text
                className={`text-[11px] font-bold tracking-[0.3px] ${
                  ownershipFilter === f.key ? 'text-white' : 'text-gray-500'
                }`}
                style={{ fontFamily: petTypography.heading }}
              >
                {f.label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
      >
        {selectedSection === 'All' ? (
          sectionOrder.map((section) => {
            const sectionItems = sectioned[section];
            const sectionRows: ShopItem[][] = [];
            for (let i = 0; i < sectionItems.length; i += 2) {
              sectionRows.push(sectionItems.slice(i, i + 2));
            }

            return (
              <View key={section} className="mb-6">
                <View className="mb-3 px-1 flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className={`w-7 h-7 rounded-full items-center justify-center ${SECTION_META[section].tone}`}>
                      <Text className="text-white text-[12px]">{SECTION_META[section].icon}</Text>
                    </View>
                    <Text className="text-[12px] font-black text-pet-blue-dark uppercase tracking-[0.8px] ml-2">{section}</Text>
                  </View>
                  <Text className="text-[11px] font-semibold text-gray-400">{sectionItems.length} items</Text>
                </View>

                {sectionRows.length > 0 ? (
                  sectionRows.map((row, rowIdx) => (
                    <View key={`${section}-${rowIdx}`} className="flex-row gap-3 mb-3">
                      {row.map((item) => (
                        <ShopCard
                          key={item.id}
                          item={item}
                          equipped={item.category === 'Animations' ? equippedAnimationId === item.id : equippedItemId === item.id}
                          isPremium={premium}
                          purchasing={purchasingId === item.id}
                          onBuy={() => handleBuy(item)}
                          onEquip={() => handleEquip(item)}
                          onUnequip={() => handleUnequip(item)}
                        />
                      ))}
                      {row.length === 1 && <View className="flex-1" />}
                    </View>
                  ))
                ) : (
                  <View className="bg-white rounded-3xl border border-gray-100 p-5 items-center">
                    <MaterialCommunityIcons name="star-four-points" size={24} color="#4FB0C6" />
                    <Text className="text-[14px] font-black text-gray-700 mt-2">Coming soon</Text>
                    <Text className="text-[12px] text-gray-500 text-center mt-1">Fresh {section.toLowerCase()} drops are on the way.</Text>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <>
            <View className="mb-3 px-1">
              <View className="flex-row items-center">
                <View className={`w-7 h-7 rounded-full items-center justify-center ${SECTION_META[selectedSection].tone}`}>
                  <Text className="text-white text-[12px]">{SECTION_META[selectedSection].icon}</Text>
                </View>
                <Text className="text-[12px] font-black text-pet-blue-dark uppercase tracking-[0.8px] ml-2">{selectedSection}</Text>
              </View>
            </View>

            {filtered.length > 0 ? (
              rows.map((row, rowIdx) => (
                <View key={rowIdx} className="flex-row gap-3 mb-3">
                  {row.map((item) => (
                    <ShopCard
                      key={item.id}
                      item={item}
                      equipped={item.category === 'Animations' ? equippedAnimationId === item.id : equippedItemId === item.id}
                      isPremium={premium}
                      purchasing={purchasingId === item.id}
                      onBuy={() => handleBuy(item)}
                      onEquip={() => handleEquip(item)}
                      onUnequip={() => handleUnequip(item)}
                    />
                  ))}
                  {row.length === 1 && <View className="flex-1" />}
                </View>
              ))
            ) : (
              <View className="bg-white rounded-3xl border border-gray-100 p-5 items-center">
                <MaterialCommunityIcons name="star-four-points" size={24} color="#4FB0C6" />
                <Text className="text-[14px] font-black text-gray-700 mt-2">Coming soon</Text>
                <Text className="text-[12px] text-gray-500 text-center mt-1">Fresh {selectedSection.toLowerCase()} drops are on the way.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <PaymentModal
        item={paymentItem}
        visible={!!paymentItem}
        onClose={() => setPaymentItem(null)}
        onPaySol={handlePaySol}
        onPaySkr={handlePaySkr}
        solBalance={balance}
        skrBalance={skrBalance}
      />

      <ReceiptModal
        visible={!!receiptItem}
        success={receiptSuccess}
        item={receiptItem}
        paidWithSkr={receiptSkr}
        errorMsg={receiptError}
        onClose={() => setReceiptItem(null)}
      />

      <WalletConfirmModal
        visible={!!purchasingId}
        item={items.find((i) => i.id === purchasingId) ?? null}
      />

      <InsufficientFundsModal
        visible={!!fundsModal}
        currency={fundsModal?.currency ?? 'SOL'}
        required={fundsModal?.required ?? 0}
        available={fundsModal?.available ?? 0}
        onClose={() => setFundsModal(null)}
      />
    </View>
  );
}


