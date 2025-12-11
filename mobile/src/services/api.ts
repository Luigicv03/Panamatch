import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../constants/config';

// Crear instancia de Axios
const api = axios.create({
  baseURL: config.apiUrl,
  timeout: 30000, // 30 segundos por defecto
  headers: {
    'Content-Type': 'application/json',
  },
});

// Función helper para detectar FormData de forma más robusta
const isFormData = (data: any): boolean => {
  return (
    (typeof FormData !== 'undefined' && data instanceof FormData) ||
    (data && typeof data === 'object' && data.constructor && data.constructor.name === 'FormData') ||
    (data && typeof data === 'object' && 'append' in data && typeof data.append === 'function')
  );
};

// Interceptor para agregar token a las peticiones
api.interceptors.request.use(
  async (requestConfig) => {
    const token = await AsyncStorage.getItem(config.tokenStorageKey);
    if (token) {
      requestConfig.headers.Authorization = `Bearer ${token}`;
    }
    
    // Si es FormData, NO establecer Content-Type (Axios lo hará automáticamente)
    if (isFormData(requestConfig.data)) {
      // Eliminar Content-Type si existe para que Axios lo establezca con el boundary correcto
      delete requestConfig.headers['Content-Type'];
      // También eliminar del header común
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

// Interceptor para manejar errores y refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si el error es 401 y no hemos intentado refrescar el token
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

          // Reintentar la petición original
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Si falla el refresh, limpiar tokens y redirigir a login
        await AsyncStorage.multiRemove([
          config.tokenStorageKey,
          config.refreshTokenStorageKey,
          config.userStorageKey,
        ]);
        // Aquí puedes agregar lógica para redirigir a login
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

