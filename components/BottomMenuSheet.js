import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Dimensions, Modal, Platform, Animated
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AboutAppPanel from './AboutAppPanel';
import Icon, { GradientIcon } from './icons';
import { COLORS } from '../styles/theme';
import { ROLE_LEVELS } from '../core/config';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Bottom-bar tabs in display order (index = position in the pill bar)
const TABS = [
  { key: 'dashboard', icon: 'home' },
  { key: 'orders', icon: 'orders' },
  { key: 'uploader', icon: 'upload' },
  { key: 'book', icon: 'book' },
  { key: 'status', icon: 'status' },
  { key: 'scan', icon: 'scan' },
  { key: 'menu', icon: 'menu' },
];

// Icon that springs to full size when active, shrinks slightly when idle.
function TabIcon({ active, name, size, iconSize }) {
  const scale = useRef(new Animated.Value(active ? 1 : 0.92)).current;

  useEffect(() => {
    scale.stopAnimation();
    Animated.spring(scale, {
      toValue: active ? 1 : 0.92,
      useNativeDriver: true,
      friction: 5,
      tension: 160,
    }).start();
  }, [active, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <GradientIcon name={name} size={size} iconSize={iconSize} />
    </Animated.View>
  );
}

// Floating pill shadow — web uses boxShadow, native uses elevation
const floatingShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 6px 20px rgba(15, 23, 42, 0.12)' }
  : {
      shadowColor: '#0f172a',
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 8,
    };

export default function BottomMenuSheet({ activeTab, onNavigate, userRole = 'CLIENT' }) {
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState(null); // 'scans' | 'reports'
  const [barWidth, setBarWidth] = useState(0);
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  // Active tab index for the sliding pill (last tab = menu)
  const activeIndex = menuOpen
    ? TABS.length - 1
    : Math.max(0, TABS.findIndex((t) => t.key === activeTab));
  const isActive = (tab) => (tab.key === 'menu' ? menuOpen : activeTab === tab.key);

  useEffect(() => {
    indicatorAnim.stopAnimation();
    Animated.spring(indicatorAnim, {
      toValue: activeIndex,
      useNativeDriver: true,
      friction: 8,
      tension: 90,
    }).start();
  }, [activeIndex, indicatorAnim]);

  const toggleSubmenu = (sub) => {
    setOpenSubmenu(openSubmenu === sub ? null : sub);
  };

  const handleSelect = (tabKey) => {
    setMenuOpen(false);
    onNavigate(tabKey);
  };

  return (
    <View style={[styles.container, { marginBottom: Math.max(insets.bottom + 6, 12) }]}>
      {/* ── 7-Tab Bottom Navigation Bar ── */}
      <View style={styles.bottomBar}>
        <View
          style={styles.tabsRow}
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        >
          {/* Sliding active-pill behind the selected icon (replaces the dot) */}
          {barWidth > 0 && (
            <Animated.View
              style={[
                styles.activePill,
                {
                  width: (barWidth / TABS.length) * 0.62,
                  left: (barWidth / TABS.length) * 0.19,
                  transform: [
                    {
                      translateX: indicatorAnim.interpolate({
                        inputRange: [0, TABS.length - 1],
                        outputRange: [0, (barWidth / TABS.length) * (TABS.length - 1)],
                      }),
                    },
                  ],
                },
              ]}
            />
          )}

          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => (tab.key === 'menu' ? setMenuOpen(true) : handleSelect(tab.key))}
            >
              <TabIcon active={isActive(tab)} name={tab.icon} size={34} iconSize={15} />
            </TouchableOpacity>
          ))}
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
              <Text style={styles.sheetTitle}>Full Menu</Text>
              <Icon name="close" size={17} color="#64748b" style={styles.closeBtnText} />
            </TouchableOpacity>

            <ScrollView style={styles.sheetScroll}>
              {/* Reports Submenu */}
              <Text style={styles.sectionHeader}>REPORTS & ANALYTICS</Text>
              <TouchableOpacity style={styles.submenuAccordionHeader} onPress={() => toggleSubmenu('reports')}>
                <View style={styles.accordionTitleRow}>
                  <GradientIcon name="reports" size={24} iconSize={11} />
                  <Text style={styles.accordionTitle}>Business Reports</Text>
                </View>
                <Icon name={openSubmenu === 'reports' ? 'chevronUp' : 'chevronDown'} size={13} color="#64748b" />
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

              {/* Tools & Business */}
              <Text style={styles.sectionHeader}>BUSINESS & TOOLS</Text>
              <View style={styles.gridRow}>
                <TouchableOpacity style={[styles.menuChip, activeTab === 'calc' && styles.menuChipActive]} onPress={() => handleSelect('calc')}>
                  <GradientIcon name="calc" size={28} iconSize={13} />
                  <Text style={styles.chipLabel}>Rate Estimate</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.menuChip, activeTab === 'pincode' && styles.menuChipActive]} onPress={() => handleSelect('pincode')}>
                  <GradientIcon name="pincode" size={28} iconSize={13} />
                  <Text style={styles.chipLabel}>Pincode Search</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.menuChip, activeTab === 'zipfinder' && styles.menuChipActive]} onPress={() => handleSelect('zipfinder')}>
                  <GradientIcon name="zipfinder" size={28} iconSize={13} />
                  <Text style={styles.chipLabel}>Global ZIP Finder</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.menuChip, activeTab === 'complaint' && styles.menuChipActive]} onPress={() => handleSelect('complaint')}>
                  <GradientIcon name="complaint" size={28} iconSize={13} />
                  <Text style={styles.chipLabel}>Raise Complaint</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuChip} onPress={() => handleSelect('uploader')}>
                  <GradientIcon name="upload" size={28} iconSize={13} />
                  <Text style={styles.chipLabel}>Uploader</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuChip} onPress={() => handleSelect('orders')}>
                  <GradientIcon name="crm" size={28} iconSize={13} />
                  <Text style={styles.chipLabel}>CRM & Clients</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.menuChip, activeTab === 'vault' && styles.menuChipActive]} onPress={() => handleSelect('vault')}>
                  <GradientIcon name="vault" size={28} iconSize={13} />
                  <Text style={styles.chipLabel}>The Vault</Text>
                </TouchableOpacity>
                {(ROLE_LEVELS[userRole] || 0) >= (ROLE_LEVELS.CLIENT || 1) && (
                  <TouchableOpacity style={[styles.menuChip, activeTab === 'admin' && styles.menuChipActive]} onPress={() => handleSelect('admin')}>
                    <GradientIcon name="admin" size={28} iconSize={13} />
                    <Text style={styles.chipLabel}>Masters / Admin</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.menuChip} onPress={() => { setMenuOpen(false); setAboutModalOpen(true); }}>
                  <GradientIcon name="about" size={28} iconSize={13} />
                  <Text style={styles.chipLabel}>About & Updates</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* About App & Updates Panel Sheet */}
      <AboutAppPanel
        visible={aboutModalOpen}
        onClose={() => setAboutModalOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 14,
    borderRadius: 24,
  },
  bottomBar: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingTop: 8,
    paddingBottom: 6,
    overflow: 'hidden',
    ...floatingShadow,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  // Active-tab indicator: a soft pill that springs between the icons.
  activePill: {
    position: 'absolute',
    top: 14,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.10)',
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
    top: 10,
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
  menuChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#fff7f5',
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    marginLeft: 10,
    flex: 1,
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
  accordionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accordionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
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
