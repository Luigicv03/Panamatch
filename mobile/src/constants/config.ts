// Configuración de la aplicación
const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000';

export const config = {
  apiUrl,
  socketUrl,
  
  // JWT
  tokenStorageKey: '@pana_match:access_token',
  refreshTokenStorageKey: '@pana_match:refresh_token',
  userStorageKey: '@pana_match:user',
  
  // Configuración de imágenes
  maxImageSize: 5 * 1024 * 1024, // 5MB
  imageQuality: 0.8,
  
  // Configuración de swipe
  swipeThreshold: 120,
  
  // Configuración de chat
  messagesPerPage: 20,
  
  // Configuración de perfiles
  minAge: 18,
  maxBioLength: 150,
} as const;

