import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { COLORS, FONTS } from '../styles/theme';
import { GradientIcon } from '../components/icons';

// Scan module — DRS (Delivery Run Sheet) manifest creation is still in
// concept. This placeholder keeps the bottom-bar entry point live and will be
// replaced by the full scanner + DRS builder screen.
export default function ScanScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <GradientIcon name="scan" size={46} iconSize={20} />
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Scan & DRS</Text>
          <Text style={styles.heroSub}>Barcode scanning and Delivery Run Sheet manifest creation.</Text>
        </View>
      </View>

      <View style={styles.comingSoon}>
        <GradientIcon name="scan" size={64} iconSize={26} />
        <Text style={styles.title}>Coming Soon</Text>
        <Text style={styles.subtitle}>
          This module will create DRS manifests from scanned shipments.{'\n'}
          The concept is being finalized.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  hero: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroCopy: { flex: 1 },
  heroTitle: { color: '#1e293b', fontFamily: FONTS.extraBold, fontSize: 18 },
  heroSub: { color: '#64748b', fontFamily: FONTS.body, fontSize: 12, lineHeight: 17, marginTop: 3 },
  comingSoon: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: { color: '#1e293b', fontFamily: FONTS.extraBold, fontSize: 20, marginTop: 6 },
  subtitle: {
    color: '#64748b',
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
});
