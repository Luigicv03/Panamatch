const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000';

export const config = {
  apiUrl,
  socketUrl,
  
  tokenStorageKey: '@pana_match:access_token',
  refreshTokenStorageKey: '@pana_match:refresh_token',
  userStorageKey: '@pana_match:user',
  maxImageSize: 5 * 1024 * 1024,
  imageQuality: 0.8,
  swipeThreshold: 120,
  messagesPerPage: 20,
  minAge: 18,
  maxBioLength: 150,
} as const;

