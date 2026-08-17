// components/ListItem.js — Centralized list row (premium, fully static).
// One row style for every list in the app (orders, vault, admin, masters…).
// Restrained Vercel/Linear-style card: hairline border, layered soft shadow,
// bold title, muted subtitle lines, and a gradient status chip. No icon — the
// content carries the row. Press feedback is a plain Pressable opacity dim —
// no Animated, so it stays crash-free.
//
//   <ListItem
//     title="GEN-2024-000123"
//     subtitle={['AWB: 1234567890 | JetLine', '📍 DEHRADUN → 🏁 DELHI']}
//     status="INTRANSIT"
//     onPress={open}
//   />
//
// status:        text shown in a gradient chip; color auto-derived from STATUS_COLORS
// statusColor:   explicit [from, to] override for the chip
// trailing:      custom element on the far right (e.g. a chevron)

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { accentSparkle } from './Tile';

// Status → gradient chip colors (keys are lowercased, spaces stripped).
// Every status carries its own colour so rows are scannable at a glance.
const STATUS_COLORS = {
  delivered: ['#10b981', '#22c55e'],      // emerald → green
  intransit: ['#f59e0b', '#f97316'],      // amber → orange
  outfordelivery: ['#0ea5e9', '#2563eb'], // sky → blue
  shipped: ['#0ea5e9', '#3b82f6'],        // sky → blue
  dispatch: ['#8b5cf6', '#6366f1'],       // violet → indigo
  booked: ['#6366f1', '#4f46e5'],         // indigo → deep indigo
  pending: ['#f59e0b', '#d97706'],        // amber → darker amber
  cancelled: ['#ef4444', '#dc2626'],      // red
  rto: ['#e11d48', '#be123c'],            // rose → crimson
  exception: ['#f97316', '#ef4444'],      // orange → red
  pickup: ['#a855f7', '#7c3aed'],         // purple → violet
  deleted: ['#94a3b8', '#64748b'],        // muted gray
};
const DEFAULT_STATUS = ['#9C2007', '#ef4444'];

// Per-line subtitle colours — each detail line gets its own tint so rows are
// scannable at a glance (codes/AWB → sky, meta → violet, route → emerald).
const SUBTITLE_COLORS = ['#0284c7', '#7c3aed', '#059669'];

// LightSeaGreen sparkling border + glow — same effect as the trays/tiles.
const SEAGREEN_SPARKLE = accentSparkle('#20B2AA', false);

export default function ListItem({
  title,
  subtitle,
  status,
  statusColor,
  trailing,
  onPress,
  style,
  ...rest
}) {
  const subs = subtitle == null ? [] : Array.isArray(subtitle) ? subtitle : [subtitle];

  const st = (status || '').toString().toLowerCase().replace(/\s+/g, '');
  const chipColors = statusColor || STATUS_COLORS[st] || DEFAULT_STATUS;

  const renderCard = (pressed) => (
    <View style={[styles.card, style, pressed && styles.cardPressed]}>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subs.map((line, i) => (
          <Text key={i} style={[styles.subtitle, { color: SUBTITLE_COLORS[i % SUBTITLE_COLORS.length] }]} numberOfLines={1}>{line}</Text>
        ))}
      </View>

      {status != null ? (
        <LinearGradient colors={chipColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chip}>
          <Text style={styles.chipText} numberOfLines={1}>{status}</Text>
        </LinearGradient>
      ) : null}

      {trailing != null ? trailing : null}
    </View>
  );

  if (onPress == null) {
    return <View style={styles.row}>{renderCard(false)}</View>;
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title || undefined}
        onPress={onPress}
        style={styles.pressable}
        {...rest}
      >
        {({ pressed }) => renderCard(pressed)}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 10,
  },
  pressable: {
    borderRadius: 16,
    ...(Platform.OS === 'web'
      ? { outlineStyle: 'none', userSelect: 'none', WebkitTapHighlightColor: 'transparent' }
      : {}),
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative', // anchor for the floating status badge
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...SEAGREEN_SPARKLE,
  },
  cardPressed: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    transform: [{ scale: 0.985 }],
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12, // badge floats on the border — details flex to fill the row
  },
  title: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  chip: {
    position: 'absolute', // floats on the card's top-right corner
    top: -10, // half the badge sits on/over the card's top border
    right: 12,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: 84,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 1px 3px rgba(15, 23, 42, 0.18)' }
      : {
          shadowColor: '#0f172a',
          shadowOpacity: 0.22,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        }),
  },
  chipText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
