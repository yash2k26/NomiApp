import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNotificationCenter, type AppNotification, type NotificationSeverity } from '../../store/notificationCenterStore';
import { petTypography } from '../../theme/typography';

/*
 * Notification center — full list of toasts the user has received, newest
 * first. Marks all read on open. Tap row to expand details (tx signatures,
 * amounts, etc.). Long-press to remove a single entry. Clear-all in header.
 *
 * No external links — every detail is shown in-place. The user shouldn't
 * need to leave the app to understand what happened.
 */

const SEVERITY_DOT: Record<NotificationSeverity, string> = {
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3E8AB3',
};

interface NotificationCenterModalProps {
  visible: boolean;
  onClose: () => void;
}

export function NotificationCenterModal({ visible, onClose }: NotificationCenterModalProps) {
  const notifications = useNotificationCenter((s) => s.notifications);
  const markAllRead = useNotificationCenter((s) => s.markAllRead);
  const remove = useNotificationCenter((s) => s.remove);
  const clearAll = useNotificationCenter((s) => s.clearAll);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      // Slight delay so the user sees the unread state for a beat before it
      // collapses. Avoids the "I never saw the badge update" feeling.
      const t = setTimeout(() => markAllRead(), 250);
      return () => clearTimeout(t);
    }
    setExpanded(new Set());
    return undefined;
  }, [visible, markAllRead]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1 }} />
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight: '82%',
            minHeight: 320,
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.12,
            shadowRadius: 20,
            elevation: 16,
          }}
        >
          <LinearGradient
            colors={['#4FABC9', '#3E8AB3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 20,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View>
              <Text style={{ color: '#FFFFFF', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', fontFamily: petTypography.strong }}>
                Activity
              </Text>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontFamily: petTypography.display, marginTop: 1 }}>
                Notifications
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.85}>
              <View style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)' }}>
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontFamily: petTypography.strong, letterSpacing: 0.6 }}>Close</Text>
              </View>
            </TouchableOpacity>
          </LinearGradient>

          {notifications.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 60 }}>
              <Text style={{ fontSize: 42, marginBottom: 12 }}>{'\u{1F4EA}'}</Text>
              <Text style={{ fontSize: 14, fontFamily: petTypography.strong, color: '#374151', marginBottom: 4 }}>
                Nothing here yet
              </Text>
              <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', fontFamily: petTypography.body, lineHeight: 17 }}>
                Notifications about purchases, rewards, and pet activity will appear here.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingVertical: 6 }}>
              {notifications.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  expanded={expanded.has(n.id)}
                  onToggle={() => toggleExpanded(n.id)}
                  onRemove={() => remove(n.id)}
                />
              ))}
              {notifications.length > 1 ? (
                <TouchableOpacity onPress={clearAll} activeOpacity={0.7} style={{ alignItems: 'center', paddingVertical: 18 }}>
                  <Text style={{ fontSize: 11, color: '#9CA3AF', fontFamily: petTypography.body }}>
                    Clear all
                  </Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function NotificationRow({
  notification,
  expanded,
  onToggle,
  onRemove,
}: {
  notification: AppNotification;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const dot = SEVERITY_DOT[notification.severity];
  const ageStr = formatAge(Date.now() - notification.createdAt);
  const hasDetails = (notification.details?.length ?? 0) > 0;

  return (
    <TouchableOpacity onPress={hasDetails ? onToggle : undefined} onLongPress={onRemove} activeOpacity={hasDetails ? 0.7 : 1}>
      <View
        style={{
          paddingHorizontal: 18,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'flex-start',
          borderBottomWidth: 1,
          borderBottomColor: '#F3F4F6',
          backgroundColor: notification.read ? '#FFFFFF' : '#F8FAFC',
        }}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot, marginTop: 6, marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text
              style={{ flex: 1, fontSize: 13, fontFamily: petTypography.strong, color: '#1F2937' }}
              numberOfLines={1}
            >
              {notification.title}
            </Text>
            <Text style={{ fontSize: 10, color: '#9CA3AF', fontFamily: petTypography.body, marginLeft: 8 }}>
              {ageStr}
            </Text>
          </View>
          {notification.body ? (
            <Text style={{ fontSize: 11.5, color: '#6B7280', fontFamily: petTypography.body, lineHeight: 16, marginTop: 3 }}>
              {notification.body}
            </Text>
          ) : null}
          {expanded && notification.details ? (
            <View
              style={{
                marginTop: 10,
                backgroundColor: '#F9FAFB',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: '#F3F4F6',
              }}
            >
              {notification.details.map((row, idx) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontSize: 10.5, color: '#9CA3AF', fontFamily: petTypography.body, letterSpacing: 0.4 }}>
                    {row.label}
                  </Text>
                  <Text
                    style={{ fontSize: 10.5, color: '#374151', fontFamily: petTypography.strong, marginLeft: 12, flexShrink: 1, textAlign: 'right' }}
                    numberOfLines={1}
                  >
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {hasDetails && !expanded ? (
            <Text style={{ fontSize: 10, color: '#9CA3AF', fontFamily: petTypography.body, marginTop: 4 }}>
              Tap for details
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function formatAge(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(Date.now() - ms).toLocaleDateString();
}
