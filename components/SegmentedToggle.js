// components/SegmentedToggle.js — Centralized joined single-select segmented
// control (one pill shell, gradient active segment). The same language the
// app uses for mode switches everywhere: TrackingPane (Scans/System),
// TrackModal (Default/Live/Custom/Pincode), StatusUpdateScreen
// (Docket/Runsheet/Manifest), PincodeScreen (Pincode/City).
// Fully static — no Animated.
//
//   <SegmentedToggle
//     options={[{ key: 'docket', label: 'Docket', icon: 'package-variant-closed' }, ...]}
//     value={viewMode}
//     onChange={setViewMode}
//     colors={['#9C2007', '#f59e0b']}
//     size="md"
//   />
//
// options:   [{ key, label, icon? }] — icon is a GradientGlyph name (MCI)
// value:     selected option key
// onChange:  (key) => void
// colors:    active-segment gradient; also tints the glow + idle glyphs
// size:      'sm' (compact — TrackingPane/TrackModal) | 'md' (Status/Pincode)
// flex:      stretch segments to share the row width evenly (full-width bars)
// idleIconColor: override for idle glyphs (e.g. gray when the shell sits on
//            a busy surface)

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientGlyph } from './icons';

// Append an alpha channel to a #rrggbb hex color (for the active glow).
const withAlpha = (hex, alpha) => (/^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${alpha}` : hex);

const SIZES = {
  xs: { padH: 3, padV: 3, fontSize: 9.5 },
  sm: { padH: 5, padV: 5, fontSize: 10.5 },
  md: { padH: 10, padV: 6, fontSize: 11.5 },
  lg: { padH: 16, padV: 7, fontSize: 12 },
};

// Soft glow behind the active segment, tinted with the gradient's first color.
const activeShadow = (colors) => (Platform.OS === 'web'
  ? { boxShadow: `0 2px 8px ${withAlpha(colors[0], '59')}` }
  : { shadowColor: colors[0], shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 });

export default function SegmentedToggle({
  options = [],
  value,
  onChange,
  colors = ['#9C2007', '#f59e0b'],
  size = 'md',
  flex = false,
  iconSize = 12,
  idleIconColor,
  style,
}) {
  const s = SIZES[size] || SIZES.md;
  const padH = flex ? Math.min(s.padH, 4) : s.padH;
  return (
    <View style={[styles.group, style]} accessibilityRole="tablist">
      {options.map((item) => {
        const active = value === item.key;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.btn,
              flex && styles.btnFlex,
              active && activeShadow(colors),
              pressed && styles.pressed,
            ]}
          >
            {active ? (
              <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.seg, { paddingHorizontal: padH, paddingVertical: s.padV }]}>
                {item.icon ? <GradientGlyph name={item.icon} size={iconSize} colors={['#ffffff', '#ffffff']} /> : null}
                <Text style={[styles.textActive, { fontSize: s.fontSize }]} numberOfLines={1}>{item.label}</Text>
              </LinearGradient>
            ) : (
              <View style={[styles.seg, { paddingHorizontal: padH, paddingVertical: s.padV }]}>
                {item.icon ? <GradientGlyph name={item.icon} size={iconSize} colors={idleIconColor || colors} /> : null}
                <Text style={[styles.text, { fontSize: s.fontSize }]} numberOfLines={1}>{item.label}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f1f5f9',
    padding: 3,
    gap: 2,
  },
  btn: { borderRadius: 999, overflow: 'hidden' },
  btnFlex: { flex: 1 },
  seg: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 999,
  },
  text: { color: '#64748b', fontWeight: '800', letterSpacing: 0.2 },
  textActive: { color: '#ffffff', fontWeight: '900', letterSpacing: 0.2 },
  pressed: { opacity: 0.7 },
});
