// components/NotificationsPanel.js — Notifications bottom sheet, redesigned on
// the app's shared components (GradientText title, GradientGlyph level chips,
// tinted Button actions, card rows with sparkle unread treatment).
// Web app-notify.js parity — levels, mark-read/dismiss/clear, critical gating.

import React from 'react';
import {
  StyleSheet, Modal, View, Text, FlatList,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientText from './GradientText';
import Button from './Button';
import Icon, { GradientGlyph } from './icons';
import { accentSparkle } from './Tile';

// Level identity — gradient glyph chip + accent colour per level (web parity).
const LEVEL_META = {
  INFO:     { icon: 'information',        grad: ['#64748b', '#94a3b8'], tint: '#f1f5f9', color: '#475569', title: 'Information' },
  WARNING:  { icon: 'alert-outline',      grad: ['#d97706', '#f59e0b'], tint: '#fffbeb', color: '#b45309', title: 'Warning' },
  ERROR:    { icon: 'alert-circle-outline', grad: ['#dc2626', '#ef4444'], tint: '#fef2f2', color: '#b91c1c', title: 'Error' },
  CRITICAL: { icon: 'shield-alert',       grad: ['#9C2007', '#dc2626'], tint: '#fde8e8', color: '#9C2007', title: 'Critical Alert' },
  success:  { icon: 'check-circle',       grad: ['#16a34a', '#22c55e'], tint: '#f0fdf4', color: '#15803d', title: 'Success' },
  error:    { icon: 'alert-circle-outline', grad: ['#dc2626', '#ef4444'], tint: '#fef2f2', color: '#b91c1c', title: 'Error' },
  info:     { icon: 'information',        grad: ['#64748b', '#94a3b8'], tint: '#f1f5f9', color: '#475569', title: 'Information' },
};

const fmtTs = (ts) => {
  if (!ts) return '';
  let n = typeof ts === 'string' && isNaN(Number(ts)) ? NaN : Number(ts);
  let d;
  if (!isNaN(n)) {
    if (n < 1e12) n *= 1000; // seconds → ms
    d = new Date(n);
  } else {
    d = new Date(ts); // ISO string
  }
  if (isNaN(d.getTime())) return String(ts);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function NotifItem({ notif, onMarkRead, onDismiss, canDismissCritical }) {
  const level = LEVEL_META[notif.LEVEL || notif.type || 'INFO'] || LEVEL_META.INFO;
  const isRead = notif.IS_READ === true;
  const isCritical = (notif.LEVEL || notif.type) === 'CRITICAL';
  const canDismiss = !isCritical || canDismissCritical; // web: CRITICAL is admin-only
  const id = notif.NOTIF_ID || notif.id;

  return (
    <View style={[styles.item, !isRead && styles.itemUnread]}>
      {/* Level chip — gradient glyph disc on the level tint */}
      <View style={[styles.itemIconWrap, { backgroundColor: level.tint }]}>
        <GradientGlyph name={level.icon} size={17} colors={level.grad} />
      </View>

      <View style={styles.itemBody}>
        <View style={styles.itemMetaRow}>
          <Text style={[styles.itemTime, { color: level.color }]}>{fmtTs(notif.TIMESTAMP || notif.timestamp)}</Text>
          <Text style={[styles.itemLevelTag, { color: level.color, backgroundColor: level.tint }]}>{level.title}</Text>
          {!isRead ? <View style={styles.unreadDot} /> : null}
          {/* Read / dismiss — right side of the date-time info row */}
          <View style={styles.metaActions}>
            {!isRead ? (
              <Button
                variant="tint"
                size="xs"
                iconOnly
                icon="emailOpen"
                onPress={() => onMarkRead(id)}
                accessibilityLabel="Mark read"
              />
            ) : null}
            {canDismiss ? (
              <Button
                variant="tint"
                size="xs"
                iconOnly
                icon="close"
                onPress={() => onDismiss(id)}
                accessibilityLabel="Dismiss"
              />
            ) : null}
          </View>
        </View>
        <Text style={styles.itemMsg} numberOfLines={3}>{notif.MESSAGE || notif.message || ''}</Text>
      </View>
    </View>
  );
}

export default function NotificationsPanel({
  visible, onClose, notifications = [], onMarkRead, onMarkAllRead, onDismiss, onClearAll,
  canDismissCritical = false,
}) {
  const insets = useSafeAreaInsets();
  const unread = notifications.filter(n => !n.IS_READ).length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconWrap}>
                <GradientGlyph name="bell" size={19} colors={['#9C2007', '#f59e0b']} />
              </View>
              <View>
                <GradientText colors={['#9C2007', '#f59e0b']} style={styles.title}>Notifications</GradientText>
                <Text style={styles.subtitle}>
                  {notifications.length} total · {unread} unread
                </Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <Button
                variant="tint"
                size="sm"
                iconOnly
                icon="emailOpen"
                onPress={onMarkAllRead}
                accessibilityLabel="Mark all read"
              />
              <Button
                variant="tint"
                size="sm"
                iconOnly
                icon="trash"
                onPress={onClearAll}
                accessibilityLabel="Clear notifications"
              />
              <Button
                variant="tint"
                size="sm"
                iconOnly
                icon="close"
                onPress={onClose}
                accessibilityLabel="Close notifications"
              />
            </View>
          </View>

          {/* List */}
          {notifications.length === 0 ? (
            <View style={styles.empty}>
              <GradientGlyph name="bell" size={40} colors={['#cbd5e1', '#94a3b8']} />
              <Text style={styles.emptyText}>No new notifications</Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item, index) => String(item.NOTIF_ID || item.id || index)}
              renderItem={({ item }) => (
                <NotifItem notif={item} onMarkRead={onMarkRead} onDismiss={onDismiss} canDismissCritical={canDismissCritical} />
              )}
              style={styles.list}
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 10 }}
              initialNumToRender={15}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '82%',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px -4px 24px rgba(0, 0, 0, 0.18)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 12 }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fdfbff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#fde8e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '900' },
  subtitle: { fontSize: 10.5, color: '#64748b', marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  list: { flexGrow: 0 },

  // Item — card row with level chip + message + tinted actions
  item: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    marginTop: 8,
    gap: 10,
  },
  itemUnread: {
    backgroundColor: '#fdfbff',
    borderColor: '#e9d5ff',
    ...accentSparkle('#e879f9'),
  },
  itemIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  itemBody: { flex: 1, minWidth: 0 },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  metaActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  itemTime: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  itemLevelTag: {
    fontSize: 8.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e879f9',
    shadowColor: '#e879f9',
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  itemMsg: {
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18,
    fontWeight: '600',
  },

  // Empty state
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
});
