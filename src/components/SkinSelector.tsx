import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useShopStore } from '../store/shopStore';

function SadToast({ message, onDone }: { message: string; onDone: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => onDone());
    }, 2500);
    return () => clearTimeout(timer);
  }, [fadeAnim, onDone]);

  return (
    <Animated.View
      style={{ opacity: fadeAnim }}
      className="absolute -top-14 left-0 right-0 z-30 items-center px-4"
    >
      <View className="bg-pet-pink px-5 py-2.5 rounded-2xl border border-pet-pink-dark/30"
        style={{
          shadowColor: '#E8647C',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <Text className="text-[12px] font-bold text-white text-center">{message}</Text>
      </View>
    </Animated.View>
  );
}

export function SkinSelector() {
  const { items, equippedItemId, equipItem, unequipItem } = useShopStore();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const ownedItems = items.filter((i) => i.owned);

  const handlePress = (itemId: string) => {
    if (equippedItemId === itemId) {
      unequipItem();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      equipItem(itemId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  return (
    <View className="px-6 relative">
      {toastMessage && (
        <SadToast message={toastMessage} onDone={() => setToastMessage(null)} />
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingRight: 24 }}
      >
        {/* Default (no accessory) */}
        <TouchableOpacity
          onPress={() => {
            unequipItem();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          activeOpacity={0.8}
          className={`w-24 items-center py-4 px-2 rounded-3xl border-2 ${
            !equippedItemId
              ? 'bg-pet-blue-light/20 border-pet-blue border-b-4'
              : 'bg-white border-gray-100 border-b-4'
          }`}
          style={{
            shadowColor: !equippedItemId ? '#4FB0C6' : '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: !equippedItemId ? 0.2 : 0.05,
            shadowRadius: 8,
            elevation: !equippedItemId ? 4 : 2,
          }}
        >
          <View className={`w-14 h-14 rounded-2xl items-center justify-center mb-2 ${
            !equippedItemId ? 'bg-pet-blue' : 'bg-gray-50'
          }`}>
            <Text className="text-3xl">{'\u{1F43E}'}</Text>
          </View>
          <Text className={`text-[11px] font-black uppercase tracking-tighter text-center ${
            !equippedItemId ? 'text-pet-blue-dark' : 'text-gray-400'
          }`}>
            Default
          </Text>
        </TouchableOpacity>

        {/* Owned items */}
        {ownedItems.map((item) => {
          const isSelected = equippedItemId === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => handlePress(item.id)}
              activeOpacity={0.8}
              className={`w-24 items-center py-4 px-2 rounded-3xl border-2 ${
                isSelected
                  ? 'bg-pet-blue-light/20 border-pet-blue border-b-4'
                  : 'bg-white border-gray-100 border-b-4'
              }`}
              style={{
                shadowColor: isSelected ? '#4FB0C6' : '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isSelected ? 0.2 : 0.05,
                shadowRadius: 8,
                elevation: isSelected ? 4 : 2,
              }}
            >
              <View className={`w-14 h-14 rounded-2xl items-center justify-center mb-2 ${
                isSelected ? 'bg-pet-blue' : 'bg-gray-50'
              }`}>
                <Text className="text-3xl">{item.image}</Text>
              </View>
              <Text className={`text-[11px] font-black uppercase tracking-tighter text-center ${
                isSelected ? 'text-pet-blue-dark' : 'text-gray-400'
              }`}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* "Get more" placeholder */}
        {ownedItems.length < 3 && (
          <View className="w-24 items-center justify-center py-4 px-2 rounded-3xl bg-gray-50/50 border-2 border-dashed border-gray-200">
            <View className="w-14 h-14 bg-white rounded-2xl items-center justify-center mb-2 border border-gray-100">
              <Text className="text-2xl text-gray-300">+</Text>
            </View>
            <Text className="text-[10px] font-black text-gray-300 uppercase text-center">Shop</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
