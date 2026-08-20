// components/DocCenterPane.js — Document Center pane (view-pane card #1 of the
// Orders detail view). Extracted from OrdersScreen.js so the whole detail view
// is composed from centralized pane components instead of inline cards.
//
//   <DocCenterPane
//     order={o}
//     onUpload={() => openUpload(o)}
//     onToggleLayout={toggleLabelLayout}
//     onPrintAll={() => printAllDocs(o)}
//     onDownloadAll={() => downloadAllDocs(o)}
//     onMailAll={() => mailShipment(o)}
//     onWhatsAppAll={() => waShipment(o)}
//     onPrintDoc={printDoc}          // (order, docType) => ...
//     onMailDoc={mailDoc}
//     onDownloadDoc={downloadDoc}
//     onWhatsAppDoc={waDoc}
//   />
//
// Shell: centralized Tray (sparkle card + floating gradient title chip).
// Actions: centralized Button (xs soft iconOnly — auto-tinted from
// ACTION_COLORS). Doc-type icons: semantic keys from the central icons.js
// registry — colors resolve automatically from GRADIENTS, so every doc keeps
// its own gradient everywhere in the project.

import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Tray from './Tray';
import Button from './Button';
import IconTray from './IconTray';
import { GradientGlyph, GRADIENTS, withAlpha } from './icons';
import GradientText from './GradientText';

// Semantic keys registered in components/icons.js (ICONS + GRADIENTS).
const DOC_CENTER_ITEMS = [
  { key: 'Label',       name: 'label',       label: 'Shipping Labels',   hint: 'AWB shipping label' },
  { key: 'Docs + Box',  name: 'packaging',   label: 'Packaging Slip',    hint: 'Box contents list' },
  { key: 'POD',         name: 'pod',         label: 'Proof Of Delivery', hint: 'Delivery proof' },
  { key: 'Receipt',     name: 'receipt',     label: 'Customer Copy',     hint: 'B2B receipt copy' },
  { key: 'Office Copy', name: 'officeCopy',  label: 'Maintenance Copy',  hint: 'Office records' },
];

export default function DocCenterPane({
  order,
  onUpload,
  onToggleLayout,
  onPrintAll,
  onDownloadAll,
  onMailAll,
  onWhatsAppAll,
  onPrintDoc,
  onMailDoc,
  onDownloadDoc,
  onWhatsAppDoc,
}) {
  // Top 2 doc rows open by default; the rest collapse behind Show more.
  const [expanded, setExpanded] = useState(false);
  const renderRow = renderRowItem(order, onPrintDoc, onMailDoc, onDownloadDoc, onWhatsAppDoc);

  const headerActions = [
    { key: 'upload',   icon: 'upload',   onPress: () => onUpload(order),      label: 'Upload' },
    { key: 'layout',   icon: 'layout',   onPress: onToggleLayout,             label: 'Layout' },
    { key: 'print',    icon: 'print',    onPress: () => onPrintAll(order),    label: 'Print All' },
    { key: 'download', icon: 'download', onPress: () => onDownloadAll(order), label: 'Download All' },
    { key: 'mail',     icon: 'envelope', onPress: () => onMailAll(order),     label: 'Mail All' },
    { key: 'whatsapp', icon: 'whatsapp', onPress: () => onWhatsAppAll(order), label: 'WhatsApp All' },
  ];

  return (
    <Tray
      title="Document Center"
      colors={['#9C2007', '#f59e0b']}
      floating
      actionTray={
        <IconTray actions={headerActions} />
      }
    >
      <View style={styles.rows}>
        {DOC_CENTER_ITEMS.slice(0, 2).map(renderRow)}
        {expanded ? DOC_CENTER_ITEMS.slice(2).map(renderRow) : null}
      </View>

      {/* Show more / Collapse — same floating-chip box & gradient text as the
          "Document Center" title chip, mirrored to the bottom-right border */}
      <TouchableOpacity
        style={styles.toggleChip}
        activeOpacity={0.8}
        onPress={() => setExpanded(!expanded)}
        accessibilityLabel={expanded ? 'Collapse documents' : 'Show more documents'}
      >
        <GradientGlyph name={expanded ? 'chevron-up' : 'chevron-down'} size={12} colors={['#9C2007', '#f59e0b']} />
        <GradientText colors={['#9C2007', '#f59e0b']} style={styles.toggleText}>
          {expanded ? 'Collapse' : 'Show more'}
        </GradientText>
      </TouchableOpacity>
    </Tray>
  );
}

// Keep the row renderer out of the map callbacks so it can be reused for the
// always-open and expandable groups.
function renderRowItem(order, onPrintDoc, onMailDoc, onDownloadDoc, onWhatsAppDoc) {
  return (item) => {
    const pair = GRADIENTS[item.name];
    return (
      <View key={item.key} style={[styles.row, { backgroundColor: withAlpha(pair[0], 0.045) }]}>
        <GradientGlyph name={item.name} size={30} colors={pair} />
        <View style={styles.rowLabelWrap}>
          <GradientText colors={pair} style={styles.rowLabel} numberOfLines={1}>{item.label}</GradientText>
          <Text style={styles.rowHint} numberOfLines={1}>{item.hint}</Text>
        </View>
        <View style={styles.rowActions}>
          <Button size="xs" variant="tint" iconOnly icon="print" onPress={() => onPrintDoc(order, item.key)} accessibilityLabel={`Print ${item.label}`} />
                <Button size="xs" variant="tint" iconOnly icon="envelope" onPress={() => onMailDoc(order, item.key)} accessibilityLabel={`Mail ${item.label}`} />
                <Button size="xs" variant="tint" iconOnly icon="download" onPress={() => onDownloadDoc(order, item.key)} accessibilityLabel={`Download ${item.label}`} />
                <Button size="xs" variant="tint" iconOnly icon="whatsapp" onPress={() => onWhatsAppDoc(order, item.key)} accessibilityLabel={`WhatsApp ${item.label}`} />
        </View>
      </View>
    );
  };
}

const styles = StyleSheet.create({
  rows: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingBottom: 10 },
  // Show more / Collapse toggle — mirrors the Tray's floating title chip
  // (white pill, hairline border, soft shadow) with brand gradient text.
  toggleChip: {
    position: 'absolute', bottom: -13, right: 14, zIndex: 3,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1, borderColor: '#e2e8f0',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 6px rgba(15,23,42,0.08)' }
      : { shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }),
  },
  toggleText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 8, borderRadius: 10,
    marginTop: 6,
  },
  rowLabelWrap: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 13, fontWeight: '900', letterSpacing: 0.2 },
  rowHint: { fontSize: 10, fontWeight: '600', color: '#94a3b8', marginTop: 1 },
  rowActions: { flexDirection: 'row', gap: 5 },
});
