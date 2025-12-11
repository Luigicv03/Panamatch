import { config } from '../constants/config';

/**
 * Construye la URL completa de una imagen desde una ruta relativa o absoluta.
 * Si la URL ya es absoluta (empieza con http:// o https://), la devuelve tal cual.
 * Si es relativa (empieza con /), la combina con config.apiUrl.
 * Si es null/undefined, devuelve null.
 * 
 * Soporta:
 * - URLs de Google Cloud Storage (https://storage.googleapis.com/...)
 * - URLs relativas del servidor (/uploads/...)
 * - URLs absolutas (http:// o https://)
 */
export const getImageUrl = (url: string | null | undefined): string | null => {
  if (!url) {
    return null;
  }

  // Si ya es una URL absoluta (http:// o https://), devolverla tal cual
  // Esto incluye URLs de Google Cloud Storage
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Si es una ruta relativa (empieza con /), construir la URL completa
  if (url.startsWith('/')) {
    // Remover la barra inicial si config.apiUrl ya termina con /
    const baseUrl = config.apiUrl.endsWith('/') 
      ? config.apiUrl.slice(0, -1) 
      : config.apiUrl;
    return `${baseUrl}${url}`;
  }

  // Si no empieza con /, asumir que es relativa y agregar /uploads/avatars/ por defecto
  // (esto es para compatibilidad con URLs antiguas que no tienen el prefijo)
  const baseUrl = config.apiUrl.endsWith('/') 
    ? config.apiUrl.slice(0, -1) 
    : config.apiUrl;
  return `${baseUrl}/uploads/avatars/${url}`;
};

/**
 * Obtiene la URL de un avatar, con fallback a placeholder
 */
export const getAvatarUrl = (avatarUrl: string | null | undefined): string => {
  const url = getImageUrl(avatarUrl);
  return url || 'https://via.placeholder.com/150';
};

