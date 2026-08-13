import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

let configured = false;
let permissionGranted = false;

/**
 * Configure OS notifications once. The web build intentionally keeps using its
 * existing in-app notification panel and browser service worker.
 */
export async function configureNativeNotifications() {
  if (Platform.OS === 'web') return false;
  if (configured) return permissionGranted;
  configured = true;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
      }),
    });

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    permissionGranted = status === 'granted';

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('genie-updates', {
        name: 'Genie updates',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: '#9C2007',
      });
    }
  } catch (error) {
    configured = false;
    permissionGranted = false;
    console.warn('[Notifications] Native permission setup failed:', error?.message || error);
  }

  return permissionGranted;
}

export async function presentNativeNotification(notification) {
  if (Platform.OS === 'web') return false;
  try {
    const allowed = await configureNativeNotifications();
    if (!allowed) return false;
    const level = String(notification?.LEVEL || notification?.type || 'INFO').toUpperCase();
    const title = level === 'CRITICAL' ? 'Genie critical alert' : `Genie ${level.toLowerCase()}`;
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: String(notification?.MESSAGE || notification?.message || 'New Genie notification'),
        data: { notifId: notification?.NOTIF_ID || notification?.id || '' },
      },
      trigger: null,
    });
    return true;
  } catch (error) {
    console.warn('[Notifications] Present failed:', error?.message || error);
    return false;
  }
}
