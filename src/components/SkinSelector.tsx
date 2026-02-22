import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { usePetStore, type PetSkin } from '../store/petStore';

interface SkinOption {
  id: PetSkin;
  name: string;
  icon: string;
  locked: boolean;
}

const SKINS: SkinOption[] = [
  { id: 'default', name: 'Default', icon: '🐾', locked: false },
  { id: 'headphones', name: 'Headphones', icon: '🎧', locked: false },
];

export function SkinSelector() {
  const { skin, setSkin } = usePetStore();

  return (
    <View className="px-5 mt-4">
      <Text className="text-xs font-semibold text-neutral-400 tracking-wider mb-3">SKINS</Text>
      
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
                  ? 'bg-violet-500/20 border-violet-500' 
                  : 'bg-neutral-800 border-transparent'
              } ${skinOption.locked ? 'opacity-50' : ''}`}
            >
              <View className="w-12 h-12 bg-neutral-700 rounded-full items-center justify-center mb-2">
                <Text className="text-2xl">{skinOption.icon}</Text>
              </View>
              <Text className={`text-xs font-medium text-center ${
                isSelected ? 'text-violet-400' : 'text-neutral-300'
              }`}>
                {skinOption.name}
              </Text>
              {skinOption.locked && (
                <Text className="text-[10px] text-neutral-500 mt-1">🔒</Text>
              )}
            </TouchableOpacity>
          );
        })}
        
        {/* Coming Soon placeholder */}
        <View className="w-20 items-center py-3 px-2 rounded-2xl bg-neutral-800/50 border-2 border-dashed border-neutral-700">
          <View className="w-12 h-12 bg-neutral-700/50 rounded-full items-center justify-center mb-2">
            <Text className="text-2xl opacity-50">+</Text>
          </View>
          <Text className="text-xs font-medium text-neutral-500 text-center">Soon</Text>
        </View>
      </ScrollView>
    </View>
  );
}
