import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotificationCenter, type NotificationSeverity, type AppNotification } from '../../store/notificationCenterStore';
import { petTypography } from '../../theme/typography';
import { getSolscanTxUrl } from '../../lib/solanaClient';

/*
 * Renders the currently-active toast (singleton). Subscribes to
 * notificationCenterStore.activeToastId. Auto-advances to the next queued
 * toast when this one dismisses. Tap to dismiss early.
 *
 * Anchored at the top of the screen below the safe area inset — keeps it
 * out of the way of the tab bar and any modal interactions.
 */

const VISIBLE_MS_BY_SEVERITY: Record<NotificationSeverity, number> = {
  success: 3500,
  info: 3500,
  warning: 5000,
  error: 6000,
};

const SEVERITY_STYLES: Record<NotificationSeverity, { dot: string; bg: string; border: string; text: string; iconBg: string }> = {
  success: {
    dot: '#10B981',
    bg: '#FFFFFF',
    border: '#A7F3D0',
    text: '#065F46',
    iconBg: '#ECFDF5',
  },
  error: {
    dot: '#EF4444',
    bg: '#FFFFFF',
    border: '#FCA5A5',
    text: '#991B1B',
    iconBg: '#FEF2F2',
  },
  warning: {
    dot: '#F59E0B',
    bg: '#FFFFFF',
    border: '#FCD34D',
    text: '#92400E',
    iconBg: '#FFFBEB',
  },
  info: {
    dot: '#3E8AB3',
    bg: '#FFFFFF',
    border: '#A7D7E6',
    text: '#1F4F6E',
    iconBg: '#EAF6FB',
  },
};

const SEVERITY_GLYPHS: Record<NotificationSeverity, string> = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
};

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const activeId = useNotificationCenter((s) => s.activeToastId);
  const dismiss = useNotificationCenter((s) => s.dismissActiveToast);
  const notification = useNotificationCenter((s) =>
    activeId ? s.notifications.find((n) => n.id === activeId) ?? null : null,
  );

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitingRef = useRef(false);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!notification) return;

    exitingRef.current = false;
    opacity.setValue(0);
    translateY.setValue(-16);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    const dwell = VISIBLE_MS_BY_SEVERITY[notification.severity];
    timerRef.current = setTimeout(() => triggerDismiss(), dwell);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification?.id]);

  const triggerDismiss = () => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -16, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) dismiss();
    });
  };

  if (!notification) return null;

  const styles = SEVERITY_STYLES[notification.severity];

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 16,
        right: 16,
        opacity,
        transform: [{ translateY }],
        zIndex: 9999,
      }}
    >
      <ToastCard notification={notification} styles={styles} onDismiss={triggerDismiss} />
    </Animated.View>
  );
}

function ToastCard({
  notification,
  styles,
  onDismiss,
}: {
  notification: AppNotification;
  styles: typeof SEVERITY_STYLES[NotificationSeverity];
  onDismiss: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onDismiss}>
      <View
        style={{
          backgroundColor: styles.bg,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'flex-start',
          borderWidth: 1,
          borderColor: styles.border,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 18,
          elevation: 10,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: styles.iconBg,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
            marginTop: 1,
          }}
        >
          <Text style={{ color: styles.dot, fontSize: 12, fontWeight: '900' }}>
            {SEVERITY_GLYPHS[notification.severity]}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: styles.text,
              fontSize: 13,
              fontFamily: petTypography.strong,
              lineHeight: 17,
            }}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          {notification.body ? (
            <Text
              style={{
                color: '#4B5563',
                fontSize: 11.5,
                fontFamily: petTypography.body,
                lineHeight: 15,
                marginTop: 2,
              }}
              numberOfLines={2}
            >
              {notification.body}
            </Text>
          ) : null}
          {notification.solscanTxSignature ? (
            <TouchableOpacity
              onPress={(e) => {
                // Stop the parent TouchableOpacity from dismissing the toast
                // before we open the link.
                e.stopPropagation?.();
                Linking.openURL(getSolscanTxUrl(notification.solscanTxSignature!)).catch(() => {});
              }}
              style={{ marginTop: 4 }}
            >
              <Text
                style={{
                  color: '#3792A6',
                  fontSize: 11,
                  fontFamily: petTypography.strong,
                  textDecorationLine: 'underline',
                }}
              >
                View on Solscan ↗
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}
