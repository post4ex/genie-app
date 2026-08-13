import React, { useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Platform, Animated, Easing
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Polyline, Line, Circle } from 'react-native-svg';
import { COLORS } from '../styles/theme';

// Sync status colors — dot on the refresh (sync) icon
const STATUS_COLORS = {
  live:        '#16a34a', // green — SSE connected
  streaming:   '#d97706', // amber — full sync in progress
  syncing:     '#d97706',
  reconnecting:'#ef4444', // red — stream down / retrying
  idle:        '#94a3b8', // gray
  offline:     '#94a3b8',
};

const STATUS_LABEL = {
  live:         'Live',
  streaming:    'Syncing…',
  syncing:      'Syncing…',
  reconnecting: 'Reconnecting…',
  idle:         'Sync',
  offline:      'Offline',
};

export default function Header({
  user, onRefresh, onNotif, onLogout, onTrack,
  unreadCount = 0, syncStatus = 'idle', refreshing = false,
}) {
  const insets = useSafeAreaInsets();
  const spin = useRef(new Animated.Value(0)).current;

  const syncing = refreshing || syncStatus === 'streaming' || syncStatus === 'syncing';
  const statusColor = STATUS_COLORS[syncStatus] || STATUS_COLORS.idle;

  useEffect(() => {
    if (syncing) {
      const anim = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      anim.start();
      return () => anim.stop();
    }
    spin.setValue(0);
  }, [syncing, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[styles.webHeader, { paddingTop: Math.max(insets.top, 10), height: 58 + Math.max(insets.top, 10) }]}>
      {/* Left: Genie Official Logo + Subtitle */}
      <View style={styles.webHeaderLeft}>
        <View style={styles.logoBadgeRow}>
          <Text style={styles.logoTextBold}>
            🧞 <Text style={{ color: '#9C2007' }}>Gen</Text>
            <Text style={{ color: '#F59E0B' }}>i</Text>
            <Text style={{ color: '#022c5a' }}>e</Text>
          </Text>
          <Text style={styles.logoSubtitle}>Assistant to a Postman</Text>
        </View>
      </View>

      {/* Right: SVG Action Icons */}
      <View style={styles.webHeaderRight}>
        {user ? (
          <>
            {/* Track AWB Icon — switches to Track tab */}
            <TouchableOpacity
              style={styles.iconBtnCircle}
              onPress={onTrack}
              accessibilityLabel="Track AWB"
            >
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <Circle cx="11" cy="11" r="8" />
                <Line x1="21" y1="21" x2="16.65" y2="16.65" />
              </Svg>
            </TouchableOpacity>

            {/* Sync Icon — spins while syncing, dot shows connection status */}
            <TouchableOpacity
              style={styles.iconBtnCircle}
              onPress={onRefresh}
              accessibilityLabel={STATUS_LABEL[syncStatus] || 'Sync'}
            >
              <Animated.View style={{ transform: [{ rotate }] }}>
                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={statusColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M23 4v6h-6" />
                  <Path d="M1 20v-6h6" />
                  <Path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                </Svg>
              </Animated.View>
              <View style={[styles.syncStatusDot, { backgroundColor: statusColor }]} />
            </TouchableOpacity>

            {/* Notification Bell Icon */}
            <TouchableOpacity style={styles.iconBtnCircle} onPress={onNotif}>
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <Path d="M13.73 21a2 2 0 01-3.46 0" />
              </Svg>
              {unreadCount > 0 ? (
                <View style={styles.notifBadgePin}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>

            {/* Logout Icon */}
            <TouchableOpacity style={[styles.iconBtnCircle, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]} onPress={onLogout}>
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9C2007" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <Polyline points="16 17 21 12 16 7" />
                <Line x1="21" y1="12" x2="9" y2="12" />
              </Svg>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webHeader: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.04)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }),
  },
  webHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadgeRow: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  logoTextBold: {
    fontFamily: Platform.OS === 'web' ? 'Montserrat, sans-serif' : 'Montserrat_900Black',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 26,
  },
  logoSubtitle: {
    fontFamily: Platform.OS === 'web' ? 'Montserrat, sans-serif' : 'Montserrat_600SemiBold',
    fontSize: 8.5,
    color: '#64748b',
    letterSpacing: 0.2,
    marginTop: 1,
  },
  webHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // Status dot pinned to the sync icon's bottom-right corner
  syncStatusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  notifBadgePin: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },
});
