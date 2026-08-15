// components/Tile.js — Centralized tile (Vercel/Linear-inspired premium look).
// Restrained, left-aligned typography: tiny accent dot + uppercase label on top,
// a large gradient value, optional muted caption. Sparkling border + glow that
// match the tile's accent colour (the value text colour); subtle lift on press.
//
//   <Tile label="Total Orders" value={128} accent="#2563eb" onPress={open} />
//   <Tile label="In Transit" count={14} accent="#f97316" size="sm" />
//
// accent:  a color (or [from, to] pair — first color drives the border/glow/dot)
// value | count: the big number (aliases)
// caption: optional muted line under the value (delta / note)
// badge:   small pill pinned top-right · active: stronger border + glow

import React, { useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import GradientText from './GradientText';
import { COLORS } from '../styles/theme';

const SIZES = {
  sm: { height: 86, radius: 16, pad: 14, label: 9.5, value: 26, dot: 6 },
  md: { height: 112, radius: 18, pad: 16, label: 10.5, value: 32, dot: 7 },
};

// Append an alpha channel to a #rrggbb hex color (used for tinted border/glow).
// Falls back to the raw color for non-hex inputs (rgba(), names, etc.).
const withAlpha = (hex, alpha) => (/^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${alpha}` : hex);

// Sparkling border + glow tinted with the tile's accent colour.
// Shared with screens that render their own tiles (e.g. Orders grid) so the
// sparkle effect stays defined in one place.
export const accentSparkle = (accent, active) => (Platform.OS === 'web'
  ? {
      borderColor: withAlpha(accent, active ? 'b3' : '66'),
      boxShadow: `0 0 0 1px ${withAlpha(accent, '2e')}, 0 0 10px ${withAlpha(accent, active ? '59' : '40')}, 0 0 22px ${withAlpha(accent, active ? '40' : '26')}`,
    }
  : {
      borderColor: withAlpha(accent, active ? 'b3' : '66'),
      shadowColor: accent,
      shadowOpacity: active ? 0.45 : 0.28,
      shadowRadius: active ? 14 : 10,
      shadowOffset: { width: 0, height: 2 },
      elevation: active ? 6 : 3,
    });

export default function Tile({
  label,
  value,
  count,
  caption,
  badge,
  accent = COLORS.primary,
  onPress,
  size = 'md',
  layout = 'vertical',
  active = false,
  style,
  ...rest
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const s = SIZES[size] || SIZES.md;
  const accentPair = Array.isArray(accent) ? accent : [accent, accent];
  const accentColor = accentPair[0];
  const dotColor = accentColor;
  const display = value != null ? value : count;

  const animateTo = (toVal) => {
    scale.stopAnimation();
    Animated.spring(scale, { toValue: toVal, useNativeDriver: true, friction: 7, tension: 220 }).start();
  };

  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label || undefined}
        onPress={onPress}
        onPressIn={() => animateTo(0.98)}
        onPressOut={() => animateTo(1)}
        {...rest}
      >
        <View
          style={[
            styles.card,
            { height: s.height, borderRadius: s.radius, padding: s.pad },
            layout === 'row' ? styles.cardRow : styles.cardCol,
            accentSparkle(accentColor, active),
          ]}
        >
          {layout === 'row' ? (
            <View style={styles.rowText}>
              <Text style={[styles.label, { fontSize: s.label }]} numberOfLines={1}>{label}</Text>
              {caption != null ? <Text style={styles.caption} numberOfLines={1}>{caption}</Text> : null}
            </View>
          ) : (
            <View style={styles.labelRow}>
              <View style={[styles.dot, { width: s.dot, height: s.dot, borderRadius: s.dot / 2, backgroundColor: dotColor }]} />
              <Text style={[styles.label, { fontSize: s.label }]} numberOfLines={1}>{label}</Text>
            </View>
          )}

          {display != null ? (
            <GradientText colors={accentPair} style={[styles.value, { fontSize: s.value }]} numberOfLines={1}>{display}</GradientText>
          ) : null}

          {layout !== 'row' && caption != null ? <Text style={styles.caption} numberOfLines={1}>{caption}</Text> : null}

          {badge != null ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    position: 'relative',
    overflow: 'visible',
  },
  cardCol: {
    justifyContent: 'center',
    gap: 6,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    opacity: 0.9,
  },
  label: {
    color: '#94a3b8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    flexShrink: 1,
  },
  value: {
    color: '#0f172a',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  caption: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  rowText: {
    flex: 1,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: COLORS.primary,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: `0px 2px 6px ${COLORS.primary}66` }
      : { shadowColor: COLORS.primary, shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 }),
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
});
