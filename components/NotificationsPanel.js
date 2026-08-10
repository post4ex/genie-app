import React from 'react';
import {
  StyleSheet, Modal, View, Text, TouchableOpacity, FlatList,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Web app-notify.js parity
const LEVEL_META = {
  INFO:     { icon: 'ℹ️', color: '#475569', title: 'Information' },
  WARNING:  { icon: '⚠️', color: '#d97706', title: 'Warning' },
  ERROR:    { icon: '❌', color: '#dc2626', title: 'Error' },
  CRITICAL: { icon: '🚨', color: '#dc2626', title: 'Critical Alert' },
  success:  { icon: '✅', color: '#16a34a', title: 'Success' },
  error:    { icon: '⚠️', color: '#dc2626', title: 'Error' },
  info:     { icon: 'ℹ️', color: '#475569', title: 'Information' },
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
      <Text style={styles.itemIcon}>{level.icon}</Text>
      <View style={styles.itemBody}>
        <View style={styles.itemMetaRow}>
          <Text style={[styles.itemTime, { color: level.color }]}>{fmtTs(notif.TIMESTAMP || notif.timestamp)}</Text>
          {isCritical ? <Text style={styles.critBadge}>CRITICAL</Text> : null}
          {!isRead ? <View style={styles.unreadDot} /> : null}
        </View>
        <Text style={styles.itemMsg} numberOfLines={3}>{notif.MESSAGE || notif.message || ''}</Text>
        <View style={styles.itemActions}>
          {!isRead ? (
            <TouchableOpacity onPress={() => onMarkRead(id)} style={styles.actionBtn}>
              <Text style={styles.actionReadText}>✓ Mark read</Text>
            </TouchableOpacity>
          ) : null}
          {canDismiss ? (
            <TouchableOpacity onPress={() => onDismiss(id)} style={styles.actionBtn}>
              <Text style={styles.actionDismissText}>✕ Dismiss</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function NotificationsPanel({
  visible, onClose, notifications = [], onMarkRead, onMarkAllRead, onDismiss, onClearAll,
  canDismissCritical = false,
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Notifications</Text>
              <Text style={styles.subtitle}>{notifications.length} total · {notifications.filter(n => !n.IS_READ).length} unread</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerBtn} onPress={onMarkAllRead}>
                <Text style={styles.headerBtnText}>Mark all read</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerBtn} onPress={onClearAll}>
                <Text style={styles.headerBtnTextDanger}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* List */}
          {notifications.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
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
              contentContainerStyle={{ paddingBottom: 8 }}
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
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '78%',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px -4px 24px rgba(0, 0, 0, 0.18)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 12 }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  title: {
    fontFamily: Platform.OS === 'web' ? 'Montserrat, sans-serif' : 'Montserrat_800ExtraBold',
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerBtn: {
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  headerBtnText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
  },
  headerBtnTextDanger: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  closeBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    flexGrow: 0,
  },
  item: {
    flexDirection: 'row',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  itemUnread: {
    backgroundColor: '#fafcff',
  },
  itemIcon: {
    fontSize: 18,
    marginRight: 10,
    marginTop: 1,
  },
  itemBody: {
    flex: 1,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  itemTime: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  critBadge: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
  },
  itemMsg: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 6,
  },
  actionBtn: {
    paddingVertical: 2,
  },
  actionReadText: {
    color: '#2563eb',
    fontSize: 11.5,
    fontWeight: '600',
  },
  actionDismissText: {
    color: '#94a3b8',
    fontSize: 11.5,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 30,
    marginBottom: 8,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
  },
});
