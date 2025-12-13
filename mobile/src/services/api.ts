import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../constants/config';

const api = axios.create({
  baseURL: config.apiUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const isFormData = (data: any): boolean => {
  return (
    (typeof FormData !== 'undefined' && data instanceof FormData) ||
    (data && typeof data === 'object' && data.constructor && data.constructor.name === 'FormData') ||
    (data && typeof data === 'object' && 'append' in data && typeof data.append === 'function')
  );
};

api.interceptors.request.use(
  async (requestConfig) => {
    const token = await AsyncStorage.getItem(config.tokenStorageKey);
    if (token) {
      requestConfig.headers.Authorization = `Bearer ${token}`;
    }
    
    if (isFormData(requestConfig.data)) {
      delete requestConfig.headers['Content-Type'];
      if (requestConfig.headers.common) {
        delete requestConfig.headers.common['Content-Type'];
      }
    }
    
    return requestConfig;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem(config.refreshTokenStorageKey);
        if (refreshToken) {
          const response = await axios.post(`${config.apiUrl}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken } = response.data;
          await AsyncStorage.setItem(config.tokenStorageKey, accessToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        await AsyncStorage.multiRemove([
          config.tokenStorageKey,
          config.refreshTokenStorageKey,
          config.userStorageKey,
        ]);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

