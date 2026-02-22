import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ShopItem } from '@/store/shopStore';

const COLORS = {
  card: '#262626',
  cardInner: '#404040',
  text: '#FFFFFF',
  textMuted: '#9CA3AF',
  primary: '#8B5CF6',
  success: '#10B981',
};

interface ShopItemCardProps {
  item: ShopItem;
  onBuy: () => void;
}

export function ShopItemCard({ item, onBuy }: ShopItemCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.preview}>
        <Text style={styles.previewEmoji}>{item.image}</Text>
      </View>
      
      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.category}>{item.category}</Text>
      
      <View style={styles.footer}>
        <Text style={styles.price}>{item.price} SOL</Text>
        <TouchableOpacity
          onPress={onBuy}
          activeOpacity={0.8}
          style={[styles.buyBtn, item.owned && styles.buyBtnOwned]}
          disabled={item.owned}
        >
          <Text style={styles.buyBtnText}>{item.owned ? 'Owned' : 'Buy'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    flex: 1,
    margin: 6,
  },
  preview: {
    height: 80,
    backgroundColor: COLORS.cardInner,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  previewEmoji: {
    fontSize: 40,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  category: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  buyBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  buyBtnOwned: {
    backgroundColor: COLORS.cardInner,
  },
  buyBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
  },
});
