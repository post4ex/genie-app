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
// Shell: centralized Tray (sparkle card + gradient header). Actions: centralized
// Button (xs iconOnly). Icons: centralized components/icons registry.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Tray from './Tray';
import Button from './Button';
import { GradientIcon } from './icons';
import GradientText from './GradientText';

const DOC_CENTER_ITEMS = [
  { key: 'Label',       label: 'Shipping Labels',   icon: 'tag',                colors: ['#0ea5e9', '#2563eb'] },
  { key: 'Receipt',     label: 'Customer Copy',     icon: 'receipt',            colors: ['#f59e0b', '#ea580c'] },
  { key: 'POD',         label: 'Proof Of Delivery', icon: 'truck-fast',         colors: ['#10b981', '#0d9488'] },
  { key: 'Office Copy', label: 'Maintenance Copy',  icon: 'screwdriver-wrench', colors: ['#8b5cf6', '#6366f1'] },
  { key: 'Docs + Box',  label: 'Packaging Slip',    icon: 'box-open',           colors: ['#f43f5e', '#ec4899'] },
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
  const headerActions = [
    { key: 'upload',   icon: 'upload',   onPress: () => onUpload(order),      label: 'Upload' },
    { key: 'layout',   icon: 'layout',   onPress: onToggleLayout,             label: 'Toggle Layout' },
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
      right={
        <View style={styles.actionRow}>
          {headerActions.map((a) => (
            <Button
              key={a.key}
              size="xs"
              variant="soft"
              iconOnly
              icon={a.icon}
              onPress={a.onPress}
              accessibilityLabel={a.label}
            />
          ))}
        </View>
      }
    >
      <View style={styles.rows}>
        {DOC_CENTER_ITEMS.map((item) => (
          <View key={item.key} style={styles.row}>
            <GradientIcon name={item.icon} size={20} iconSize={10} colors={item.colors} radius={7} />
            <View style={styles.rowLabelWrap}>
              <GradientText colors={item.colors} style={styles.rowLabel} numberOfLines={1}>{item.label}</GradientText>
            </View>
            <View style={styles.rowActions}>
              <Button size="xs" variant="soft" iconOnly icon="print" onPress={() => onPrintDoc(order, item.key)} accessibilityLabel={`Print ${item.label}`} />
              <Button size="xs" variant="soft" iconOnly icon="envelope" onPress={() => onMailDoc(order, item.key)} accessibilityLabel={`Mail ${item.label}`} />
              <Button size="xs" variant="soft" iconOnly icon="download" onPress={() => onDownloadDoc(order, item.key)} accessibilityLabel={`Download ${item.label}`} />
              <Button size="xs" variant="soft" iconOnly icon="whatsapp" onPress={() => onWhatsAppDoc(order, item.key)} accessibilityLabel={`WhatsApp ${item.label}`} />
            </View>
          </View>
        ))}
      </View>
    </Tray>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end', maxWidth: 220 },
  rows: { borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 7, paddingHorizontal: 2,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  rowLabelWrap: { flex: 1 },
  rowLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  rowActions: { flexDirection: 'row', gap: 5 },
});
