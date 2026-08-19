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
  emailOpen: 'envelope-open',
  paperclip: 'paperclip',
  download: 'download',
  copy: 'copy',
  layout: 'border-all',
  whatsapp: 'whatsapp',
  print: 'print',
  share: 'share-nodes',
  // share-from-square = the classic share glyph (arrow leaving a frame), so
  // it reads as an action, not like "save image to gallery" (images).
  shareImage: 'share-from-square',
  trash: 'trash',
  delete: 'trash',
  edit: 'pencil',
  check: 'check',
  checkCircle: 'circle-check',
  'check-circle': 'circle-check',
  'check-decagram': 'circle-check',
  'calculator-variant': 'calculator',
  'chart-box-outline': 'chart-pie',
  eye: 'eye',
  eyeSlash: 'eye-slash',
  lock: 'lock',
  star: 'star',
  clock: 'clock',
  spinner: 'spinner',
  shield: 'shield-halved',
  file: 'file-lines',

  // Document Center doc types (shipping docs)
  label: 'tag',
  receipt: 'receipt',
  pod: 'truck-fast',
  officeCopy: 'screwdriver-wrench',
  packaging: 'box-open',
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
  label: ['#0ea5e9', '#2563eb'],         // sky → blue (shipping label)
  receipt: ['#f59e0b', '#ea580c'],       // amber → orange (customer copy)
  pod: ['#10b981', '#0d9488'],           // emerald → teal (proof of delivery)
  officeCopy: ['#8b5cf6', '#6366f1'],    // violet → indigo (maintenance copy)
  packaging: ['#f43f5e', '#ec4899'],     // rose → pink (packaging slip)

  // Actions — vivid two-hue pairs, same global language as tiles & panes
  print: ['#0ea5e9', '#2563eb'],         // sky → blue
  envelope: ['#f59e0b', '#f97316'],      // amber → orange
  download: ['#64748b', '#334155'],      // slate → dark slate
  whatsapp: ['#25D366', '#128C7E'],      // WhatsApp brand green → teal
  layout: ['#8b5cf6', '#6366f1'],        // violet → indigo
  copy: ['#0ea5e9', '#06b6d4'],          // sky → cyan
  share: ['#14b8a6', '#22c55e'],         // teal → green
  shareImage: ['#14b8a6', '#0ea5e9'],    // teal → sky (picture share)
  edit: ['#f59e0b', '#ea580c'],          // amber → orange
  trash: ['#ef4444', '#dc2626'],         // red → deep red
  refresh: ['#0ea5e9', '#06b6d4'],       // sky → cyan
  eye: ['#6366f1', '#8b5cf6'],           // indigo → violet
  checkCircle: ['#16a34a', '#22c55e'],   // green → light green
  back: ['#9C2007', '#f59e0b'],          // brand maroon → amber
};

// ── Canonical action colors ──────────────────────────────────────────────────
// One fixed color per action, identical everywhere in the project. Icon chips
// and the Button `soft` variant derive their tint from this map, so
// <Button variant="soft" icon="whatsapp" /> is always the green WhatsApp mark,
// while print/download/mail stay neutral slate, upload is green, etc.
export const ACTION_COLORS = {
  whatsapp: '#25D366',
  upload: '#16a34a',
  print: '#0284c7',      // sky
  download: '#64748b',   // slate (chosen neutral)
  envelope: '#ea580c',   // orange
  emailOpen: '#0284c7',  // sky (mark-read)
  mail: '#ea580c',       // orange
  layout: '#7c3aed',     // violet
  share: '#059669',      // emerald
  shareImage: '#0891b2', // cyan (picture share)
  edit: '#ea580c',       // orange
  copy: '#0284c7',       // sky
  trash: '#ef4444',      // red
  delete: '#ef4444',     // red
  refresh: '#0284c7',    // sky
  checkCircle: '#0284c7',// sky
  eye: '#4f46e5',        // indigo
  back: '#9C2007',       // brand maroon
};

// ── Tint chip backgrounds (Shipment-Details style) ────────────────────────────
// Very-light pastel fill for each action chip — the same trick the WhatsApp
// chip uses (light green #dcfce7 under the green glyph). Every action key gets
// a fill in its own color family; unknown keys fall back to slate-100.
export const TINT_BG = {
  whatsapp: '#dcfce7',    // green-100
  upload: '#dcfce7',      // green-100
  checkCircle: '#e0f2fe', // sky-100
  refresh: '#e0f2fe',     // sky-100
  trash: '#fef2f2',       // red-50
  delete: '#fef2f2',      // red-50
  print: '#e0f2fe',       // sky-100
  download: '#f1f5f9',    // slate-100
  envelope: '#ffedd5',    // orange-100
  emailOpen: '#e0f2fe',   // sky-100
  mail: '#ffedd5',        // orange-100
  layout: '#ede9fe',      // violet-100
  copy: '#e0f2fe',        // sky-100
  share: '#d1fae5',       // emerald-100
  shareImage: '#cffafe',  // cyan-100
  edit: '#ffedd5',        // orange-100
  eye: '#e0e7ff',         // indigo-100
  back: '#fde8e8',        // maroon-50
};

// ── MaterialCommunityIcons semantic registry ─────────────────────────────────
// GradientGlyph (the chunky liquid-gradient tile/pane icon) resolves semantic
// keys through this map, falling back to raw MCI glyph names. This keeps the
// Zepto/Flipkart-style hero icons as centralized as the FA6 `Icon` registry.
export const MCI_GLYPHS = {
  // Navigation & Feature tiles
  pincode: 'map-marker-radius',
  zipfinder: 'earth',
  complaint: 'alert-circle-outline',
  bell: 'bell-outline',
  home: 'home-variant-outline',
  orders: 'package-variant-closed',
  book: 'plus-box-outline',
  track: 'magnify-expand',
  vault: 'safe',
  admin: 'cog-outline',
  status: 'clipboard-check',
  crm: 'account-group',
  users: 'account-group',
  contacts: 'account-multiple',
  truck: 'truck-fast',
  cash: 'cash-multiple',
  'package-up': 'package-up',
  'package-down': 'package-down',
  mode: 'airplane-takeoff',
  carrier: 'truck-delivery',
  boxes: 'package-variant-closed',
  pcs: 'layers-outline',
  product: 'file-document-outline',
  invoice: 'receipt-text-outline',
  'file-document': 'file-document-outline',
  // Document Center doc types
  label: 'label',
  receipt: 'receipt-text',
  pod: 'truck-fast',
  officeCopy: 'file-document-multiple',
  packaging: 'package-variant',
  // Chunky action glyphs (print / mail / download / whatsapp …)
  print: 'printer',
  envelope: 'email-outline',
  emailOpen: 'email-open-outline',
  download: 'download',
  upload: 'upload',
  whatsapp: 'whatsapp',
  layout: 'border-all',
  copy: 'content-copy',
  share: 'share-variant',
  shareImage: 'share-variant',
  trash: 'delete-outline',
  delete: 'delete-outline',
  refresh: 'refresh',
  eye: 'eye-outline',
  edit: 'pencil-outline',
  checkCircle: 'check-circle',
  close: 'close',
  back: 'arrow-left',
  forward: 'arrow-right',
  search: 'magnify',
  menu: 'menu',
  // Tracking pane glyphs — MCI names for the FA6-semantic keys
  scan: 'barcode-scan',
  gear: 'cog',
};

// Default gradient used when a name has no palette entry.
const DEFAULT_GRADIENT = ['#6366f1', '#8b5cf6'];

// '#0ea5e9', 0.72 → a darker 'rgb(...)' — second stop for liquid-gradient icons.
export const shade = (hex, factor) => {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `rgb(${r}, ${g}, ${b})`;
};

// '#0ea5e9' → 'rgba(14, 165, 233, 0.12)' — for the soft tinted icon variant.
export const withAlpha = (hex, alpha) => {
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
// Brand glyphs (FontAwesome6 brands family). Auto-selected so callers don't
// have to remember the family flag — e.g. <Icon name="whatsapp" />.
const BRANDS = new Set(['whatsapp']);

export default function Icon({ name, size = 18, color = COLORS.primary, family, chunky = false, style, ...rest }) {
  const glyph = ICONS[name] || name;
  const resolvedFamily = family || (BRANDS.has(name) ? 'brands' : 'solid');
  if (chunky) {
    // Bold MaterialCommunityIcons glyph (Zepto/Flipkart-style) instead of the
    // thin FA6 outline — pass the same semantic name, resolved via MCI_GLYPHS.
    const mci = MCI_GLYPHS[name] || name;
    return <MaterialCommunityIcons name={mci} size={size} color={color} style={style} {...rest} />;
  }
  return (
    <FontAwesome6
      name={glyph}
      size={size}
      color={color}
      family={resolvedFamily}
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
 *   <GradientGlyph name="pod" size={30} colors={GRADIENTS.pod} />  // semantic
 *
 * @param {string} name   Semantic key from MCI_GLYPHS, or a raw MCI glyph name.
 * @param {number} [size=30]
 * @param {string[]} [colors]  Gradient pair; defaults to brand maroon→amber.
 */
export function GradientGlyph({ name, size = 30, colors = ['#9C2007', '#f59e0b'], style }) {
  const glyph = MCI_GLYPHS[name] || name;
  const box = { width: size, height: size };
  return (
    <MaskedView
      // androidRenderingMode="software" keeps the glyph in a software layer so
      // react-native-view-shot can capture views containing it on Android.
      androidRenderingMode="software"
      maskElement={
        <MaterialCommunityIcons name={glyph} size={size} color="#000" style={{ textAlign: 'center' }} />
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
