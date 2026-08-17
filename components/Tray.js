import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GradientText from './GradientText';
import { GradientGlyph } from './icons';

// Brand accent used for the header tick + title text unless overridden
const BRAND_ACCENT = ['#9C2007', '#f59e0b'];

/**
 * Centralized global tray card — violet sparkling border with a soft glow
 * (web box-shadow / native violet shadow) and an optional gradient-accented
 * header: accent tick + leading icon + gradient title + right slot.
 *
 * Usage:
 *   <Tray title="Recent Orders">
 *     ...content...
 *   </Tray>
 *
 *   <Tray title={`${label} (${count})`} icon="cube" iconColors={tile.grad} right={<Stat />}>
 *     ...content...
 *   </Tray>
 *
 *   <Tray style={{ flex: 1 }}> ...plain card, no header... </Tray>
 */
export default function Tray({
  title,
  colors = BRAND_ACCENT,
  icon = null,
  iconColors,
  iconSize = 15,
  right = null,
  style,
  headerStyle,
  compact = false,
  floating = false,
  children,
}) {
  if (floating && title) {
    return (
      <View style={[styles.card, compact && styles.cardCompact, styles.cardFloating, style]}>
        <View style={styles.floatingChip}>
          <GradientText colors={colors} style={styles.floatingChipText}>{title}</GradientText>
        </View>
        {right ? <View style={styles.floatingHeaderRight}>{right}</View> : null}
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.card, compact && styles.cardCompact, style]}>
      {(title || icon || right) && (
        <View style={[styles.header, headerStyle]}>
          <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.accent} />
          {icon ? (
            <GradientGlyph name={icon} size={iconSize} colors={iconColors || colors} style={styles.icon} />
          ) : null}
          {title ? (
            <GradientText colors={colors} style={styles.title}>{title}</GradientText>
          ) : null}
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#8b5cf6',
    elevation: 3,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 0 1px rgba(167,139,250,0.28), 0 0 10px rgba(139,92,246,0.30), 0 0 24px rgba(168,85,247,0.18)' }
      : {
          shadowColor: '#8b5cf6',
          shadowOpacity: 0.30,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 2 },
        }),
  },
  cardCompact: { padding: 10, paddingTop: 4 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  accent: { width: 4, height: 16, borderRadius: 2, marginRight: 8 },
  icon: { marginRight: 7 },
  title: { fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  right: { marginLeft: 'auto' },

  // Floating title chip — a rounded, unfilled pill straddling the top-left border
  // with gradient title text; action buttons stay inside the card.
  cardFloating: { paddingTop: 16 },
  floatingChip: {
    position: 'absolute', top: -13, left: 14, zIndex: 2,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1, borderColor: '#e2e8f0',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 6px rgba(15,23,42,0.08)' }
      : { shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }),
  },
  floatingChipText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },
  // Clearance below the floating title chip (top: -13, ~30px tall) so the
  // header action icons never collide with the chip.
  floatingHeaderRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingTop: 8, marginBottom: 10 },
});
