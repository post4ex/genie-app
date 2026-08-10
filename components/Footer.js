import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../styles/theme';

export default function Footer() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.webFooter, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      <Text style={styles.webFooterText}>© Post4Ex Express Logistics • Assistant to a Postman</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  webFooter: {
    backgroundColor: COLORS.primary,
    paddingTop: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webFooterText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
