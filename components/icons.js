// components/icons.js — Centralized icon system
// One registry maps semantic names to FontAwesome6 glyphs, mirroring the web
// app's Font Awesome icon vocabulary. Screens import { Icon, GradientIcon } from
// '../components/icons' instead of hand-picking glyphs per screen.
//
//   <Icon name="orders" size={18} color={COLORS.primary} />
//   <GradientIcon name="orders" size={40} colors={['#6366f1', '#8b5cf6']} />
//
// `name` is a semantic key from ICONS (or any raw FontAwesome6 glyph name,
// which passes through). family defaults to 'solid' (web fa-solid parity).
//
// GradientIcon renders the Zepto/Flipkart-style tile: a rounded gradient chip
// with a white glyph centered. Colors come from the GRADIENTS palette keyed by
// the same semantic names.

import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { FontAwesome6, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../styles/theme';

// ── Semantic glyph registry (web fa-solid parity) ─────────────────────────
export const ICONS = {
  // App navigation (bottom bar + menu)
  home: 'house',
  orders: 'boxes-stacked',
  book: 'plus',
  track: 'magnifying-glass',
  upload: 'cloud-arrow-up',
  menu: 'bars',
  calc: 'calculator',
  pincode: 'location-crosshairs',
  zipfinder: 'globe',
  complaint: 'triangle-exclamation',
  vault: 'vault',
  admin: 'gear',
  about: 'circle-info',
  crm: 'users',
  scans: 'box-open',
  reports: 'chart-pie',
  status: 'clipboard-check',
  scan: 'barcode',

  // Public/content pages (web main.html parity)
  docs: 'file-contract',
  calendar: 'calendar-days',
  memos: 'note-sticky',
  services: 'headset',
  dgr: 'triangle-exclamation',
  awareness: 'bullhorn',
  faqs: 'circle-question',
  register: 'user-plus',
  contact: 'headset',
  login: 'arrow-right-to-bracket',
  logout: 'arrow-right-from-bracket',

  // Search & filter
  search: 'magnifying-glass',
  filter: 'sliders',

  // Actions & state
  close: 'xmark',
  back: 'arrow-left',
  forward: 'arrow-right',
  chevronDown: 'chevron-down',
  chevronUp: 'chevron-up',
  refresh: 'rotate',
  bell: 'bell',
  comment: 'comment',
  envelope: 'envelope',
  paperclip: 'paperclip',
  download: 'download',
  print: 'print',
  share: 'share-nodes',
  trash: 'trash',
  edit: 'pencil',
  check: 'check',
  checkCircle: 'circle-check',
  eye: 'eye',
  eyeSlash: 'eye-slash',
  lock: 'lock',
  star: 'star',
  clock: 'clock',
  spinner: 'spinner',
  shield: 'shield-halved',
  file: 'file-lines',
};

// ── Futuristic gradient palette (Zepto/Flipkart-style tiles) ──────────────
// Each semantic key maps to a vibrant [from, to] gradient pair. Icons render
// white on top of the chip.
export const GRADIENTS = {
  home: ['#6366f1', '#8b5cf6'],          // indigo → violet
  orders: ['#0ea5e9', '#2563eb'],        // sky → blue
  book: ['#f97316', '#ef4444'],          // orange → red
  track: ['#10b981', '#0d9488'],         // emerald → teal
  upload: ['#a855f7', '#d946ef'],        // purple → fuchsia
  menu: ['#f43f5e', '#ec4899'],          // rose → pink
  calc: ['#f59e0b', '#ea580c'],          // amber → orange
  pincode: ['#3b82f6', '#06b6d4'],       // blue → cyan
  zipfinder: ['#14b8a6', '#22c55e'],     // teal → green
  complaint: ['#ef4444', '#f97316'],     // red → orange
  vault: ['#0f172a', '#334155'],         // slate (premium dark)
  admin: ['#64748b', '#0ea5e9'],         // slate → sky
  about: ['#8b5cf6', '#6366f1'],         // violet → indigo
  crm: ['#e11d48', '#f43f5e'],           // crimson → rose
  scans: ['#0891b2', '#06b6d4'],         // cyan
  reports: ['#7c3aed', '#4f46e5'],       // purple → indigo
  status: ['#0ea5e9', '#3b82f6'],        // sky → blue
  scan: ['#8b5cf6', '#6366f1'],          // violet → indigo
  docs: ['#4338ca', '#6366f1'],          // indigo
  calendar: ['#0d9488', '#14b8a6'],      // teal
  memos: ['#ca8a04', '#f59e0b'],         // yellow → amber
  services: ['#059669', '#10b981'],      // emerald
  dgr: ['#d97706', '#ef4444'],           // amber → red
  awareness: ['#ea580c', '#f97316'],     // orange
  faqs: ['#0891b2', '#0ea5e9'],          // cyan → sky
  register: ['#16a34a', '#22c55e'],      // green
  contact: ['#059669', '#10b981'],       // emerald
  login: ['#2563eb', '#3b82f6'],         // blue
  logout: ['#9c2007', '#ef4444'],        // crimson → red
  bell: ['#f59e0b', '#f97316'],          // amber → orange
  refresh: ['#0ea5e9', '#06b6d4'],       // sky → cyan
  search: ['#6366f1', '#8b5cf6'],        // indigo → violet
  filter: ['#9C2007', '#f59e0b'],        // brand maroon → amber
};

// Default gradient used when a name has no palette entry.
const DEFAULT_GRADIENT = ['#6366f1', '#8b5cf6'];

// '#0ea5e9' → 'rgba(14, 165, 233, 0.12)' — for the soft tinted icon variant.
const withAlpha = (hex, alpha) => {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return 'rgba(100, 116, 139, 0.12)';
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Icon — single entry point for every icon in the app.
 * @param {string} name  Semantic key from ICONS, or a raw FontAwesome6 glyph.
 * @param {number} [size=18]
 * @param {string} [color=COLORS.primary]
 * @param {'solid'|'regular'|'brands'} [family='solid']
 */
export default function Icon({ name, size = 18, color = COLORS.primary, family = 'solid', style, ...rest }) {
  return (
    <FontAwesome6
      name={ICONS[name] || name}
      size={size}
      color={color}
      family={family}
      style={style}
      {...rest}
    />
  );
}

/**
 * LineIcon — premium thin-line (Ionicons outline) glyph. The Linear/Stripe
 * style icon: elegant 2px strokes, ideal for tinted chips and list rows.
 * @param {string} name  Ionicons outline name (e.g. 'cube-outline').
 * @param {number} [size=20]
 * @param {string} [color='#475569']
 */
export function LineIcon({ name, size = 20, color = '#475569', style }) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}

/**
 * GradientGlyph — bold filled icon painted in liquid gradient color, the
 * Zepto/Flipkart-style hero icon. Uses the same masked-gradient technique as
 * GradientText, with MaterialCommunityIcons (chunky, modern, detailed) glyphs.
 *
 *   <GradientGlyph name="truck-delivery" size={34} colors={['#0ea5e9', '#2563eb']} />
 *
 * @param {string} name   MaterialCommunityIcons glyph name.
 * @param {number} [size=30]
 * @param {string[]} [colors]  Gradient pair; defaults to brand maroon→amber.
 */
export function GradientGlyph({ name, size = 30, colors = ['#9C2007', '#f59e0b'], style }) {
  const box = { width: size, height: size };
  return (
    <MaskedView
      maskElement={
        <MaterialCommunityIcons name={name} size={size} color="#000" style={{ textAlign: 'center' }} />
      }
      style={[box, style]}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={box} />
    </MaskedView>
  );
}

/**
 * GradientIcon — icon chip.
 * @param {string} name       Semantic key from ICONS (or raw glyph).
 * @param {number} [size=40]  Tile size (width/height).
 * @param {number} [iconSize=18] Glyph size inside the tile.
 * @param {string[]} [colors] Gradient pair; defaults to GRADIENTS[name].
 * @param {number} [radius]   Corner radius; defaults to size/3 (squircle look).
 * @param {boolean} [dim]     Render muted (gray chip) for inactive states.
 * @param {boolean} [soft]    Premium soft-tint variant: a light wash of the
 *                            color with a solid colored glyph (Linear/Stripe
 *                            style) instead of a white glyph on a loud gradient.
 */
export function GradientIcon({
  name,
  size = 40,
  iconSize = 18,
  colors,
  radius,
  dim = false,
  soft = false,
  style,
}) {
  const glyph = ICONS[name] || name;
  const pair = colors || GRADIENTS[name] || DEFAULT_GRADIENT;
  const tileColors = dim ? ['#e2e8f0', '#cbd5e1'] : pair;
  const iconColor = dim ? '#94a3b8' : (soft ? pair[0] : '#ffffff');
  const chipStyle = {
    width: size,
    height: size,
    borderRadius: radius != null ? radius : Math.round(size / 3),
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (soft) {
    return (
      <View style={[{ backgroundColor: withAlpha(dim ? '#94a3b8' : pair[0], 0.12) }, chipStyle, style]}>
        <FontAwesome6 name={glyph} size={iconSize} color={iconColor} />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={tileColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[chipStyle, style]}
    >
      <FontAwesome6 name={glyph} size={iconSize} color={iconColor} />
    </LinearGradient>
  );
}
