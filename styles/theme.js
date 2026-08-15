import { Platform } from 'react-native';

// ── Design tokens ──────────────────────────────────────────────────────────
// Mirrors the GENIE_WEB global stylesheet (assets/css/style.css) scale:
// spacing follows Tailwind's rem-based scale, radii match the button/input
// system, and shadows mirror the Tailwind shadow-sm/md used on web cards.

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const RADIUS = {
  sm: 6,   // web .btn / .form-input (0.375rem)
  md: 8,   // native cards historically used 8-10
  lg: 12,  // web rounded-lg (0.5rem)
  xl: 16,  // web rounded-xl (0.75rem)
  pill: 999,
};

export const FONT_SIZE = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const SHADOW = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.08,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

export const COLORS = {
  primary: '#9C2007',        // Primary Crimson Red from GENIE_WEB
  primaryActive: '#7a1805',
  secondary: '#1e3a5f',      // Navy Blue
  accent: '#ea580c',         // OTP Orange
  goldBorder: '#e8c98a',     // Card tray border (legacy)
  violetBorder: '#8b5cf6',   // Violet sparkling tray border
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
