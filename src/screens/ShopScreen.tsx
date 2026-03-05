import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useShopStore, type ShopItem, type ItemRarity, getItemLockState } from '../store/shopStore';
import { useWalletStore } from '../store/walletStore';
import { usePremiumStore, getCurrentTier } from '../store/premiumStore';
import { isAtLeastTier, type PremiumTier } from '../data/premiumTiers';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { petTypography } from '../theme/typography';

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
  const isLocked = lockState.locked && !item.owned;

  const handlePress = () => {
    if (isLocked) return;
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
              {item.tierTag === 'diamond_exclusive' ? '\u{1F48E}' : '\u{1F451}'}
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

      <View className="items-center mt-3 mb-4">
        {isPremium && !item.owned ? (
            <Text className="text-[14px] font-black text-pet-blue-dark">FREE</Text>
        ) : (
          <>
            <View className="flex-row items-center justify-center">
              <Text className="text-[14px] font-black text-pet-blue-dark">{item.price}</Text>
              <Text className="text-[11px] font-bold text-gray-400 ml-1">SOL</Text>
            </View>
            {item.skrPrice && !item.owned && (
              <View className="flex-row items-center justify-center mt-1">
                <Text className="text-[11px] font-black text-purple-600">{item.skrPrice}</Text>
                <Text className="text-[9px] font-bold text-purple-400 ml-1">SKR</Text>
              </View>
            )}
          </>
        )}
      </View>

      {isLocked ? (
        <View className="py-2.5 px-2 items-center justify-center bg-gray-200 border border-gray-300" style={{ borderRadius: BUTTON_RADIUS }}>
          <Text className="text-[9px] font-black text-gray-500 uppercase tracking-wider text-center">
            {'\u{1F512}'} {lockState.reason}
          </Text>
        </View>
      ) : purchasing ? (
        <View className="py-3 items-center bg-pet-blue-light/30 border border-pet-blue-light/70 flex-row justify-center" style={{ borderRadius: BUTTON_RADIUS }}>
          <ActivityIndicator size="small" color="#3792A6" />
          <Text className="text-pet-blue-dark text-[10px] font-black tracking-wider uppercase ml-2">Confirm in Phantom...</Text>
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
  if (!item) return null;
  const canAffordSol = solBalance >= item.price;
  const canAffordSkr = !!item.skrPrice && skrBalance >= item.skrPrice;

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
            onPress={onPaySol}
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
              <Text className={`text-[16px] font-black ${canAffordSol ? 'text-pet-blue-dark' : 'text-gray-300'}`}>{item.price} SOL</Text>
            </View>
          </TouchableOpacity>

          {/* SKR option */}
          {item.skrPrice ? (
            <TouchableOpacity
              onPress={onPaySkr}
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

          <TouchableOpacity onPress={onClose} activeOpacity={0.85}>
            <Text className="text-[13px] font-bold text-gray-400">Cancel</Text>
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
  const balance = useWalletStore((s) => s.balance);
  const skrBalance = useWalletStore((s) => s.skrBalance);
  const premium = usePremiumStore((s) => s.isPremium);
  const tier = usePremiumStore((s) => s.tier);

  useEffect(() => {
    hydrateShop();
  }, [hydrateShop]);

  // Filter out items locked behind a higher tier
  const TIER_TAG_MAP: Record<string, PremiumTier> = {
    gold_exclusive: 'gold',
    diamond_exclusive: 'diamond',
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
    setPurchasingId(item.id);
    try {
      await buyItem(item.id, withSkr);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Purchase Complete!',
        `${item.name} is now yours! Check Profile for transaction details.`,
      );
    } catch (err: any) {
      const msg = err?.message || 'Purchase failed';
      if (msg.includes('User rejected') || msg.includes('declined')) {
        Alert.alert('Cancelled', 'Transaction cancelled in wallet.');
      } else {
        Alert.alert('Purchase Failed', msg);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
    if (balance < paymentItem.price) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Not Enough SOL', `You need ${paymentItem.price} SOL but only have ${balance.toFixed(2)} SOL.`);
      return;
    }
    const item = paymentItem;
    setPaymentItem(null);
    doPurchase(item, false);
  };

  const handlePaySkr = () => {
    if (!paymentItem || !paymentItem.skrPrice) return;
    if (skrBalance < paymentItem.skrPrice) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Not Enough SKR', `You need ${paymentItem.skrPrice} SKR but only have ${skrBalance.toFixed(0)} SKR.`);
      return;
    }
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
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
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
    </View>
  );
}



