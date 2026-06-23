import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'teamsync_tasks_cache';

export async function cacheTasks(tasks: any[]) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error('Error caching tasks:', error);
  }
}

export async function getCachedTasks() {
  try {
    const data = await AsyncStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting cached tasks:', error);
    return [];
  }
}

export async function clearCachedTasks() {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error('Error clearing cached tasks:', error);
  }
}
