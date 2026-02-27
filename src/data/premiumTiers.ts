export type PremiumTier = 'none' | 'silver' | 'gold' | 'diamond';

export interface TierConfig {
  tier: PremiumTier;
  label: string;
  price: number;
  emoji: string;
  gradientColors: [string, string];
  staminaRegenPerHour: number;
  cooldownMultiplier: number;
  xpBonus: number;
  freeSpinsPerDay: number;
  lootBonus: number;
  allShopItemsFree: boolean;
  miniGameCooldown: boolean;
  exclusiveItemTags: string[];
  badgeColor: string;
  glowEffect: 'none' | 'gold_glow' | 'diamond_aura';
  calendarXpMultiplier: number;
}

export const TIER_CONFIGS: Record<PremiumTier, TierConfig> = {
  none: {
    tier: 'none',
    label: 'Free',
    price: 0,
    emoji: '',
    gradientColors: ['#9CA3AF', '#6B7280'],
    staminaRegenPerHour: 10,
    cooldownMultiplier: 1.0,
    xpBonus: 0,
    freeSpinsPerDay: 1,
    lootBonus: 0,
    allShopItemsFree: false,
    miniGameCooldown: true,
    exclusiveItemTags: [],
    badgeColor: '',
    glowEffect: 'none',
    calendarXpMultiplier: 1.0,
  },
  silver: {
    tier: 'silver',
    label: 'Silver',
    price: 5,
    emoji: '\u{1FA99}',
    gradientColors: ['#C0C0C0', '#A8A8A8'],
    staminaRegenPerHour: 15,
    cooldownMultiplier: 0.75,
    xpBonus: 0.25,
    freeSpinsPerDay: 2,
    lootBonus: 0,
    allShopItemsFree: false,
    miniGameCooldown: true,
    exclusiveItemTags: [],
    badgeColor: '#C0C0C0',
    glowEffect: 'none',
    calendarXpMultiplier: 1.25,
  },
  gold: {
    tier: 'gold',
    label: 'Gold',
    price: 15,
    emoji: '\u{1F451}',
    gradientColors: ['#FFD700', '#CCA800'],
    staminaRegenPerHour: 20,
    cooldownMultiplier: 0.5,
    xpBonus: 0.50,
    freeSpinsPerDay: 3,
    lootBonus: 0.10,
    allShopItemsFree: false,
    miniGameCooldown: true,
    exclusiveItemTags: ['gold_exclusive'],
    badgeColor: '#FFD700',
    glowEffect: 'gold_glow',
    calendarXpMultiplier: 1.5,
  },
  diamond: {
    tier: 'diamond',
    label: 'Diamond',
    price: 30,
    emoji: '\u{1F48E}',
    gradientColors: ['#B9F2FF', '#7DF9FF'],
    staminaRegenPerHour: 30,
    cooldownMultiplier: 0.25,
    xpBonus: 0.75,
    freeSpinsPerDay: 5,
    lootBonus: 0.20,
    allShopItemsFree: true,
    miniGameCooldown: false,
    exclusiveItemTags: ['gold_exclusive', 'diamond_exclusive'],
    badgeColor: '#7DF9FF',
    glowEffect: 'diamond_aura',
    calendarXpMultiplier: 1.75,
  },
};

export const TIER_ORDER: PremiumTier[] = ['none', 'silver', 'gold', 'diamond'];

export function getTierOrdinal(tier: PremiumTier): number {
  return TIER_ORDER.indexOf(tier);
}

export function isAtLeastTier(current: PremiumTier, required: PremiumTier): boolean {
  return getTierOrdinal(current) >= getTierOrdinal(required);
}

export function getUpgradeCost(current: PremiumTier, target: PremiumTier): number {
  return Math.max(0, TIER_CONFIGS[target].price - TIER_CONFIGS[current].price);
}
