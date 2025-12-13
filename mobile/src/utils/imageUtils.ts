import { config } from '../constants/config';

export const getImageUrl = (url: string | null | undefined): string | null => {
  if (!url) {
    return null;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  if (url.startsWith('/')) {
    const baseUrl = config.apiUrl.endsWith('/') 
      ? config.apiUrl.slice(0, -1) 
      : config.apiUrl;
    return `${baseUrl}${url}`;
  }

  const baseUrl = config.apiUrl.endsWith('/') 
    ? config.apiUrl.slice(0, -1) 
    : config.apiUrl;
  return `${baseUrl}/uploads/avatars/${url}`;
};

export const getAvatarUrl = (avatarUrl: string | null | undefined): string => {
  const url = getImageUrl(avatarUrl);
  return url || 'https://via.placeholder.com/150';
};

