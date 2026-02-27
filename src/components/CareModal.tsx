import { View, Text, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { usePetStore } from '../store/petStore';
import { useXpStore } from '../store/xpStore';
import { getCurrentTier, isAtLeastTier, type PremiumTier } from '../store/premiumStore';
import { getVariantsForAction, type CareAction, type CareVariant } from '../data/careVariants';
import { TIER_CONFIGS } from '../data/premiumTiers';

interface CareModalProps {
  visible: boolean;
  action: CareAction;
  onClose: () => void;
  onActionComplete: (xpAmount: number) => void;
}

const MODAL_HEADERS: Record<CareAction, { title: string; subtitle: string; emoji: string; gradient: [string, string] }> = {
  feed: { title: 'What should Nomi eat?', subtitle: 'Pick a meal for your companion', emoji: '\u{1F355}', gradient: ['#F97316', '#EA580C'] },
  play: { title: 'How should Nomi play?', subtitle: 'Choose an activity together', emoji: '\u{1F3AE}', gradient: ['#EC4899', '#DB2777'] },
  rest: { title: 'Where should Nomi sleep?', subtitle: 'Find the perfect spot', emoji: '\u{1F634}', gradient: ['#22C55E', '#16A34A'] },
};

const STAT_CONFIG = {
  hunger: { emoji: '\u{1F356}', label: 'Hunger', color: '#F97316' },
  happiness: { emoji: '\u{1F496}', label: 'Happy', color: '#EC4899' },
  energy: { emoji: '\u26A1', label: 'Energy', color: '#22C55E' },
} as const;

function getVariantLockState(variant: CareVariant): { locked: boolean; reason?: string } {
  if (!variant.unlockCondition || variant.unlockCondition.type === 'none') {
    return { locked: false };
  }
  if (variant.unlockCondition.type === 'level') {
    const level = useXpStore.getState().level;
    if (level < (variant.unlockCondition.value ?? 0)) {
      return { locked: true, reason: `Requires Level ${variant.unlockCondition.value}` };
    }
  }
  if (variant.unlockCondition.type === 'premium') {
    const currentTier = getCurrentTier();
    const required = variant.unlockCondition.tierRequired!;
    if (!isAtLeastTier(currentTier, required)) {
      return { locked: true, reason: `${TIER_CONFIGS[required].label}+ Only` };
    }
  }
  return { locked: false };
}

interface VariantCardProps {
  variant: CareVariant;
  onPress: () => void;
  isOnCooldown: boolean;
  cooldownRemaining: number;
}

function formatCooldown(ms: number): string {
  if (ms <= 0) return '';
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return `${min}:${sec.toString().padStart(2, '0')}`;
  return `${sec}s`;
}

function VariantCard({ variant, onPress, isOnCooldown, cooldownRemaining }: VariantCardProps) {
  const { locked, reason } = getVariantLockState(variant);
  const isDisabled = locked || isOnCooldown;
  const fx = variant.statEffects;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={isDisabled}
      className="mb-3"
    >
      <View
        className="bg-white rounded-3xl p-4 flex-row items-center border border-gray-100"
        style={{
          opacity: isDisabled ? 0.5 : 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
          elevation: 2,
        }}
      >
        {/* Emoji icon */}
        <View className="w-14 h-14 bg-gray-50 rounded-2xl items-center justify-center mr-3 border border-gray-100">
          <Text className="text-3xl">{variant.emoji}</Text>
        </View>

        {/* Content */}
        <View className="flex-1">
          <Text className="text-[14px] font-black text-gray-800 mb-0.5">{variant.label}</Text>
          <Text className="text-[11px] text-gray-400 font-semibold mb-2">{variant.description}</Text>

          {/* Stat chips */}
          <View className="flex-row flex-wrap gap-1.5">
            {(Object.entries(fx) as [keyof typeof STAT_CONFIG, number][]).map(([stat, val]) => {
              if (val === 0) return null;
              const cfg = STAT_CONFIG[stat];
              const positive = val > 0;
              return (
                <View
                  key={stat}
                  className="flex-row items-center px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: positive ? `${cfg.color}15` : '#FEE2E215' }}
                >
                  <Text className="text-[10px]">{cfg.emoji}</Text>
                  <Text
                    className="text-[10px] font-bold ml-0.5"
                    style={{ color: positive ? cfg.color : '#EF4444' }}
                  >
                    {positive ? '+' : ''}{val}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Right side — stamina + XP */}
        <View className="items-end ml-2">
          {isOnCooldown ? (
            <View className="bg-gray-100 px-2.5 py-1 rounded-full">
              <Text className="text-[10px] font-black text-gray-500">{formatCooldown(cooldownRemaining)}</Text>
            </View>
          ) : locked ? (
            <View className="items-center">
              <Text className="text-[14px]">{'\u{1F512}'}</Text>
              <Text className="text-[8px] font-bold text-gray-400 mt-0.5 text-center" style={{ maxWidth: 60 }}>
                {reason}
              </Text>
            </View>
          ) : (
            <>
              <View className="flex-row items-center mb-1">
                <Text className="text-[9px]">{'\u{1F50B}'}</Text>
                <Text className="text-[10px] font-bold text-gray-500 ml-0.5">{variant.staminaCost}</Text>
              </View>
              <View className="bg-purple-50 px-2 py-0.5 rounded-full">
                <Text className="text-[9px] font-black text-purple-600">+{variant.xpReward} XP</Text>
              </View>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function CareModal({ visible, action, onClose, onActionComplete }: CareModalProps) {
  const performCareAction = usePetStore((s) => s.performCareAction);
  const isOnCooldown = usePetStore((s) => s.isOnCooldown);
  const getCooldownRemaining = usePetStore((s) => s.getCooldownRemaining);
  const header = MODAL_HEADERS[action];
  const variants = getVariantsForAction(action);

  const handlePickVariant = (variant: CareVariant) => {
    const success = performCareAction(variant.id);
    if (success) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onActionComplete(variant.xpReward);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/40 justify-end"
        onPress={onClose}
      >
        <Pressable
          className="bg-gray-50 rounded-t-[40px] px-6 pt-5 pb-10"
          onPress={(e) => e.stopPropagation()}
          style={{ maxHeight: '80%' }}
        >
          {/* Handle */}
          <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center mb-6" />

          {/* Header */}
          <View className="items-center mb-6">
            <LinearGradient
              colors={header.gradient}
              className="w-16 h-16 rounded-2xl items-center justify-center mb-3"
            >
              <Text className="text-3xl">{header.emoji}</Text>
            </LinearGradient>
            <Text className="text-xl font-black text-gray-800">{header.title}</Text>
            <Text className="text-[12px] font-semibold text-gray-400 mt-1">{header.subtitle}</Text>
          </View>

          {/* Variant cards */}
          <ScrollView showsVerticalScrollIndicator={false} className="mb-2">
            {variants.map((variant) => (
              <VariantCard
                key={variant.id}
                variant={variant}
                onPress={() => handlePickVariant(variant)}
                isOnCooldown={isOnCooldown(variant.cooldownKey)}
                cooldownRemaining={getCooldownRemaining(variant.cooldownKey)}
              />
            ))}
          </ScrollView>

          {/* Cancel */}
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.8}
            className="py-4 bg-white rounded-2xl border border-gray-100"
          >
            <Text className="text-gray-400 text-center font-black uppercase tracking-widest text-[12px]">Maybe Later</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
