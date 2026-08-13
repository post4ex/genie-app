import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { COLORS, FONTS } from '../styles/theme';

const CAPABILITIES = [
  {
    icon: '📦',
    title: 'Order & Shipment Management',
    description: 'End-to-end order lifecycle — book, edit, assign, track, and close shipments from a single dashboard.',
    tint: '#eff6ff',
    accent: '#1d4ed8',
    features: ['Multi-carrier assignment', 'AWB stock management', 'Bulk operations', 'Edit & amend orders'],
  },
  {
    icon: '🚚',
    title: 'Multi-Carrier Integration',
    description: 'Connect with all major logistics partners. Compare rates, auto-assign carriers, and manage all providers from one place.',
    tint: '#ecfdf5',
    accent: '#047857',
    features: ['Rate comparison', 'Auto-allocation logic', 'Carrier-specific configs', 'API-based integration'],
  },
  {
    icon: '🧮',
    title: 'Rate Calculator & Estimation',
    description: 'Real-time freight estimation across carriers with fuel surcharge, GST (IGST/SGST+CGST), and accessorial charges built in.',
    tint: '#fffbeb',
    accent: '#b45309',
    features: ['GST-aware pricing', 'Fuel surcharge', 'Live rate tables', 'Volume & weight calc'],
  },
  {
    icon: '📡',
    title: 'Real-time Tracking',
    description: 'SSE-powered live tracking with milestone updates, carrier scan sync, and customer-facing tracking pages.',
    tint: '#faf5ff',
    accent: '#7e22ce',
    features: ['SSE live updates', 'Milestone mapping', 'Public tracking page', 'Carrier scan sync'],
  },
  {
    icon: '🧾',
    title: 'Document Suite',
    description: 'Generate all shipping and customs documents — commercial invoices, packing lists, tax challans, COO, ARE-1, and 20+ more templates.',
    tint: '#fff1f2',
    accent: '#be123c',
    features: ['20+ document templates', 'Auto-fill from order data', 'Barcode & QR support', 'Print-ready exports'],
  },
  {
    icon: '🔐',
    title: 'Financial Management (Vault)',
    description: 'Full accounting suite — ledger, expenses, payroll, GST returns, purchases, sales invoices, credit notes, and period-end close.',
    tint: '#f0fdfa',
    accent: '#0f766e',
    features: ['Chart of accounts', 'GST reconciliation', 'Payroll processing', 'Journal entries'],
  },
  {
    icon: '👥',
    title: 'B2B & B2C Client Management',
    description: 'Manage corporate clients, retail customers, contracts, credit limits, and service-level agreements — all in one directory.',
    tint: '#eef2ff',
    accent: '#4338ca',
    features: ['Client onboarding', 'Contract & rate mgmt', 'Credit tracking', 'Service agreements'],
  },
  {
    icon: '🏢',
    title: 'Branch & Staff Management',
    description: 'Multi-branch operations with role-based access control, shift management, attendance tracking, and staff performance views.',
    tint: '#ecfeff',
    accent: '#0e7490',
    features: ['Multi-branch setup', 'Role-based access', 'Shift scheduling', 'Attendance system'],
  },
  {
    icon: '🛡️',
    title: 'Admin, Compliance & Configuration',
    description: 'Central admin panel for user management, pincode database, holiday calendar, service modes, carrier configs, and audit logs.',
    tint: '#f8fafc',
    accent: '#334155',
    features: ['Pincode DB (19k+)', 'Holiday calendar', 'Service modes config', 'Audit & activity logs'],
  },
];

export default function ServicesScreen({ onNavigate }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 700;
  const isWide = width >= 1100;
  const cardWidth = isWide ? '31.7%' : isDesktop ? '48.5%' : '100%';

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>
          The Operations OS for{`\n`}Courier &amp; Logistics
        </Text>
        <Text style={styles.heroText}>
          Genie is a unified platform that handles your entire logistics operations — from order booking and carrier allocation to billing, documents, and compliance. Built for Indian courier &amp; freight businesses.
        </Text>
      </View>

      <View style={styles.cardsGrid}>
        {CAPABILITIES.map((capability) => (
          <View key={capability.title} style={[styles.capabilityCard, { width: cardWidth }] }>
            <View style={[styles.iconBox, { backgroundColor: capability.tint }]}>
              <Text style={styles.icon}>{capability.icon}</Text>
            </View>
            <Text style={styles.cardTitle}>{capability.title}</Text>
            <Text style={styles.cardDescription}>{capability.description}</Text>
            <View style={[styles.featureList, { borderTopColor: '#f1f5f9' }]}>
              {capability.features.map((feature) => (
                <View key={feature} style={[styles.featureBadge, { backgroundColor: capability.tint }]}>
                  <Text style={[styles.featureText, { color: capability.accent }]}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.ctaWrap}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Get started with Genie"
          style={styles.ctaButton}
          onPress={() => onNavigate?.('book')}
        >
          <Text style={styles.ctaIcon}>🚀</Text>
          <Text style={styles.ctaText}>Get Started with Genie</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const shadow = Platform.OS === 'web'
  ? { boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)' }
  : { elevation: 3, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } };

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { paddingBottom: 28 },
  hero: {
    backgroundColor: '#022c5a',
    paddingHorizontal: 20,
    paddingVertical: 42,
    alignItems: 'center',
  },
  heroTitle: {
    color: '#ffffff',
    fontFamily: FONTS.extraBold,
    fontSize: 32,
    lineHeight: 39,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroText: {
    maxWidth: 760,
    color: 'rgba(255,255,255,0.82)',
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 16,
  },
  cardsGrid: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  capabilityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 20,
    minHeight: 280,
    ...shadow,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  icon: { fontSize: 27 },
  cardTitle: {
    color: '#1f2937',
    fontFamily: FONTS.bold,
    fontSize: 17,
    lineHeight: 22,
    marginBottom: 7,
  },
  cardDescription: {
    color: '#6b7280',
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 18,
    flexGrow: 1,
  },
  featureList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    borderTopWidth: 1,
    paddingTop: 13,
    marginTop: 14,
  },
  featureBadge: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  featureText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
  },
  ctaWrap: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 30, paddingBottom: 8 },
  ctaButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaIcon: { fontSize: 16, marginRight: 8 },
  ctaText: { color: '#ffffff', fontFamily: FONTS.bold, fontSize: 16 },
});
