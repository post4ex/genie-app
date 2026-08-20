import React, { useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../styles/theme';
import GradientText from '../components/GradientText';
import Tray from '../components/Tray';
import Button from '../components/Button';
import SearchBar from '../components/SearchBar';
import SegmentedToggle from '../components/SegmentedToggle';
import ListItem from '../components/ListItem';
import Icon, { GradientGlyph } from '../components/icons';
import { useToast } from '../components/Toast';

const PAGE_GRAD = ['#9C2007', '#f59e0b'];

const DIRECTION_MODES = [
  { key: 'inscan', label: 'Inscan', icon: 'arrow-down-bold-box' },
  { key: 'outscan', label: 'Outscan', icon: 'arrow-up-bold-box' },
];

const CATEGORY_MODES = [
  { key: 'pickup', label: 'Pickup', icon: 'dolly' },
  { key: 'runsheet', label: 'Runsheet', icon: 'truck-fast' },
  { key: 'manifest', label: 'Manifest', icon: 'file-document-multiple' },
  { key: 'coload', label: 'Coload', icon: 'truck-cargo-container' },
];

export default function ScanScreen({ orders = [], b2b2cMap = {}, shipmentsMap = {} }) {
  const [direction, setDirection] = useState('inscan'); // 'inscan' | 'outscan'
  const [category, setCategory] = useState('pickup'); // 'pickup' | 'runsheet' | 'manifest' | 'coload'
  const [scanInput, setScanInput] = useState('');
  const [scannedList, setScannedList] = useState([]);
  const showToast = useToast();

  const activeDirCfg = DIRECTION_MODES.find(d => d.key === direction) || DIRECTION_MODES[0];
  const activeCatCfg = CATEGORY_MODES.find(c => c.key === category) || CATEGORY_MODES[0];

  const handleScanSubmit = (scannedVal) => {
    const code = String(scannedVal || scanInput).trim().toUpperCase();
    if (!code) return;

    // Check if already scanned in current session
    if (scannedList.some(item => item.code === code)) {
      showToast({ title: 'Already Scanned', msg: `${code} is already in the scan list`, tone: 'warn' });
      setScanInput('');
      return;
    }

    // Match order record if exists
    const matchedOrder = orders.find(o =>
      String(o?.AWB_NUMBER || '').trim().toUpperCase() === code ||
      String(o?.REFERENCE || '').trim().toUpperCase() === code
    );

    const newItem = {
      id: `${code}-${Date.now()}`,
      code,
      time: Date.now(),
      direction,
      category,
      order: matchedOrder || null,
    };

    setScannedList(prev => [newItem, ...prev]);
    showToast({
      title: `${activeDirCfg.label} · ${activeCatCfg.label}`,
      msg: `Scanned: ${code}${matchedOrder ? ` (${matchedOrder.CONSIGNEE || 'Matched'})` : ''}`,
      tone: 'success',
    });
    setScanInput('');
  };

  const handleRemoveItem = (id) => {
    setScannedList(prev => prev.filter(item => item.id !== id));
  };

  const handleClearBatch = () => {
    setScannedList([]);
    showToast({ title: 'Batch Cleared', msg: 'Scanned list has been reset', tone: 'info' });
  };

  return (
    <View style={styles.container}>
      {/* Page Title */}
      <View style={styles.pageTitleBlock}>
        <GradientText colors={PAGE_GRAD} style={styles.pageTitle}>Scan Operations</GradientText>
        <LinearGradient colors={PAGE_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pageTitleBar} />
      </View>

      {/* ── ROW 1: Inscan ↔ Outscan ── */}
      <View style={styles.toggleRow1}>
        <SegmentedToggle
          options={DIRECTION_MODES}
          value={direction}
          onChange={setDirection}
          colors={PAGE_GRAD}
          size="md"
        />
      </View>

      {/* ── ROW 2: Pickup ↔ Runsheet ↔ Manifest ↔ Coload ── */}
      <View style={styles.toggleRow2}>
        <SegmentedToggle
          options={CATEGORY_MODES}
          value={category}
          onChange={setCategory}
          colors={PAGE_GRAD}
          size="sm"
          flex
        />
      </View>

      {/* ── Barcode Scanner / Manual AWB Input ── */}
      <View style={styles.scanInputRow}>
        <SearchBar
          placeholder={`Scan AWB / Ref for ${activeDirCfg.label} · ${activeCatCfg.label}...`}
          hints={[`Scan AWB for ${activeCatCfg.label}…`, 'Tap barcode button to use camera…']}
          value={scanInput}
          onChangeText={setScanInput}
          onSubmitEditing={() => handleScanSubmit(scanInput)}
          style={{ flex: 1 }}
        />
      </View>

      {/* ── Scanned Items Tray ── */}
      <Tray
        title={`${activeDirCfg.label} · ${activeCatCfg.label} (${scannedList.length})`}
        icon={activeCatCfg.icon}
        iconColors={PAGE_GRAD}
        style={styles.trayFill}
        right={
          scannedList.length > 0 ? (
            <TouchableOpacity onPress={handleClearBatch} hitSlop={8}>
              <Text style={styles.clearText}>Clear All</Text>
            </TouchableOpacity>
          ) : null
        }
      >
        <FlatList
          data={scannedList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const consignee = item.order ? (b2b2cMap[item.order.CONSIGNEE]?.NAME || item.order.CONSIGNEE || 'Matched Shipment') : 'Manual Scan';
            const timeStr = new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return (
              <ListItem
                title={item.code}
                subtitle={[`Type: ${item.direction.toUpperCase()} · ${item.category.toUpperCase()} | Time: ${timeStr}`, consignee]}
                status={item.order ? 'MATCHED' : 'SCANNED'}
                onPress={() => handleRemoveItem(item.id)}
              />
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <GradientGlyph name="barcode-scan" size={42} colors={['#cbd5e1', '#94a3b8']} />
              <Text style={styles.emptyTitle}>No scans in this session</Text>
              <Text style={styles.emptySub}>
                Select {activeDirCfg.label} Mode and {activeCatCfg.label}, then scan package labels using the camera or manual entry.
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </Tray>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingHorizontal: 14, paddingTop: 12 },
  pageTitleBlock: { alignItems: 'center', marginTop: 4, marginBottom: 8 },
  pageTitle: { fontSize: 24, fontWeight: '900', letterSpacing: 0.5 },
  pageTitleBar: { width: 46, height: 3, borderRadius: 2, marginTop: 6 },

  toggleRow1: { alignItems: 'center', marginBottom: 8 },
  toggleRow2: { marginBottom: 14 },

  scanInputRow: { marginBottom: 10 },
  trayFill: { flex: 1 },
  listContent: { paddingTop: 8, paddingBottom: 16 },

  clearText: { color: '#ef4444', fontSize: 11.5, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8, paddingHorizontal: 24 },
  emptyTitle: { color: '#475569', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  emptySub: { color: '#94a3b8', fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 18 },
});
