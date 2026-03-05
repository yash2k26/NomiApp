import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const NOTIFICATION_STORAGE_KEY = 'oracle-pet-notifications';

// ── Configure notification handler ──
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Notification message pools ──

const RETURN_MESSAGES_4HR = [
  { title: 'Nomi misses you!', body: "Nomi is looking at the door, waiting for you..." },
  { title: 'Where are you?', body: "Nomi has been staring at the sky, hoping you'll come back." },
  { title: 'Come back!', body: "Nomi tried to call you but remembered pets can't use phones." },
];

const RETURN_MESSAGES_8HR = [
  { title: "Nomi is worried...", body: "It's been a while... Nomi wrote something in the diary." },
  { title: "Don't forget Nomi!", body: "Nomi hasn't eaten in hours. Come check on your pet!" },
  { title: 'Nomi needs you', body: "Your pet is getting lonely. A quick visit would mean the world!" },
];

const DAILY_MESSAGES = [
  { title: 'Good morning!', body: "New quests are ready! Nomi has a surprise for you." },
  { title: 'Rise and shine!', body: "Nomi is already up and waiting. Daily rewards inside!" },
  { title: 'A new day begins!', body: "Nomi dreamed about you. Come say hi!" },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Types ──

interface NotificationState {
  enabled: boolean;
  permissionGranted: boolean;
  lastScheduledAt: number;
}

interface NotificationActions {
  requestPermission: () => Promise<boolean>;
  scheduleReturnNotifications: () => Promise<void>;
  scheduleAdventureComplete: (endsAt: number, zoneName: string) => Promise<void>;
  cancelAll: () => Promise<void>;
  setEnabled: (enabled: boolean) => void;
  hydrateNotifications: () => Promise<void>;
}

type NotificationStore = NotificationState & NotificationActions;

function saveNotificationState(state: NotificationState) {
  AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify({
    enabled: state.enabled,
    permissionGranted: state.permissionGranted,
  })).catch(() => {});
}

// ── Store ──

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  enabled: true,
  permissionGranted: false,
  lastScheduledAt: 0,

  requestPermission: async () => {
    try {
      if (Platform.OS === 'web') return false;

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      const granted = finalStatus === 'granted';
      set({ permissionGranted: granted });
      saveNotificationState(get());

      if (granted && Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Nomi',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      return granted;
    } catch {
      return false;
    }
  },

  scheduleReturnNotifications: async () => {
    const state = get();
    if (!state.enabled || !state.permissionGranted) return;

    // Cancel existing return notifications before scheduling new ones
    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = Date.now();
    set({ lastScheduledAt: now });

    // 4-hour reminder
    const msg4hr = pick(RETURN_MESSAGES_4HR);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: msg4hr.title,
        body: msg4hr.body,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 4 * 60 * 60,
      },
    });

    // 8-hour reminder
    const msg8hr = pick(RETURN_MESSAGES_8HR);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: msg8hr.title,
        body: msg8hr.body,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 8 * 60 * 60,
      },
    });

    // Daily morning reminder (next day at 9am)
    const msgDaily = pick(DAILY_MESSAGES);
    const tomorrow9am = new Date();
    tomorrow9am.setDate(tomorrow9am.getDate() + 1);
    tomorrow9am.setHours(9, 0, 0, 0);
    const secondsUntil9am = Math.max(60, Math.floor((tomorrow9am.getTime() - now) / 1000));

    await Notifications.scheduleNotificationAsync({
      content: {
        title: msgDaily.title,
        body: msgDaily.body,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntil9am,
      },
    });
  },

  scheduleAdventureComplete: async (endsAt: number, zoneName: string) => {
    const state = get();
    if (!state.enabled || !state.permissionGranted) return;

    const secondsUntil = Math.max(60, Math.floor((endsAt - Date.now()) / 1000));

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Adventure Complete!',
        body: `Nomi is back from ${zoneName} with loot! Come see what they found.`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntil,
      },
    });
  },

  cancelAll: async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  setEnabled: (enabled: boolean) => {
    set({ enabled });
    saveNotificationState(get());
    if (!enabled) {
      Notifications.cancelAllScheduledNotificationsAsync();
    }
  },

  hydrateNotifications: async () => {
    try {
      const raw = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({
          enabled: data.enabled ?? true,
          permissionGranted: data.permissionGranted ?? false,
        });
      }

      // Check current permission status
      if (Platform.OS !== 'web') {
        const { status } = await Notifications.getPermissionsAsync();
        set({ permissionGranted: status === 'granted' });
      }
    } catch {}
  },
}));
