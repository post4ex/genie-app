import React, { useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Platform, Animated, Easing, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { GradientIcon } from './icons';
import { COLORS } from '../styles/theme';

// Floating pill shadow — same treatment as the bottom bar (BottomMenuSheet)
const floatingShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 6px 20px rgba(15, 23, 42, 0.12)' }
  : {
      shadowColor: '#0f172a',
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 8,
    };

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
    <View style={[styles.webHeader, { marginTop: Math.max(insets.top + 8, 16) }]}>
      {/* Left: App Logo (web genie-logo) */}
      <View style={styles.webHeaderLeft}>
        <Image source={require('../assets/genie-logo.png')} style={styles.logoImage} resizeMode="contain" />
      </View>

      {/* Right: Gradient Action Icons */}
      <View style={styles.webHeaderRight}>
        {user ? (
          <>
            {/* Track AWB Icon — switches to Track tab */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onTrack}
              accessibilityLabel="Track AWB"
            >
              <GradientIcon name="track" size={34} iconSize={15} />
            </TouchableOpacity>

            {/* Sync Icon — spins while syncing, dot shows connection status */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onRefresh}
              accessibilityLabel={STATUS_LABEL[syncStatus] || 'Sync'}
            >
              <Animated.View style={{ transform: [{ rotate }] }}>
                <GradientIcon name="refresh" size={34} iconSize={15} />
              </Animated.View>
              <View style={[styles.syncStatusDot, { backgroundColor: statusColor }]} />
            </TouchableOpacity>

            {/* Notification Bell Icon */}
            <TouchableOpacity style={styles.iconBtn} onPress={onNotif}>
              <GradientIcon name="bell" size={34} iconSize={15} />
              {unreadCount > 0 ? (
                <View style={styles.notifBadgePin}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>

            {/* Logout Icon */}
            <TouchableOpacity style={styles.iconBtn} onPress={onLogout}>
              <GradientIcon name="logout" size={34} iconSize={15} />
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
    marginHorizontal: 14,
    height: 54,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...floatingShadow,
  },
  webHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadgeRow: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  logoImage: {
    width: 132,
    height: 34,
  },
  webHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
