import AsyncStorage from '@react-native-async-storage/async-storage';

export const saveSession = async (user, token) => {
  try {
    await AsyncStorage.setItem('user_session', JSON.stringify({ user, token }));
  } catch (e) {
    console.warn('[Storage] Failed to save session:', e.message);
  }
};

export const getSession = async () => {
  try {
    const val = await AsyncStorage.getItem('user_session');
    return val ? JSON.parse(val) : null;
  } catch (e) {
    return null;
  }
};

export const removeSession = async () => {
  try {
    await AsyncStorage.removeItem('user_session');
    await AsyncStorage.removeItem('cached_orders');
  } catch (e) {
    console.warn('[Storage] Failed to remove session:', e.message);
  }
};

export const saveCachedOrders = async (orders) => {
  try {
    await AsyncStorage.setItem('cached_orders', JSON.stringify(orders));
  } catch (e) {
    console.warn('[Storage] Failed to cache orders:', e.message);
  }
};

export const getCachedOrders = async () => {
  try {
    const val = await AsyncStorage.getItem('cached_orders');
    return val ? JSON.parse(val) : [];
  } catch (e) {
    return [];
  }
};
