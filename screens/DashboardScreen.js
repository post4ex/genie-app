import React from 'react';
import { StyleSheet, Text, View, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { COLORS } from '../styles/theme';

export default function DashboardScreen({ orders, shipmentsMap = {}, refreshing, onRefresh, onNavigate }) {
  // 1. Overall Stats linked with SHIPMENTS sheet state
  const totalOrders = orders.length;

  const getShipmentState = (o) => {
    const ref = o.REFERENCE || o.id;
    const s = shipmentsMap[ref] || {};
    return (s.state || s.STATE || o.STATE || o.STATUS || o.DELIVERY_STATUS || '').toString().toLowerCase();
  };
  
  const inTransitCount = orders.filter(o => {
    const st = getShipmentState(o);
    return st === 'intransit' || st.includes('transit') || st.includes('dispatch') || st.includes('shipped') || st.includes('way') || st === 'outfordelivery' || st.includes('out for delivery');
  }).length;

  const deliveredCount = orders.filter(o => {
    const st = getShipmentState(o);
    return st === 'delivered' || st.includes('deliver') || st.includes('complete') || st.includes('success');
  }).length;

  // 2. Bookings Last 7 Days Analysis
  const today = new Date();
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short' });
    const isoDate = d.toISOString().split('T')[0];
    
    const count = orders.filter(o => {
      const ts = o.ORDER_DATE || o.TIME_STAMP || o.REQ_TIME;
      if (!ts) return false;
      try {
        const orderDate = new Date(ts).toISOString().split('T')[0];
        return orderDate === isoDate;
      } catch (e) {
        return false;
      }
    }).length;

    last7Days.push({ label: dayLabel, count });
  }
  const max7DaysCount = Math.max(...last7Days.map(d => d.count), 1);

  // 3. Top Destinations Analysis (Limit to Top 4 for compact mobile layout)
  const cityMap = {};
  orders.forEach(o => {
    const city = (o.DEST_CITY || 'DEHRADUN').trim().toUpperCase();
    cityMap[city] = (cityMap[city] || 0) + 1;
  });
  const topDestinations = Object.entries(cityMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const maxCityCount = Math.max(...topDestinations.map(d => d[1]), 1);

  return (
    <ScrollView style={styles.scrollPage} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}>
      <Text style={styles.pageTitle}>Dashboard</Text>

      {/* ── Summary Stats Cards matching Web ── */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{totalOrders}</Text>
          <Text style={styles.statLbl}>Total Orders</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: '#ea580c' }]}>{inTransitCount}</Text>
          <Text style={styles.statLbl}>In Transit</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: '#10b981' }]}>{deliveredCount}</Text>
          <Text style={styles.statLbl}>Delivered</Text>
        </View>
      </View>

      {/* ── Web Tray 1: Bookings — Last 7 Days ── */}
      <View style={styles.trayCard}>
        <Text style={styles.trayTitle}>Bookings — Last 7 Days</Text>
        <View style={styles.barChartContainer}>
          {last7Days.map((d, idx) => {
            const heightPercent = Math.max((d.count / max7DaysCount) * 100, 8);
            return (
              <View key={idx} style={styles.barCol}>
                <Text style={styles.barValText}>{d.count}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${heightPercent}%` }]} />
                </View>
                <Text style={styles.barLblText}>{d.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Web Tray 2: Top Destinations ── */}
      <View style={styles.trayCard}>
        <Text style={styles.trayTitle}>Top Destinations</Text>
        {topDestinations.map(([city, count], idx) => {
          const widthPercent = (count / maxCityCount) * 100;
          return (
            <View key={idx} style={styles.horizBarRow}>
              <View style={styles.horizBarInfo}>
                <Text style={styles.horizBarLbl}>📍 {city}</Text>
                <Text style={styles.horizBarVal}>{count} pkgs</Text>
              </View>
              <View style={styles.horizBarTrack}>
                <View style={[styles.horizBarFill, { width: `${widthPercent}%` }]} />
              </View>
            </View>
          );
        })}
      </View>

      {/* ── Quick Actions Grid ── */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onNavigate('book')}>
          <Text style={styles.actionIcon}>📦</Text>
          <Text style={styles.actionText}>Book Order</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onNavigate('track')}>
          <Text style={styles.actionIcon}>🔎</Text>
          <Text style={styles.actionText}>Track AWB</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onNavigate('orders')}>
          <Text style={styles.actionIcon}>📋</Text>
          <Text style={styles.actionText}>All Orders</Text>
        </TouchableOpacity>
      </View>

      {/* ── Recent Orders ── */}
      <Text style={styles.sectionTitle}>Recent Orders</Text>
      {orders.slice(0, 5).map((ord, idx) => {
        const stateStr = getShipmentState(ord).toUpperCase();
        return (
          <View key={idx} style={styles.orderCard}>
            <View style={styles.orderHeader}>
              <Text style={styles.orderRef}>{ord.REFERENCE || ord.id}</Text>
              <View style={styles.badgeState}>
                <Text style={styles.badgeStateText}>{stateStr || 'BOOKED'}</Text>
              </View>
            </View>
            <Text style={styles.orderMeta}>AWB: {ord.AWB_NUMBER || 'Pending'} | Carrier: {ord.CARRIER || 'JetLine'}</Text>
            <Text style={styles.orderRoute}>📍 {ord.ORIGIN_CITY || 'DDN'} → 🏁 {ord.DEST_CITY || 'DEST'}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollPage: { flex: 1, padding: 16 },
  pageTitle: { color: '#1e293b', fontSize: 24, fontWeight: '800', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#ffffff', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#e8c98a' },
  statVal: { color: '#1e293b', fontSize: 22, fontWeight: '800' },
  statLbl: { color: '#64748b', fontSize: 11, marginTop: 2 },
  
  // Compact Web Tray Cards matching #9C2007 web design
  trayCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1.5, borderColor: '#e8c98a', elevation: 2 },
  trayTitle: { color: '#1e293b', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  
  // Bar Chart Styles
  barChartContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 95, paddingTop: 6 },
  barCol: { alignItems: 'center', width: 34 },
  barValText: { color: '#64748b', fontSize: 10, fontWeight: '600', marginBottom: 3 },
  barTrack: { width: 12, height: 65, backgroundColor: '#f1f5f9', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { backgroundColor: COLORS.primary, width: '100%', borderRadius: 6 },
  barLblText: { color: '#475569', fontSize: 10, fontWeight: '600', marginTop: 4 },

  // Horizontal Bar Styles (Compact)
  horizBarRow: { marginBottom: 8 },
  horizBarInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  horizBarLbl: { color: '#1e293b', fontSize: 12, fontWeight: '600' },
  horizBarVal: { color: '#64748b', fontSize: 11 },
  horizBarTrack: { height: 7, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  horizBarFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },

  sectionTitle: { color: '#475569', fontSize: 14, fontWeight: '700', marginTop: 6, marginBottom: 10 },
  actionGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionBtn: { flex: 1, backgroundColor: '#ffffff', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  actionIcon: { fontSize: 22, marginBottom: 4 },
  actionText: { color: '#1e293b', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  orderCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderRef: { color: '#1e293b', fontSize: 14, fontWeight: '700' },
  badgeState: { backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeStateText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  orderMeta: { color: '#64748b', fontSize: 11, marginBottom: 4 },
  orderRoute: { color: '#334155', fontSize: 12, fontWeight: '600' },
});
