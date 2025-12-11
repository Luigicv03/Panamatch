import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Profile } from '../types';
import { config } from '../constants/config';
import socketService from '../services/socketService';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  login: (accessToken: string, refreshToken: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setProfile: (profile) => set({ profile }),

  login: async (accessToken, refreshToken, user) => {
    try {
      // Validar que todos los valores sean válidos
      if (!accessToken || !refreshToken || !user) {
        console.error('Error: Valores faltantes en login', { accessToken: !!accessToken, refreshToken: !!refreshToken, user: !!user });
        throw new Error('Faltan datos necesarios para el login');
      }

      // Validar que las claves de configuración existan
      const tokenKey = config.tokenStorageKey || '@pana_match:access_token';
      const refreshKey = config.refreshTokenStorageKey || '@pana_match:refresh_token';
      const userKey = config.userStorageKey || '@pana_match:user';

      // Guardar en AsyncStorage (por separado para evitar problemas con null)
      await AsyncStorage.setItem(tokenKey, String(accessToken));
      await AsyncStorage.setItem(refreshKey, String(refreshToken));
      await AsyncStorage.setItem(userKey, JSON.stringify(user));
      
      set({ user, isAuthenticated: true, profile: user.profile || null });
      
      // Reconectar socket con el nuevo token
      try {
        await socketService.reconnect();
      } catch (socketError) {
        console.error('Error al reconectar socket después de login:', socketError);
        // No lanzar error, solo loguear
      }
    } catch (error) {
      console.error('Error al guardar datos de autenticación:', error);
      throw error;
    }
  },

  logout: async () => {
    try {
      // Desconectar socket primero
      socketService.disconnect();
      
      // Validar que las claves existan antes de usarlas
      const tokenKey = config.tokenStorageKey || '@pana_match:access_token';
      const refreshKey = config.refreshTokenStorageKey || '@pana_match:refresh_token';
      const userKey = config.userStorageKey || '@pana_match:user';

      await AsyncStorage.multiRemove([
        tokenKey,
        refreshKey,
        userKey,
      ]);
      set({ user: null, profile: null, isAuthenticated: false });
    } catch (error) {
      console.error('Error en logout:', error);
      set({ user: null, profile: null, isAuthenticated: false });
    }
  },

  checkAuth: async () => {
    try {
      // Validar que las claves existan antes de usarlas
      const tokenKey = config.tokenStorageKey || '@pana_match:access_token';
      const userKey = config.userStorageKey || '@pana_match:user';

      const [token, userString] = await AsyncStorage.multiGet([
        tokenKey,
        userKey,
      ]);

      if (token[1] && userString[1]) {
        const user = JSON.parse(userString[1]);
        set({ user, isAuthenticated: true, profile: user.profile || null, isLoading: false });
      } else {
        set({ isAuthenticated: false, isLoading: false });
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      set({ isAuthenticated: false, isLoading: false });
    }
  },
}));

