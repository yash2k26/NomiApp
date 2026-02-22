import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { MarketPet } from '@/store/marketStore';

const COLORS = {
  card: '#262626',
  cardInner: '#404040',
  text: '#FFFFFF',
  textMuted: '#9CA3AF',
  primary: '#8B5CF6',
  success: '#10B981',
};

const RARITY_COLORS: Record<string, string> = {
  Common: '#9CA3AF',
  Rare: '#3B82F6',
  Epic: '#8B5CF6',
  Legendary: '#F59E0B',
};

interface PetMarketCardProps {
  pet: MarketPet;
  onBuy: () => void;
}

export function PetMarketCard({ pet, onBuy }: PetMarketCardProps) {
  const rarityColor = RARITY_COLORS[pet.rarity];

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.preview}>
          <Text style={styles.previewEmoji}>{pet.image}</Text>
        </View>
        
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{pet.name}</Text>
            <View style={[styles.rarityBadge, { backgroundColor: rarityColor + '30' }]}>
              <Text style={[styles.rarityText, { color: rarityColor }]}>{pet.rarity}</Text>
            </View>
          </View>
          <Text style={styles.owner}>Owner: {pet.owner}</Text>
        </View>

        <View style={styles.priceContainer}>
          <Text style={styles.price}>{pet.price} SOL</Text>
          <TouchableOpacity onPress={onBuy} activeOpacity={0.8} style={styles.buyBtn}>
            <Text style={styles.buyBtnText}>Buy</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preview: {
    width: 64,
    height: 64,
    backgroundColor: COLORS.cardInner,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  previewEmoji: {
    fontSize: 28,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  rarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  rarityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  owner: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.success,
    marginBottom: 8,
  },
  buyBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  buyBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
});
