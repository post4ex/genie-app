// components/FilterBar.js — Centralized futuristic filter controls.
// An icon-only filter chip (no label; brand glow + count badge when filters
// are active) plus an optional row of active-filter pills with a Reset action.
// Fully static — no Animated.
//
//   <FilterBar onPress={openModal} isActive={hasFilters} activeCount={n} />
//   <FilterBar pills={['Status: INTRANSIT', 'Branch: DDN']} onReset={reset} />

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GradientIcon } from './icons';
import { COLORS } from '../styles/theme';

export default function FilterBar({
  onPress,
  isActive = false,
  activeCount = 0,
  pills = [],
  onReset,
}) {
  return (
    <View style={styles.wrap}>
      {onPress != null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open filters"
          onPress={onPress}
          style={({ pressed }) => [styles.btn, isActive && styles.btnActive, pressed && styles.btnPressed]}
        >
          <GradientIcon name="filter" size={30} iconSize={13} colors={['#F54927', '#F54927']} />
          {activeCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeCount}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      {pills.length > 0 ? (
        <View style={styles.pillsRow}>
          {pills.map((p, i) => (
            <View key={i} style={styles.pill}>
              <View style={styles.pillDot} />
              <Text style={styles.pillText} numberOfLines={1}>{p}</Text>
            </View>
          ))}
          {onReset != null ? (
            <Pressable onPress={onReset} style={({ pressed }) => pressed && styles.btnPressed}>
              <Text style={styles.resetText}>Reset</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  btn: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#F54927',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 0 1px rgba(245, 73, 39, 0.18), 0 0 8px rgba(245, 73, 39, 0.22), 0 0 16px rgba(245, 73, 39, 0.12)' }
      : {
          shadowColor: '#F54927',
          shadowOpacity: 0.25,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }),
  },
  btnActive: {
    borderColor: '#F54927',
    backgroundColor: '#fff7f5',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 0 1px rgba(245, 73, 39, 0.30), 0 0 10px rgba(245, 73, 39, 0.32), 0 0 20px rgba(245, 73, 39, 0.18)' }
      : {
          shadowColor: '#F54927',
          shadowOpacity: 0.4,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 2 },
          elevation: 5,
        }),
  },
  btnPressed: {
    opacity: 0.75,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 9,
    paddingVertical: 4,
    maxWidth: 180,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9C2007',
  },
  pillText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
  },
  resetText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9C2007',
    marginLeft: 4,
  },
});
