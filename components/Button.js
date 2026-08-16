// components/Button.js — Centralized futuristic button.
// Same design language as GradientIcon (components/icons.js): a gradient fill,
// soft glow shadow, spring press bounce and pill corners.
//
//   <Button variant="primary" size="md" loading={saving} icon="check" onPress={save}>
//     Save
//   </Button>
//
// variant: 'primary' (brand maroon→red) | 'danger' | 'ghost' (navy) | 'otp' (amber) | 'secondary' (neutral outline) | 'soft' (dynamic soft tint via softColor)
// size:    'xs' | 'sm' | 'md' | 'lg'
// icon:    a glyph name from components/icons (ICONS registry) or a React node
// glyph:   when true (or truthy), the icon renders as a bold MaterialCommunityIcons
//          glyph (via MCI_GLYPHS) instead of the thin FA6 outline — same name.

import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon, { ACTION_COLORS, GRADIENTS, GradientIcon, GradientGlyph, TINT_BG, shade } from './icons';
import { COLORS } from '../styles/theme';

const VARIANTS = {
  primary: { colors: ['#9C2007', '#ef4444'], text: '#ffffff', spinner: '#ffffff' },   // brand maroon → red
  danger:  { colors: ['#e11d48', '#ef4444'], text: '#ffffff', spinner: '#ffffff' },   // rose → red
  ghost:   { colors: ['#1e3a5f', '#334155'], text: '#ffffff', spinner: '#ffffff' },   // navy → slate
  otp:     { colors: ['#f59e0b', '#f97316'], text: '#ffffff', spinner: '#ffffff' },   // amber → orange
  secondary: { outline: true, text: '#334155', spinner: COLORS.primary, border: '#e2e8f0', bg: '#ffffff' }, // white + neutral border
  glass:   { outline: true, text: '#ffffff', spinner: '#ffffff', border: 'rgba(255,255,255,0.45)', bg: 'rgba(255,255,255,0.08)' }, // translucent, for dark/glass surfaces
  mint:    { outline: true, text: '#065f46', spinner: '#065f46', border: '#6ee7b7', bg: '#d1fae5' }, // soft emerald fill (filter/reset family)
  soft:    { outline: true, soft: true, text: '#1d4ed8', spinner: '#1d4ed8', border: '#bfdbfe', bg: '#eff6ff' }, // dynamic soft tint — driven by the `softColor` prop
  chip:    { chip: true }, // GradientIcon body — the header/footer global icon class (gradient squircle + white glyph)
  tint:    { outline: true, tint: true, text: '#64748b', spinner: '#64748b', border: '#e2e8f0', bg: '#f1f5f9' }, // Shipment-Details style: squarish chip with per-action very-light tint bg (TINT_BG) + solid chunky glyph
};

const SIZES = {
  xs: { height: 22, paddingH: 6, fontSize: 10, radius: 7, iconSize: 11 },
  chip: { height: 28, paddingH: 8, fontSize: 11, radius: 9, iconSize: 14 },  // action-icon chip (doc center)
  sm: { height: 34, paddingH: 14, fontSize: 12, radius: 12, iconSize: 13 },
  md: { height: 46, paddingH: 22, fontSize: 14, radius: 15, iconSize: 15 },
  lg: { height: 56, paddingH: 30, fontSize: 16, radius: 18, iconSize: 17 },
};

// Soft colored glow behind filled variants (web boxShadow / native elevation)
const glowShadow = (color) => (Platform.OS === 'web'
  ? { boxShadow: `0px 5px 14px ${color}55` }
  : {
      shadowColor: color,
      shadowOpacity: 0.35,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 6,
    });

// Append an alpha channel to a #rrggbb hex color (used for the soft tint fill).
const hexAlpha = (hex, a) => {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/**
 * Global Button — the single way to render a tappable action.
 *
 * @param {string} variant 'primary' | 'danger' | 'ghost' | 'otp' | 'secondary' (default primary)
 * @param {string} size    'xs' | 'chip' | 'sm' | 'md' | 'lg' (default md)
 * @param {boolean} loading Shows a spinner, blocks presses.
 * @param {boolean} disabled Blocks presses (dimmed).
 * @param {string|ReactNode} icon Leading icon (ICONS glyph name or a React node).
 * @param {boolean} glyph Render the icon as a liquid-gradient GradientGlyph —
 *   the global icon class (painted in the button accent → darker shade).
 * @param {string|ReactNode} label Convenience alias for children.
 * @param {boolean} iconOnly Render just the icon as a circular button (no
 *   label/padding) — the standard close ✕ / dismiss control for popups.
 * @param {boolean} fullWidth Stretch to full parent width.
 * @param {object} style Extra style for the outer wrapper (margins etc).
 * @param {object} textStyle Extra style for the label text.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onPress,
  children,
  label,
  icon,
  glyph = false,
  colors,
  softColor,
  style,
  textStyle,
  iconOnly = false,
  fullWidth = false,
  accessibilityLabel,
  ...rest
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.md;
  const isDisabled = disabled || loading;
  const content = label != null ? label : children;
  const gradientColors = colors || v.colors;

  // `soft` variant tints itself with `softColor` (border/fill/text all derived).
  const isSoft = variant === 'soft';
  const softAccent = softColor || (typeof icon === 'string' ? (ACTION_COLORS[icon] || '#64748b') : '#6366f1');
  // `tint` variant — Shipment-Details chip: the icon's own color as a light
  // wash over the chip + a solid chunky glyph in that color.
  const isTint = variant === 'tint';
  const tintAccent = isTint ? (typeof icon === 'string' ? (ACTION_COLORS[icon] || '#64748b') : '#64748b') : null;
  const borderColor = isSoft ? hexAlpha(softAccent, 0.32) : v.border;
  const bgColor = isSoft
    ? hexAlpha(softAccent, 0.10)
    : (isTint ? (TINT_BG[typeof icon === 'string' ? icon : ''] || '#f1f5f9') : v.bg);
  const textColor = isSoft ? softAccent : (isTint ? tintAccent : v.text);
  const spinnerColor = isSoft ? softAccent : (isTint ? tintAccent : v.spinner);

  const iconEl = icon
    ? (typeof icon === 'string'
        ? (isTint
            // Shipment-Details style: solid chunky glyph in the action color.
            ? <Icon name={icon} size={14} color={tintAccent} chunky />
            : (glyph
                // Liquid-gradient icon — the app's global icon class (GradientGlyph).
                // Colors resolve from the global GRADIENTS palette (vivid two-hue
                // pairs, same as tiles & panes); fall back to accent → darker shade.
                ? <GradientGlyph
                    name={icon}
                    size={s.iconSize + 2}
                    colors={GRADIENTS[icon] || ((gradientColors && gradientColors.length >= 2) ? gradientColors : [textColor, shade(textColor, 0.72)])}
                  />
                : <Icon name={icon} size={s.iconSize} color={textColor} />))
        : icon)
    : null;

  const animateTo = (to) => {
    if (isDisabled) return;
    scale.stopAnimation();
    Animated.spring(scale, { toValue: to, useNativeDriver: true, friction: 6, tension: 240 }).start();
  };

  const labelEl = content != null ? (
    <Text
      style={[
        styles.label,
        { color: textColor, fontSize: s.fontSize },
        isDisabled && styles.dimmed,
        textStyle,
      ]}
      numberOfLines={1}
    >
      {content}
    </Text>
  ) : null;

  const innerContent = (
    <View style={[styles.innerRow, { paddingHorizontal: iconOnly ? 0 : s.paddingH, gap: 7 }]}>
      {loading ? <ActivityIndicator size="small" color={spinnerColor} /> : (
        <>
          {iconEl}
          {labelEl}
        </>
      )}
    </View>
  );

  // iconOnly → a perfect circle sized by the variant height (no label padding),
  // except the tint chip which stays squarish like the Shipment-Details buttons.
  const radius = iconOnly ? (isTint ? s.radius : s.height / 2) : s.radius;

  // Tint chip mirrors the Shipment-Details buttons exactly: content-sized
  // (padding 5 around the 14px glyph → 24px), radius 6, 1px border.
  const chipBox = isTint
    ? { padding: 5, borderRadius: 6, borderWidth: 1, borderColor, backgroundColor: bgColor }
    : { height: s.height, width: iconOnly ? s.height : undefined, borderRadius: radius, borderWidth: isTint ? 1 : 1.5, borderColor, backgroundColor: bgColor };

  const body = v.chip ? (
    // Global icon class: gradient squircle + white glyph (header/footer style).
    // Colors resolve automatically from the GRADIENTS palette via the name.
    <GradientIcon
      name={typeof icon === 'string' ? icon : undefined}
      size={s.height}
      iconSize={s.iconSize + 2}
    />
  ) : v.outline ? (
    <View style={[
      styles.fill,
      chipBox,
      isDisabled && styles.dimmed,
    ]}>
      {innerContent}
    </View>
  ) : (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.fill,
        { height: s.height, width: iconOnly ? s.height : undefined, borderRadius: radius },
        glowShadow(gradientColors[gradientColors.length - 1]),
        isDisabled && styles.dimmed,
      ]}
    >
      {innerContent}
    </LinearGradient>
  );

  return (
    <Animated.View style={[{ transform: [{ scale }] }, fullWidth && styles.fullWidth, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || (typeof content === 'string' ? content : undefined)}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        onPress={onPress}
        onPressIn={() => animateTo(0.96)}
        onPressOut={() => animateTo(1)}
        {...rest}
      >
        {body}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fullWidth: { width: '100%' },
  fill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dimmed: {
    opacity: 0.5,
  },
});
