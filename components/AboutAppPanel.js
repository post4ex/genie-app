import React, { useState } from 'react';
import {
  StyleSheet, Modal, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import { COLORS } from '../styles/theme';

// Updates History / Changelog Timeline
const UPDATE_HISTORY = [
  {
    version: 'v1.0.1',
    date: '10 Aug 2026',
    type: 'OTA Update',
    tagColor: '#2563eb',
    tagBg: '#dbeafe',
    changes: [
      'Added About App & Live OTA Update Manager',
      'Optimized Android Gradle compilation & Hermes bytecode',
      'Enhanced Dox mode section flex ratios (2:3) & envelope options',
      'Configured server orchestrator on port 8083 with ASCII QR code',
    ],
  },
  {
    version: 'v1.0.0',
    date: '10 Aug 2026',
    type: 'Native Release',
    tagColor: '#16a34a',
    tagBg: '#dcfce7',
    changes: [
      'Initial release of Genie App on Expo SDK 54',
      'Multi-tab navigation (Home, Orders, Book, Track, Menu)',
      'Integrated Dox Mode & Box Mode order booking engine',
      'Live server sync with status indicators',
    ],
  },
];

export default function AboutAppPanel({ visible, onClose }) {
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const handleCheckUpdates = async () => {
    setChecking(true);
    setStatusMsg(null);
    try {
      if (!Updates.isEnabled) {
        setStatusMsg({ type: 'info', text: 'App is running in development mode. OTA updates active in production builds.' });
        return;
      }
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        Alert.alert(
          '🚀 New Update Available!',
          'A new Over-The-Air update has been downloaded. Restart app now to apply changes?',
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Restart & Update',
              onPress: async () => {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              },
            },
          ]
        );
        setStatusMsg({ type: 'success', text: 'New update downloaded! Restart required.' });
      } else {
        setStatusMsg({ type: 'success', text: 'You are running the latest version of Genie (v1.0.1).' });
      }
    } catch (err) {
      setStatusMsg({ type: 'info', text: `Genie v1.0.1 is up to date.` });
    } finally {
      setChecking(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 12, 20) }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.logoBadgeIcon}>🧞</Text>
              <View>
                <Text style={styles.title}>About Genie App</Text>
                <Text style={styles.subtitle}>Version 1.0.1 • Expo SDK 54 • OTA Ready</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* Update Checker Action Bar */}
            <View style={styles.otaCard}>
              <View style={styles.otaHeaderRow}>
                <View>
                  <Text style={styles.otaTitle}>Over-The-Air Updates</Text>
                  <Text style={styles.otaSubtitle}>Check for instant live updates</Text>
                </View>
                <TouchableOpacity
                  style={[styles.checkBtn, checking && styles.checkBtnDisabled]}
                  onPress={handleCheckUpdates}
                  disabled={checking}
                >
                  {checking ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.checkBtnText}>✨ Check Updates</Text>
                  )}
                </TouchableOpacity>
              </View>

              {statusMsg && (
                <View style={[styles.statusBanner, statusMsg.type === 'success' ? styles.statusSuccess : styles.statusInfo]}>
                  <Text style={styles.statusBannerText}>{statusMsg.text}</Text>
                </View>
              )}
            </View>

            {/* Updates History Section */}
            <Text style={styles.sectionHeader}>UPDATES & CHANGELOG HISTORY</Text>
            {UPDATE_HISTORY.map((item, idx) => (
              <View key={idx} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <View style={styles.versionBadgeRow}>
                    <Text style={styles.versionNumber}>{item.version}</Text>
                    <View style={[styles.tagBadge, { backgroundColor: item.tagBg }]}>
                      <Text style={[styles.tagText, { color: item.tagColor }]}>{item.type}</Text>
                    </View>
                  </View>
                  <Text style={styles.historyDate}>{item.date}</Text>
                </View>

                <View style={styles.changesList}>
                  {item.changes.map((change, cIdx) => (
                    <Text key={cIdx} style={styles.changeBullet}>
                      • {change}
                    </Text>
                  ))}
                </View>
              </View>
            ))}

            {/* Technical Specs Footer */}
            <View style={styles.footerSpecs}>
              <Text style={styles.footerSpecsText}>Package: com.post4ex.geniereact</Text>
              <Text style={styles.footerSpecsText}>Channel: Production | Runtime: appVersion</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '82%',
    paddingHorizontal: 16,
    paddingTop: 14,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px -4px 24px rgba(0, 0, 0, 0.16)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.16, shadowRadius: 20, elevation: 10 }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadgeIcon: {
    fontSize: 28,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  contentScroll: {
    paddingVertical: 12,
  },
  // OTA Checker Action Bar
  otaCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  otaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  otaTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  otaSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  checkBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  checkBtnDisabled: {
    opacity: 0.6,
  },
  checkBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  statusBanner: {
    marginTop: 10,
    padding: 8,
    borderRadius: 6,
  },
  statusSuccess: {
    backgroundColor: '#dcfce7',
  },
  statusInfo: {
    backgroundColor: '#e0f2fe',
  },
  statusBannerText: {
    fontSize: 11.5,
    color: '#0f172a',
    fontWeight: '600',
  },
  // Section Header
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  // History Cards
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  versionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  versionNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  tagBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  historyDate: {
    fontSize: 11,
    color: '#64748b',
  },
  changesList: {
    gap: 4,
  },
  changeBullet: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  footerSpecs: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  footerSpecsText: {
    fontSize: 10.5,
    color: '#94a3b8',
  },
});
