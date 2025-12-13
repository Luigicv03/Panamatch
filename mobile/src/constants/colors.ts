export const colors = {
  primary: '#E63946',
  primaryDark: '#D2333E',
  blue: '#1D3557',
  yellow: '#FFC857',
  
  white: '#FFFFFF',
  grayLight: '#F1F1F1',
  gray: '#CCCCCC',
  grayDark: '#666666',
  black: '#000000',
  
  success: '#4CAF50',
  error: '#E63946',
  warning: '#FFC857',
  info: '#1D3557',
  
  like: '#4CAF50',
  dislike: '#E63946',
  
  background: '#F1F1F1',
  backgroundDark: '#FFFFFF',
  
  gradientStart: '#003865',
  gradientMiddle: '#D2333E',
  gradientEnd: '#FCB606',
} as const;

export type ColorName = keyof typeof colors;

