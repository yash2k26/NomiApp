import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { HomeScreen } from '@/screens/HomeScreen';
import { MarketScreen } from '@/screens/MarketScreen';
import { ShopScreen } from '@/screens/ShopScreen';
import { PlayScreen } from '@/screens/PlayScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';

const Tab = createBottomTabNavigator();

interface TabIconProps {
  icon: string;
  label: string;
  focused: boolean;
}

function TabIcon({ icon, label, focused }: TabIconProps) {
  return (
    <View style={styles.tabIcon}>
      <Text style={[styles.tabEmoji, !focused && styles.tabEmojiInactive]}>{icon}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0A0A0A',
          borderTopColor: '#262626',
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 8,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🏠" label="Home" focused={focused} /> }}
      />
      <Tab.Screen
        name="Market"
        component={MarketScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="📦" label="Market" focused={focused} /> }}
      />
      <Tab.Screen
        name="Shop"
        component={ShopScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🛒" label="Shop" focused={focused} /> }}
      />
      <Tab.Screen
        name="Play"
        component={PlayScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🎮" label="Play" focused={focused} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="👤" label="Profile" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
    paddingTop: 8,
  },
  tabEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  tabEmojiInactive: {
    opacity: 0.5,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
});
