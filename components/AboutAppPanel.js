import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Modal, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Linking, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import packageJson from '../package.json';
import { COLORS } from '../styles/theme';

const CURRENT_VERSION = `v${packageJson.version}`;

// Updates History / Changelog Timeline
const UPDATE_HISTORY = [
  {
    version: 'v1.0.9',
    date: '11 Aug 2026',
    type: 'Native & OTA',
    tagColor: '#16a34a',
    tagBg: '#dcfce7',
    changes: [
      'Sub-second SQLite batch upsert optimization (bulk Map pre-fetching)',
      'Mobile AppState foreground resume event catch-up listener',
      'Periodic 5-minute client parity audit & targeted recovery',
      'Dynamic versioning alignment from package.json manifest',
    ],
  },
  {
    version: 'v1.0.8',
    date: '11 Aug 2026',
    type: 'Native Replica',
    tagColor: '#2563eb',
    tagBg: '#dbeafe',
    changes: [
      'Durable expo-sqlite native database engine (genie_replica.db)',
      '1-minute overlap safety net catch-up integration',
      'Account-scoped multi-user cache protection & instant rendering',
      'Aligned SHIPMENTS primary key field to id across backend & frontend',
    ],
  },
  {
    version: 'v1.0.3',
    date: '10 Aug 2026',
    type: 'Native & OTA',
    tagColor: '#64748b',
    tagBg: '#f1f5f9',
    changes: [
      'High-resolution Genie app launcher icons & splash branding',
      'Integrated GitHub Releases live API update checker',
      'Notification-style About App panel with changelog timeline',
      'Direct 1-tap APK downloader from GitHub Releases',
    ],
  },
];

export default function AboutAppPanel({ visible, onClose }) {
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(false);
  const [latestRelease, setLatestRelease] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    if (visible) {
      checkGitHubReleases();
    }
  }, [visible]);

  const checkGitHubReleases = async () => {
    try {
      const res = await fetch('https://api.github.com/repos/post4ex/genie-app/releases/latest');
      if (res.ok) {
        const data = await res.json();
        const tag = data.tag_name || 'v1.0.3';
        const apkAsset = (data.assets || []).find(a => a.name.endsWith('.apk')) || data.assets[0];
        setLatestRelease({
          tag,
          name: data.name || tag,
          url: apkAsset ? apkAsset.browser_download_url : data.html_url,
          publishedAt: data.published_at,
          isNewer: tag !== CURRENT_VERSION,
        });
      }
    } catch (e) {
      console.log('GitHub Release check error:', e);
    }
  };

  const handleCheckUpdates = async () => {
    setChecking(true);
    setStatusMsg(null);
    try {
      await checkGitHubReleases();

      // Also check Expo OTA updates
      if (Updates.isEnabled) {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          Alert.alert(
            '🚀 New Over-The-Air Update Available!',
            'An instant update has been downloaded. Restart app now to apply?',
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
          setStatusMsg({ type: 'success', text: 'OTA Update downloaded! Tap restart to apply.' });
          return;
        }
      }

      if (latestRelease && latestRelease.isNewer) {
        setStatusMsg({ type: 'highlight', text: `New Release ${latestRelease.tag} available on GitHub!` });
      } else {
        setStatusMsg({ type: 'success', text: `Genie is running the latest release (${CURRENT_VERSION}).` });
      }
    } catch (err) {
      setStatusMsg({ type: 'info', text: `Genie ${CURRENT_VERSION} is up to date.` });
    } finally {
      setChecking(false);
    }
  };

  const handleDownloadRelease = () => {
    if (latestRelease && latestRelease.url) {
      Linking.openURL(latestRelease.url);
    } else {
      Linking.openURL('https://github.com/post4ex/genie-app/releases/latest');
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
                <Text style={styles.subtitle}>Installed: {CURRENT_VERSION} • Expo SDK 54</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* GitHub Live Release & OTA Action Card */}
            <View style={styles.otaCard}>
              <View style={styles.otaHeaderRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.otaTitle}>GitHub & OTA Updates</Text>
                  <Text style={styles.otaSubtitle}>
                    {latestRelease ? `Latest GitHub Release: ${latestRelease.tag}` : 'Checking GitHub Releases...'}
                  </Text>
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

              {/* Direct APK Download Button if New Version Available on GitHub */}
              {latestRelease && (
                <TouchableOpacity style={styles.downloadApkBtn} onPress={handleDownloadRelease}>
                  <Text style={styles.downloadApkBtnText}>
                    📥 Download APK ({latestRelease.tag}) from GitHub
                  </Text>
                </TouchableOpacity>
              )}

              {statusMsg && (
                <View style={[
                  styles.statusBanner,
                  statusMsg.type === 'success' ? styles.statusSuccess :
                  statusMsg.type === 'highlight' ? styles.statusHighlight : styles.statusInfo
                ]}>
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
              <Text style={styles.footerSpecsText}>Repository: post4ex/genie-app</Text>
              <Text style={styles.footerSpecsText}>Package: com.post4ex.geniereact</Text>
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
  // OTA & GitHub Release Card
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
  downloadApkBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  downloadApkBtnText: {
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
  statusHighlight: {
    backgroundColor: '#fef3c7',
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
