import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { usePetStore, type PetSkin } from '../store/petStore';

interface SkinOption {
  id: PetSkin;
  name: string;
  icon: string;
  locked: boolean;
}

const SKINS: SkinOption[] = [
  { id: 'default', name: 'Default', icon: '\u{1F43E}', locked: false },
  { id: 'headphones', name: 'Headphones', icon: '\u{1F3A7}', locked: false },
];

export function SkinSelector() {
  const { skin, setSkin } = usePetStore();

  return (
    <View className="px-5 mt-4">
      <Text className="text-xs font-semibold text-violet-400 tracking-wider mb-3">SKINS</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
      >
        {SKINS.map((skinOption) => {
          const isSelected = skin === skinOption.id;

          return (
            <TouchableOpacity
              key={skinOption.id}
              onPress={() => !skinOption.locked && setSkin(skinOption.id)}
              activeOpacity={0.7}
              disabled={skinOption.locked}
              className={`w-20 items-center py-3 px-2 rounded-2xl border-2 ${
                isSelected
                  ? 'bg-violet-100 border-violet-400'
                  : 'bg-white/70 border-transparent'
              } ${skinOption.locked ? 'opacity-50' : ''}`}
              style={{
                shadowColor: isSelected ? '#8b5cf6' : '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isSelected ? 0.15 : 0.05,
                shadowRadius: 6,
                elevation: isSelected ? 3 : 1,
              }}
            >
              <View className={`w-12 h-12 rounded-full items-center justify-center mb-2 ${
                isSelected ? 'bg-violet-200' : 'bg-violet-50'
              }`}>
                <Text className="text-2xl">{skinOption.icon}</Text>
              </View>
              <Text className={`text-xs font-medium text-center ${
                isSelected ? 'text-violet-600' : 'text-neutral-500'
              }`}>
                {skinOption.name}
              </Text>
              {skinOption.locked && (
                <Text className="text-[10px] text-neutral-400 mt-1">{'\u{1F512}'}</Text>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Coming Soon placeholder */}
        <View className="w-20 items-center py-3 px-2 rounded-2xl bg-white/40 border-2 border-dashed border-violet-200">
          <View className="w-12 h-12 bg-violet-50/50 rounded-full items-center justify-center mb-2">
            <Text className="text-2xl opacity-40">+</Text>
          </View>
          <Text className="text-xs font-medium text-violet-300 text-center">Soon</Text>
        </View>
      </ScrollView>
    </View>
  );
}
