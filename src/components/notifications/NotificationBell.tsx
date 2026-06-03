import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNotificationCenter, selectUnreadCount } from '../../store/notificationCenterStore';
import { NotificationCenterModal } from './NotificationCenterModal';
import { petTypography } from '../../theme/typography';

/*
 * Bell icon with unread badge. Tapping opens the notification center modal.
 * Drop in any header — sized for compact placement next to other badges.
 */

export function NotificationBell() {
  const unread = useNotificationCenter(selectUnreadCount);
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        accessibilityLabel={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.85)',
            borderWidth: 1,
            borderColor: 'rgba(167,215,230,0.7)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 17 }}>{'\u{1F514}'}</Text>
          {unread > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: -3,
                right: -3,
                minWidth: 17,
                height: 17,
                paddingHorizontal: 4,
                borderRadius: 9,
                backgroundColor: '#EF4444',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: '#FFFFFF',
              }}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 9,
                  fontFamily: petTypography.strong,
                }}
              >
                {unread > 99 ? '99+' : String(unread)}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>

      <NotificationCenterModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
