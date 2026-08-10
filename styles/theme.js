import { Platform } from 'react-native';

export const COLORS = {
  primary: '#9C2007',        // Primary Crimson Red from GENIE_WEB
  primaryActive: '#7a1805',
  secondary: '#1e3a5f',      // Navy Blue
  accent: '#ea580c',         // OTP Orange
  goldBorder: '#e8c98a',     // Card tray border
  background: '#f8fafc',     // bg-gray-100
  cardBg: '#ffffff',
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  textLabel: '#475569',
  border: '#cbd5e1',
  error: '#dc2626',
  white: '#ffffff',
  darkBg: '#090d16',
  darkCard: '#0f172a',
  darkBorder: '#1e293b',
};

export const FONTS = {
  // Web font asset imported via inter-font.css in GENIE_WEB
  comfortaa: Platform.OS === 'web' ? 'Comfortaa, sans-serif' : 'Comfortaa_600SemiBold',
  comfortaaBold: Platform.OS === 'web' ? 'Comfortaa, sans-serif' : 'Comfortaa_700Bold',
  
  // Secondary Inter font family
  body: Platform.OS === 'web' ? 'Inter, sans-serif' : 'Inter_400Regular',
  medium: Platform.OS === 'web' ? 'Inter, sans-serif' : 'Inter_500Medium',
  semiBold: Platform.OS === 'web' ? 'Inter, sans-serif' : 'Inter_600SemiBold',
  bold: Platform.OS === 'web' ? 'Inter, sans-serif' : 'Inter_700Bold',
  extraBold: Platform.OS === 'web' ? 'Inter, sans-serif' : 'Inter_800ExtraBold',
  
  // Logo font family from genie-logo.svg
  logo: Platform.OS === 'web' ? 'Montserrat, sans-serif' : 'Montserrat_900Black',
};
