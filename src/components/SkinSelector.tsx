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
    <View className="px-6">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingRight: 24 }}
      >
        {SKINS.map((skinOption) => {
          const isSelected = skin === skinOption.id;

          return (
            <TouchableOpacity
              key={skinOption.id}
              onPress={() => !skinOption.locked && setSkin(skinOption.id)}
              activeOpacity={0.8}
              disabled={skinOption.locked}
              className={`w-24 items-center py-4 px-2 rounded-3xl border-2 ${isSelected
                  ? 'bg-pet-blue-light/20 border-pet-blue border-b-4'
                  : 'bg-white border-gray-100 border-b-4'
                } ${skinOption.locked ? 'opacity-50' : ''}`}
              style={{
                shadowColor: isSelected ? '#4FB0C6' : '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isSelected ? 0.2 : 0.05,
                shadowRadius: 8,
                elevation: isSelected ? 4 : 2,
              }}
            >
              <View className={`w-14 h-14 rounded-2xl items-center justify-center mb-2 ${isSelected ? 'bg-pet-blue' : 'bg-gray-50'
                }`}>
                <Text className="text-3xl">{skinOption.icon}</Text>
              </View>
              <Text className={`text-[11px] font-black uppercase tracking-tighter text-center ${isSelected ? 'text-pet-blue-dark' : 'text-gray-400'
                }`}>
                {skinOption.name}
              </Text>
              {skinOption.locked && (
                <Text className="text-xs text-neutral-400 mt-1">{'\u{1F512}'}</Text>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Coming Soon placeholder */}
        <View className="w-24 items-center justify-center py-4 px-2 rounded-3xl bg-gray-50/50 border-2 border-dashed border-gray-200">
          <View className="w-14 h-14 bg-white rounded-2xl items-center justify-center mb-2 border border-gray-100">
            <Text className="text-2xl text-gray-300">+</Text>
          </View>
          <Text className="text-[10px] font-black text-gray-300 uppercase letter-spacing-widest text-center">Locked</Text>
        </View>
      </ScrollView>
    </View>
  );
}

