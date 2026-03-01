import type { PremiumTier } from './premiumTiers';

export type CareAction = 'feed' | 'play' | 'rest';

export interface CareVariant {
  id: string;
  action: CareAction;
  label: string;
  emoji: string;
  description: string;
  statEffects: { hunger: number; happiness: number; energy: number };
  staminaCost: number;
  xpReward: number;
  cooldownKey: string;
  unlockCondition?: {
    type: 'level' | 'premium' | 'none';
    value?: number;
    tierRequired?: PremiumTier;
  };
  miniGameId?: string;
}

export const FEED_VARIANTS: CareVariant[] = [
  {
    id: 'feed_kibble',
    action: 'feed',
    label: 'Basic Kibble',
    emoji: '\u{1F35E}',
    description: 'Simple but filling. A staple meal.',
    statEffects: { hunger: 25, happiness: 3, energy: 0 },
    staminaCost: 15,
    xpReward: 8,
    cooldownKey: 'feed_kibble',
  },
  {
    id: 'feed_berries',
    action: 'feed',
    label: 'Fresh Berries',
    emoji: '\u{1F353}',
    description: 'Sweet and refreshing. Nomi loves these!',
    statEffects: { hunger: 15, happiness: 12, energy: 5 },
    staminaCost: 15,
    xpReward: 10,
    cooldownKey: 'feed_berries',
  },
  {
    id: 'feed_feast',
    action: 'feed',
    label: 'Gourmet Feast',
    emoji: '\u{1F372}',
    description: 'A premium multi-course meal. Max satisfaction.',
    statEffects: { hunger: 35, happiness: 10, energy: -5 },
    staminaCost: 20,
    xpReward: 14,
    cooldownKey: 'feed_feast',
    unlockCondition: { type: 'level', value: 10 },
  },
  {
    id: 'feed_golden',
    action: 'feed',
    label: 'Golden Apple',
    emoji: '\u{1F34E}',
    description: 'Legendary fruit. Boosts everything.',
    statEffects: { hunger: 30, happiness: 15, energy: 10 },
    staminaCost: 25,
    xpReward: 18,
    cooldownKey: 'feed_golden',
    unlockCondition: { type: 'premium', tierRequired: 'gold' },
  },
];

export const PLAY_VARIANTS: CareVariant[] = [
  {
    id: 'play_fetch',
    action: 'play',
    label: 'Play Fetch',
    emoji: '\u{1F3BE}',
    description: 'Classic game. Burns energy but big fun.',
    statEffects: { hunger: -10, happiness: 20, energy: -15 },
    staminaCost: 25,
    xpReward: 12,
    cooldownKey: 'play_fetch',
  },
  {
    id: 'play_puzzle',
    action: 'play',
    label: 'Brain Puzzle',
    emoji: '\u{1F9E9}',
    description: 'Mental exercise. Less tiring, still fun.',
    statEffects: { hunger: -5, happiness: 15, energy: -5 },
    staminaCost: 20,
    xpReward: 14,
    cooldownKey: 'play_puzzle',
  },
  {
    id: 'play_dance',
    action: 'play',
    label: 'Dance Party',
    emoji: '\u{1F57A}',
    description: 'High energy burst. Maximum joy!',
    statEffects: { hunger: -15, happiness: 30, energy: -25 },
    staminaCost: 30,
    xpReward: 16,
    cooldownKey: 'play_dance',
    unlockCondition: { type: 'level', value: 15 },
  },
  {
    id: 'play_vr',
    action: 'play',
    label: 'VR Adventure',
    emoji: '\u{1F3AE}',
    description: 'Diamond-exclusive virtual reality play.',
    statEffects: { hunger: -8, happiness: 35, energy: -10 },
    staminaCost: 25,
    xpReward: 22,
    cooldownKey: 'play_vr',
    unlockCondition: { type: 'premium', tierRequired: 'diamond' },
  },
];

export const REST_VARIANTS: CareVariant[] = [
  {
    id: 'rest_nap',
    action: 'rest',
    label: 'Quick Nap',
    emoji: '\u{1F634}',
    description: 'A short power nap. Light recovery.',
    statEffects: { hunger: 0, happiness: 5, energy: 25 },
    staminaCost: 10,
    xpReward: 5,
    cooldownKey: 'rest_nap',
  },
  {
    id: 'rest_hammock',
    action: 'rest',
    label: 'Hammock Chill',
    emoji: '\u{1F3DD}',
    description: 'Relaxing hammock under the trees.',
    statEffects: { hunger: 0, happiness: 12, energy: 20 },
    staminaCost: 10,
    xpReward: 8,
    cooldownKey: 'rest_hammock',
  },
  {
    id: 'rest_spa',
    action: 'rest',
    label: 'Spa Day',
    emoji: '\u{1F6C1}',
    description: 'Full restoration. Premium relaxation.',
    statEffects: { hunger: 5, happiness: 15, energy: 35 },
    staminaCost: 15,
    xpReward: 12,
    cooldownKey: 'rest_spa',
    unlockCondition: { type: 'premium', tierRequired: 'silver' },
  },
  {
    id: 'rest_cloud',
    action: 'rest',
    label: 'Cloud Nine',
    emoji: '\u2601\uFE0F',
    description: 'Legendary sleep on the clouds. Max recovery.',
    statEffects: { hunger: 10, happiness: 20, energy: 40 },
    staminaCost: 15,
    xpReward: 15,
    cooldownKey: 'rest_cloud',
    unlockCondition: { type: 'premium', tierRequired: 'diamond' },
  },
];

export const ALL_CARE_VARIANTS: CareVariant[] = [
  ...FEED_VARIANTS,
  ...PLAY_VARIANTS,
  ...REST_VARIANTS,
];

export function getVariantsForAction(action: CareAction): CareVariant[] {
  return ALL_CARE_VARIANTS.filter(v => v.action === action);
}
