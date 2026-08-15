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
  children,
}) {
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
});
