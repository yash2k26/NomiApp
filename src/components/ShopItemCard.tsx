import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ShopItem } from '@/store/shopStore';
import { useXpStore, getPerksForLevel } from '@/store/xpStore';

const COLORS = {
  card: '#262626',
  cardInner: '#404040',
  text: '#FFFFFF',
  textMuted: '#9CA3AF',
  primary: '#8B5CF6',
  success: '#10B981',
  strikethrough: '#6B7280',
};

interface ShopItemCardProps {
  item: ShopItem;
  onBuy: () => void;
}

export function ShopItemCard({ item, onBuy }: ShopItemCardProps) {
  const level = useXpStore((s) => s.level);
  const perks = getPerksForLevel(level);
  const discount = perks.shopDiscount;
  const discountedPrice = discount > 0
    ? Math.round(item.price * (1 - discount) * 100) / 100
    : item.price;

  return (
    <View style={styles.card}>
      {discount > 0 && !item.owned && (
        <View style={styles.discountBadge}>
          <Text style={styles.discountBadgeText}>-{Math.round(discount * 100)}%</Text>
        </View>
      )}
      <View style={styles.preview}>
        <Text style={styles.previewEmoji}>{item.image}</Text>
      </View>

      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.category}>{item.category}</Text>

      <View style={styles.footer}>
        {discount > 0 && !item.owned ? (
          <View>
            <Text style={styles.originalPrice}>{item.price} SOL</Text>
            <Text style={styles.price}>{discountedPrice} SOL</Text>
          </View>
        ) : (
          <Text style={styles.price}>{item.price} SOL</Text>
        )}
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
  originalPrice: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.strikethrough,
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 1,
  },
  discountBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
