import React, { useMemo, useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList,} from 'react-native';
import { COLORS, FONTS } from '../styles/theme';
import Icon, { GradientIcon } from '../components/icons';
import UpdateStatusModal from '../components/UpdateStatusModal';

// Reusable order card — the same picker pattern the Orders screen uses, but
// scoped to the single "Update Status" job so the flow is: find → pick → update.
function OrderRow({ order, onPress }) {
  const ref = order?.REFERENCE || order?.AWB_NUMBER || '—';
  const awb = order?.AWB_NUMBER ? `AWB ${order.AWB_NUMBER}` : 'No AWB yet';
  const route = `${order?.ORIGIN_CITY || 'DDN'} → ${order?.DEST_CITY || 'DEST'}`;
  const status = order?.STATE || order?.STATUS || 'Booked';
  return (
    <TouchableOpacity style={styles.orderCard} onPress={onPress} activeOpacity={0.85}>
      <GradientIcon name="status" size={38} iconSize={16} />
      <View style={styles.orderBody}>
        <Text style={styles.orderRef}>{ref}</Text>
        <Text style={styles.orderMeta}>{awb} · {route}</Text>
        <Text style={styles.orderState}>{status}</Text>
      </View>
      <Icon name="forward" size={15} color="#94a3b8" />
    </TouchableOpacity>
  );
}

export default function StatusUpdateScreen({
  orders = [], token = '', apiBase = '', role = 'STAFF', onRefresh,
}) {
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState(null); // order selected for status update
  const [recent, setRecent] = useState([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      [o?.REFERENCE, o?.AWB_NUMBER, o?.CODE, o?.CONSIGNEE, o?.CONSIGNOR, o?.DEST_CITY, o?.ORIGIN_CITY]
        .filter(Boolean).map(String).join('|').toLowerCase().includes(q)
    );
  }, [orders, query]);

  const handleSuccess = (reference, primaryStatus, remark) => {
    setRecent((prev) => [
      { reference, primaryStatus, remark, time: Date.now() },
      ...prev,
    ].slice(0, 10));
    if (onRefresh) onRefresh();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <GradientIcon name="status" size={46} iconSize={20} />
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Update Shipment Status</Text>
          <Text style={styles.heroSub}>Find an order and update its delivery/transit status, POD info, and payment details.</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Icon name="track" size={15} color="#94a3b8" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by REF, AWB, client, city…"
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Icon name="close" size={15} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {recent.length > 0 ? (
        <View style={styles.recentBox}>
          <Text style={styles.sectionTitle}>Recently Updated</Text>
          {recent.map((r, i) => (
            <Text key={`${r.reference}-${i}`} style={styles.recentLine}>
              ✅ {r.reference} → {r.primaryStatus}
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>
        {query ? `Results (${filtered.length})` : `All Shipments (${orders.length})`}
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={(o, i) => o?.REFERENCE || o?.AWB_NUMBER || String(i)}
        renderItem={({ item }) => (
          <OrderRow order={item} onPress={() => setTarget(item)} />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="orders" size={30} color="#cbd5e1" />
            <Text style={styles.emptyText}>No shipments found. Try a different search.</Text>
          </View>
        }
      />

      <UpdateStatusModal
        visible={!!target}
        onClose={() => setTarget(null)}
        order={target}
        token={token}
        apiBase={apiBase}
        role={role}
        onSuccess={handleSuccess}
      />
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
  searchRow: { padding: 16, paddingBottom: 8 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 11, color: '#1e293b', fontFamily: FONTS.body, fontSize: 13 },
  recentBox: { marginHorizontal: 16, marginBottom: 6, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 10, padding: 12 },
  recentLine: { color: '#166534', fontFamily: FONTS.semiBold, fontSize: 11, marginTop: 4 },
  sectionTitle: { color: '#1e293b', fontFamily: FONTS.bold, fontSize: 14, marginHorizontal: 16, marginTop: 6, marginBottom: 8 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 8,
  },
  orderBody: { flex: 1 },
  orderRef: { color: '#1e293b', fontFamily: FONTS.bold, fontSize: 13 },
  orderMeta: { color: '#64748b', fontFamily: FONTS.body, fontSize: 11, marginTop: 2 },
  orderState: { color: COLORS.primary, fontFamily: FONTS.semiBold, fontSize: 10, marginTop: 2, textTransform: 'uppercase' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { color: '#94a3b8', fontFamily: FONTS.body, fontSize: 12, textAlign: 'center' },
});
