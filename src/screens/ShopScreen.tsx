import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useShopStore, type ShopItem } from '../store/shopStore';
import { useWalletStore } from '../store/walletStore';
import { ScreenHeader } from '../components/ui/ScreenHeader';

type ShopSection = 'All' | 'Accessories' | 'Animations' | 'Clothes' | 'Shoes' | 'Other';
const SECTIONS: ShopSection[] = ['All', 'Accessories', 'Animations', 'Clothes', 'Shoes', 'Other'];
const SECTION_META: Record<ShopSection, { icon: string; tone: string }> = {
  All: { icon: '\u{1F31F}', tone: 'bg-pet-blue' },
  Accessories: { icon: '\u{1F451}', tone: 'bg-pet-purple' },
  Animations: { icon: '\u{1F3AC}', tone: 'bg-pet-pink' },
  Clothes: { icon: '\u{1F455}', tone: 'bg-pet-orange' },
  Shoes: { icon: '\u{1F45F}', tone: 'bg-pet-green' },
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
        className={`px-4 py-2.5 rounded-full mr-2 flex-row items-center ${
          active ? 'bg-pet-blue' : 'bg-white border border-gray-200'
        }`}
      >
        <Text className={`text-[13px] mr-1.5 ${active ? '' : 'opacity-60'}`}>{icon}</Text>
        <Text
          className={`text-[12px] font-bold ${
            active ? 'text-white' : 'text-gray-500'
          }`}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function ShopCard({
  item,
  equipped,
  onBuy,
  onEquip,
  onUnequip,
}: {
  item: ShopItem;
  equipped: boolean;
  onBuy: () => void;
  onEquip: () => void;
  onUnequip: () => void;
}) {
  const handlePress = () => {
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
      className={`flex-1 bg-white rounded-3xl p-4 border ${
        equipped ? 'border-pet-blue border-2' : 'border-gray-100'
      }`}
      style={{
        shadowColor: equipped ? '#4FB0C6' : '#22314A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: equipped ? 0.15 : 0.05,
        shadowRadius: 10,
        elevation: equipped ? 5 : 2,
      }}
    >
      <View className="items-center mb-3">
        <View
          className={`w-16 h-16 rounded-2xl items-center justify-center ${
            equipped ? 'bg-pet-blue/15' : 'bg-gray-50'
          }`}
        >
          <Text className="text-4xl">{item.image}</Text>
        </View>
      </View>

      <Text className="text-[13px] font-black text-gray-800 text-center" numberOfLines={1}>
        {item.name}
      </Text>
      <Text className="text-[10px] font-semibold text-gray-400 text-center mt-0.5 uppercase tracking-wider">
        {item.category}
      </Text>

      <View className="flex-row items-center justify-center mt-2 mb-3">
        <Text className="text-[14px] font-black text-pet-blue-dark">{item.price}</Text>
        <Text className="text-[11px] font-bold text-gray-400 ml-1">SOL</Text>
      </View>

      <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
        {!item.owned ? (
          <LinearGradient
            colors={['#3792A6', '#4FB0C6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="py-2.5 rounded-xl items-center"
          >
            <Text className="text-white text-[12px] font-black tracking-wider uppercase">Buy</Text>
          </LinearGradient>
        ) : equipped ? (
          <View className="py-2.5 rounded-xl items-center bg-pet-blue/15 border border-pet-blue/40">
            <Text className="text-pet-blue-dark text-[12px] font-black tracking-wider uppercase">Equipped</Text>
          </View>
        ) : (
          <View className="py-2.5 rounded-xl items-center bg-gray-100 border border-gray-200">
            <Text className="text-gray-600 text-[12px] font-black tracking-wider uppercase">Equip</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

export function ShopScreen() {
  const { items, buyItem, equipItem, unequipItem, equippedItemId, hydrateShop } = useShopStore();
  const [selectedSection, setSelectedSection] = useState<ShopSection>('All');
  const balance = useWalletStore((s) => s.balance);

  useEffect(() => {
    hydrateShop();
  }, [hydrateShop]);

  const sectioned = useMemo(() => {
    const bySection: Record<Exclude<ShopSection, 'All'>, ShopItem[]> = {
      Accessories: items.filter((i) => i.category === 'Accessories'),
      Animations: [],
      Clothes: items.filter((i) => i.category === 'Hats' || i.category === 'Shirts'),
      Shoes: items.filter((i) => i.category === 'Shoes'),
      Other: items.filter((i) => !['Accessories', 'Hats', 'Shirts', 'Shoes'].includes(i.category)),
    };
    return bySection;
  }, [items]);

  const filtered =
    selectedSection === 'All'
      ? items
      : sectioned[selectedSection as Exclude<ShopSection, 'All'>] ?? [];

  const sectionOrder: Exclude<ShopSection, 'All'>[] = [
    'Accessories',
    'Animations',
    'Clothes',
    'Shoes',
    'Other',
  ];

  const handleBuy = (item: ShopItem) => {
    if (balance < item.price) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Not Enough SOL', `You need ${item.price} SOL but only have ${balance.toFixed(2)} SOL.`);
      return;
    }

    Alert.alert(
      'Confirm Purchase',
      `Buy ${item.name} for ${item.price} SOL?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy',
          onPress: () => {
            buyItem(item.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleEquip = (item: ShopItem) => {
    equipItem(item.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleUnequip = () => {
    unequipItem();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const rows: ShopItem[][] = [];
  for (let i = 0; i < filtered.length; i += 2) {
    rows.push(filtered.slice(i, i + 2));
  }

  return (
    <View className="flex-1 bg-pet-background">
      <View className="absolute -top-8 -left-12 w-44 h-44 rounded-full bg-pet-blue-light/30" />
      <View className="absolute top-44 -right-12 w-52 h-52 rounded-full bg-pet-purple-light/20" />

      <View className="px-6 pt-4 pb-3">
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
            </View>
          )}
        />
      </View>

      <View className="px-6 mb-4">
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

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
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
                          equipped={equippedItemId === item.id}
                          onBuy={() => handleBuy(item)}
                          onEquip={() => handleEquip(item)}
                          onUnequip={handleUnequip}
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
                      equipped={equippedItemId === item.id}
                      onBuy={() => handleBuy(item)}
                      onEquip={() => handleEquip(item)}
                      onUnequip={handleUnequip}
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
    </View>
  );
}
