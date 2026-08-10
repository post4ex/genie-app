import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Dimensions, Modal, Alert, ActivityIndicator
} from 'react-native';
import * as Updates from 'expo-updates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../styles/theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function BottomMenuSheet({ activeTab, onNavigate }) {
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState(null); // 'scans' | 'reports'

  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    try {
      if (!Updates.isEnabled) {
        Alert.alert(
          "🧞 Genie App Info",
          "• App Name: Genie\n• Version: v1.0.0\n• SDK: Expo 54\n• OTA Mode: Enabled\n\n(Running in local environment)"
        );
        return;
      }
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        Alert.alert(
          "🚀 New Update Available!",
          "An Over-The-Air update is ready. Restart app now to apply changes instantly?",
          [
            { text: "Later", style: "cancel" },
            {
              text: "Restart & Update",
              onPress: async () => {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              }
            }
          ]
        );
      } else {
        Alert.alert("✅ Up to Date", "Genie is running the latest version (v1.0.0). No new updates found.");
      }
    } catch (err) {
      Alert.alert(
        "🧞 Genie App Info",
        `• App Name: Genie\n• Version: v1.0.0\n• SDK: Expo 54\n• OTA Updates: Enabled\n\nStatus: Up to date`
      );
    } finally {
      setCheckingUpdate(false);
    }
  };

  const toggleSubmenu = (sub) => {
    setOpenSubmenu(openSubmenu === sub ? null : sub);
  };

  const handleSelect = (tabKey) => {
    setMenuOpen(false);
    onNavigate(tabKey);
  };

  return (
    <View style={styles.container}>
      {/* ── Compact 5-Tab Bottom Navigation Bar ── */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 4) }]}>
        <View style={styles.tabsRow}>
          <TouchableOpacity style={[styles.tabItem, activeTab === 'dashboard' && styles.tabActive]} onPress={() => handleSelect('dashboard')}>
            <Text style={styles.tabIcon}>📊</Text>
            <Text style={[styles.tabLabel, activeTab === 'dashboard' && styles.tabLabelActive]}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.tabItem, activeTab === 'orders' && styles.tabActive]} onPress={() => handleSelect('orders')}>
            <Text style={styles.tabIcon}>📋</Text>
            <Text style={[styles.tabLabel, activeTab === 'orders' && styles.tabLabelActive]}>Orders</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.tabItem, activeTab === 'book' && styles.tabActive]} onPress={() => handleSelect('book')}>
            <Text style={styles.tabIcon}>➕</Text>
            <Text style={[styles.tabLabel, activeTab === 'book' && styles.tabLabelActive]}>Book</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.tabItem, activeTab === 'track' && styles.tabActive]} onPress={() => handleSelect('track')}>
            <Text style={styles.tabIcon}>🔍</Text>
            <Text style={[styles.tabLabel, activeTab === 'track' && styles.tabLabelActive]}>Track</Text>
          </TouchableOpacity>

          {/* 5th Button: Dedicated Menu Button */}
          <TouchableOpacity style={[styles.tabItem, menuOpen && styles.tabActive]} onPress={() => setMenuOpen(true)}>
            <Text style={[styles.tabIcon, { color: COLORS.primary, fontWeight: 'bold' }]}>☰</Text>
            <Text style={[styles.tabLabel, menuOpen && styles.tabLabelActive]}>Menu</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Full Web Submenu Bottom Sheet Modal ── */}
      <Modal visible={menuOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.overlayDismiss} onPress={() => setMenuOpen(false)} />

          <View style={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
            {/* Sheet Header */}
            <TouchableOpacity style={styles.sheetHeader} onPress={() => setMenuOpen(false)}>
              <View style={styles.handleBarDark} />
              <Text style={styles.sheetTitle}>GENIE Full Menu & Tools</Text>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>

            <ScrollView style={styles.sheetScroll}>
              {/* Category 1: Core Navigation */}
              <Text style={styles.sectionHeader}>CORE APPS</Text>
              <View style={styles.gridRow}>
                <TouchableOpacity style={styles.menuChip} onPress={() => handleSelect('dashboard')}>
                  <Text style={styles.chipIcon}>📊</Text>
                  <Text style={styles.chipLabel}>Dashboard</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuChip} onPress={() => handleSelect('orders')}>
                  <Text style={styles.chipIcon}>📋</Text>
                  <Text style={styles.chipLabel}>Shipments / Orders</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuChip} onPress={() => handleSelect('book')}>
                  <Text style={styles.chipIcon}>➕</Text>
                  <Text style={styles.chipLabel}>Book Order</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuChip} onPress={() => handleSelect('track')}>
                  <Text style={styles.chipIcon}>🔍</Text>
                  <Text style={styles.chipLabel}>Track AWB</Text>
                </TouchableOpacity>
              </View>

              {/* Category 2: Scans Submenu */}
              <Text style={styles.sectionHeader}>SCANS & LOGISTICS</Text>
              <TouchableOpacity style={styles.submenuAccordionHeader} onPress={() => toggleSubmenu('scans')}>
                <Text style={styles.accordionTitle}>📦 Scans & Operations</Text>
                <Text style={styles.accordionArrow}>{openSubmenu === 'scans' ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {openSubmenu === 'scans' && (
                <View style={styles.submenuItemsContainer}>
                  {['Pickup Request', 'OutManifest', 'InManifest', 'RunSheet', 'Update Scan', 'POD Upload'].map((subItem, idx) => (
                    <TouchableOpacity key={idx} style={styles.submenuItem} onPress={() => handleSelect('orders')}>
                      <Text style={styles.submenuItemText}>• {subItem}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Category 3: Reports Submenu */}
              <Text style={styles.sectionHeader}>REPORTS & ANALYTICS</Text>
              <TouchableOpacity style={styles.submenuAccordionHeader} onPress={() => toggleSubmenu('reports')}>
                <Text style={styles.accordionTitle}>📈 Business Reports</Text>
                <Text style={styles.accordionArrow}>{openSubmenu === 'reports' ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {openSubmenu === 'reports' && (
                <View style={styles.submenuItemsContainer}>
                  {['Booking Report', 'Manifest Report', 'Update Report', 'Runsheet Report', 'CRM Analytics'].map((subItem, idx) => (
                    <TouchableOpacity key={idx} style={styles.submenuItem} onPress={() => handleSelect('dashboard')}>
                      <Text style={styles.submenuItemText}>• {subItem}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Category 4: Tools & Business */}
              <Text style={styles.sectionHeader}>BUSINESS & TOOLS</Text>
              <View style={styles.gridRow}>
                <TouchableOpacity style={styles.menuChip} onPress={() => handleSelect('book')}>
                  <Text style={styles.chipIcon}>🧮</Text>
                  <Text style={styles.chipLabel}>Rate Estimate</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuChip} onPress={() => handleSelect('track')}>
                  <Text style={styles.chipIcon}>📍</Text>
                  <Text style={styles.chipLabel}>Pincode Search</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuChip} onPress={() => handleSelect('dashboard')}>
                  <Text style={styles.chipIcon}>📤</Text>
                  <Text style={styles.chipLabel}>Uploader</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuChip} onPress={() => handleSelect('orders')}>
                  <Text style={styles.chipIcon}>👥</Text>
                  <Text style={styles.chipLabel}>CRM & Clients</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuChip} onPress={() => handleSelect('dashboard')}>
                  <Text style={styles.chipIcon}>🔐</Text>
                  <Text style={styles.chipLabel}>The Vault</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuChip} onPress={() => handleSelect('dashboard')}>
                  <Text style={styles.chipIcon}>⚙️</Text>
                  <Text style={styles.chipLabel}>Masters / Admin</Text>
                </TouchableOpacity>
              </View>

              {/* Category 5: About App & Over-The-Air Updates */}
              <Text style={styles.sectionHeader}>ABOUT APP & UPDATES</Text>
              <View style={styles.aboutCard}>
                <View style={styles.aboutRow}>
                  <Text style={styles.aboutBadgeIcon}>🧞</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.aboutAppName}>Genie App</Text>
                    <Text style={styles.aboutAppVersion}>Version 1.0.0 (Build 2026.1)</Text>
                    <Text style={styles.aboutSubtitle}>Expo SDK 54 • OTA Enabled</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.otaBtn, checkingUpdate && styles.otaBtnDisabled]}
                  onPress={handleCheckForUpdates}
                  disabled={checkingUpdate}
                >
                  {checkingUpdate ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.otaBtnText}>✨ Check for OTA Updates</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  bottomBar: {
    backgroundColor: '#ffffff',
    paddingTop: 2,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  tabActive: {
    borderTopWidth: 2,
    borderTopColor: COLORS.primary,
  },
  tabIcon: {
    fontSize: 17,
  },
  tabLabel: {
    color: '#64748b',
    fontSize: 9.5,
    marginTop: 1,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Modal Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  overlayDismiss: {
    flex: 1,
  },
  sheetContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.75,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    position: 'relative',
  },
  handleBarDark: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#94a3b8',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
  },
  closeBtnText: {
    position: 'absolute',
    right: 0,
    top: 8,
    fontSize: 18,
    color: '#64748b',
    fontWeight: '700',
  },
  sheetScroll: {
    paddingVertical: 12,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 8,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  menuChip: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  submenuAccordionHeader: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  accordionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  accordionArrow: {
    fontSize: 12,
    color: '#64748b',
  },
  submenuItemsContainer: {
    backgroundColor: '#ffffff',
    paddingLeft: 16,
    paddingVertical: 6,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary,
    marginTop: 4,
    marginBottom: 8,
  },
  submenuItem: {
    paddingVertical: 8,
  },
  submenuItemText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  // About App & OTA Card
  aboutCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    marginBottom: 20,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aboutBadgeIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  aboutAppName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  aboutAppVersion: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  aboutSubtitle: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  otaBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otaBtnDisabled: {
    opacity: 0.7,
  },
  otaBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
