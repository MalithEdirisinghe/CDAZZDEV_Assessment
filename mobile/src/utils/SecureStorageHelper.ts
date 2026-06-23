import * as SecureStore from 'expo-secure-store';

export async function saveTokens(accessToken: string, refreshToken: string) {
  try {
    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
  } catch (error) {
    console.error('Error saving tokens securely:', error);
  }
}

export async function getAccessToken() {
  try {
    return await SecureStore.getItemAsync('accessToken');
  } catch (error) {
    console.error('Error reading access token securely:', error);
    return null;
  }
}

export async function getRefreshToken() {
  try {
    return await SecureStore.getItemAsync('refreshToken');
  } catch (error) {
    console.error('Error reading refresh token securely:', error);
    return null;
  }
}

export async function clearTokens() {
  try {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
  } catch (error) {
    console.error('Error deleting secure tokens:', error);
  }
}
