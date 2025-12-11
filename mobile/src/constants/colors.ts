// Colores del tema visual venezolano
export const colors = {
  // Colores principales
  primary: '#E63946', // Rojo coral
  primaryDark: '#D2333E',
  blue: '#1D3557', // Azul
  yellow: '#FFC857', // Amarillo suave
  
  // Colores neutros
  white: '#FFFFFF',
  grayLight: '#F1F1F1',
  gray: '#CCCCCC',
  grayDark: '#666666',
  black: '#000000',
  
  // Colores de estado
  success: '#4CAF50',
  error: '#E63946',
  warning: '#FFC857',
  info: '#1D3557',
  
  // Colores para swipe
  like: '#4CAF50',
  dislike: '#E63946',
  
  // Colores de fondo
  background: '#F1F1F1',
  backgroundDark: '#FFFFFF',
  
  // Gradientes
  gradientStart: '#003865', // Azul petróleo
  gradientMiddle: '#D2333E', // Rojo
  gradientEnd: '#FCB606', // Amarillo
} as const;

export type ColorName = keyof typeof colors;

