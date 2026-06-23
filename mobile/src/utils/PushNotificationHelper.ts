import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export async function registerForPushNotificationsAsync() {
  let token = null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token: permission not granted.');
      return null;
    }
    
    try {
      // In newer Expo SDKs, you might need a projectId. If EAS isn't configured,
      // it might fail. We wrap it to prevent crashes in dev.
      const tokenResult = await Notifications.getExpoPushTokenAsync();
      token = tokenResult.data;
      console.log('Registered Expo Push Token:', token);
    } catch (e) {
      console.warn('Error fetching Expo Push Token (ignore if EAS is not configured):', e);
    }
  } else {
    console.log('Push notifications registration: Running on a simulator (must use physical device for actual tokens).');
  }

  return token;
}
