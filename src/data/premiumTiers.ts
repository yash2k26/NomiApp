export type PremiumTier = 'none' | 'plus' | 'pro';

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
  plus: {
    tier: 'plus',
    label: 'Plus',
    price: 0.005,
    emoji: '\u{2B50}',
    gradientColors: ['#9381FF', '#766BD1'],
    staminaRegenPerHour: 20,
    cooldownMultiplier: 0.5,
    xpBonus: 0.35,
    freeSpinsPerDay: 3,
    lootBonus: 0.10,
    allShopItemsFree: false,
    miniGameCooldown: true,
    exclusiveItemTags: ['plus_exclusive'],
    badgeColor: '#9381FF',
    glowEffect: 'gold_glow',
    calendarXpMultiplier: 1.5,
  },
  pro: {
    tier: 'pro',
    label: 'Pro',
    price: 0.01,
    emoji: '\u{1F48E}',
    gradientColors: ['#B9F2FF', '#7DF9FF'],
    staminaRegenPerHour: 30,
    cooldownMultiplier: 0.25,
    xpBonus: 0.75,
    freeSpinsPerDay: 5,
    lootBonus: 0.20,
    allShopItemsFree: true,
    miniGameCooldown: false,
    exclusiveItemTags: ['plus_exclusive', 'pro_exclusive'],
    badgeColor: '#7DF9FF',
    glowEffect: 'diamond_aura',
    calendarXpMultiplier: 1.75,
  },
};

export const TIER_ORDER: PremiumTier[] = ['none', 'plus', 'pro'];

export function getTierOrdinal(tier: PremiumTier): number {
  return TIER_ORDER.indexOf(tier);
}

export function isAtLeastTier(current: PremiumTier, required: PremiumTier): boolean {
  return getTierOrdinal(current) >= getTierOrdinal(required);
}

export function getUpgradeCost(current: PremiumTier, target: PremiumTier): number {
  return Math.max(0, TIER_CONFIGS[target].price - TIER_CONFIGS[current].price);
}
