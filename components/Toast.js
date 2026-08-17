// components/Toast.js — Global auto-dismissing toast system (web
// `showNotification` parity). Mount <ToastProvider> once at the app root, then
// any screen can show an in-app notification without local state:
//
//   import { useToast } from '../components/Toast';
//   const showToast = useToast();
//   showToast({ title: 'Label Layout', msg: 'Switched to 4-up Portrait' });
//   showToast({ msg: 'Email sent', tone: 'success' });   // info | success | error | warning
//
// The toast floats top-right BELOW the app header (never covers it), slides in
// with a soft fade, shows a tone-tinted gradient icon and a live countdown
// progress bar, then dismisses itself after `duration` ms. It never intercepts
// touches.

import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import {
  Animated, Easing, Platform, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientGlyph } from './icons';

const ToastContext = createContext(() => {});

// Access the global toast trigger from any screen/component under the provider.
export function useToast() {
  return useContext(ToastContext);
}

// Tone → border/title colours, icon glyph and gradient. Glyphs are valid
// MaterialCommunityIcons names (GradientGlyph falls back to MCI_GLYPHS → MCI).
const TONES = {
  info:    { border: '#9C2007', title: '#9C2007', icon: 'information', grad: ['#9C2007', '#f59e0b'] },
  success: { border: '#16a34a', title: '#15803d', icon: 'check-circle', grad: ['#16a34a', '#84cc16'] },
  error:   { border: '#dc2626', title: '#b91c1c', icon: 'alert-circle', grad: ['#dc2626', '#f97316'] },
  warning: { border: '#d97706', title: '#b45309', icon: 'alert', grad: ['#d97706', '#f59e0b'] },
};

export function ToastProvider({ children, defaultDuration = 2200 }) {
  const [toast, setToast] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(100);
  const timersRef = useRef([]);
  const intervalRef = useRef(null);
  const enter = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Newest toast replaces any visible one (web showNotification parity).
  const showToast = useCallback((opts = {}) => {
    const next = typeof opts === 'string' ? { msg: opts } : (opts || {});
    clearTimers();
    setLeaving(false);
    setProgress(100);
    setToast(next);
  }, []);

  // Entrance: slide in from the right with a soft fade. useNativeDriver on
  // native (the same safe path Header/Tile/Button use), JS fallback on web.
  useEffect(() => {
    if (!toast) return undefined;
    enter.setValue(0);
    const anim = Animated.timing(enter, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    });
    anim.start();
    return () => anim.stop();
  }, [toast, enter]);

  // Lifecycle: run the countdown bar, then fade out and clear the toast.
  useEffect(() => {
    if (!toast) return undefined;
    setLeaving(false);
    setProgress(100);
    clearTimers();
    const duration = toast.duration || defaultDuration;
    const start = Date.now();
    intervalRef.current = setInterval(() => {
      setProgress(Math.max(0, 100 - ((Date.now() - start) / duration) * 100));
    }, 40);
    timersRef.current.push(setTimeout(() => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      setLeaving(true);
      timersRef.current.push(setTimeout(() => {
        setToast(null);
        setLeaving(false);
      }, 260));
    }, duration));
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, defaultDuration]);

  // Clear pending timers on unmount.
  useEffect(() => () => clearTimers(), []);

  const tone = TONES[(toast && toast.tone) || 'info'] || TONES.info;

  return (
    <ToastContext.Provider value={showToast}>
      <View style={styles.root}>
        {children}
        {toast ? (
          <View
            style={[styles.wrap, { top: Math.max(insets.top + 8, 16) + 64 }]}
            pointerEvents="none"
            accessibilityLiveRegion="polite"
          >
            <Animated.View
              style={[
                styles.card,
                {
                  borderColor: tone.border,
                  opacity: leaving ? 0 : enter,
                  transform: [{
                    translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }),
                  }],
                },
              ]}
            >
              <View style={styles.cardBody}>
                <GradientGlyph name={tone.icon} size={24} colors={tone.grad} />
                <View style={styles.textWrap}>
                  {toast.title ? <Text style={[styles.title, { color: tone.title }]}>{toast.title}</Text> : null}
                  {toast.msg ? <Text style={styles.msg}>{toast.msg}</Text> : null}
                </View>
              </View>
              {/* Live countdown bar — plain width %, crash-safe */}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: tone.border }]} />
              </View>
            </Animated.View>
          </View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export default ToastProvider;

const styles = StyleSheet.create({
  // Full-screen shell so the absolutely positioned toast overlays the app.
  root: { flex: 1 },
  // Top-right, below the app header (header = insets.top + 8 → +54px height).
  wrap: {
    position: 'absolute', right: 14,
    alignItems: 'flex-end', zIndex: 999, elevation: 12,
  },
  card: {
    width: 280, maxWidth: '86%',
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 10px 28px rgba(15,23,42,0.20)' }
      : { shadowColor: '#0f172a', shadowOpacity: 0.20, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }),
  },
  cardBody: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  textWrap: { flex: 1, minWidth: 0 },
  title: { fontSize: 13, fontWeight: '900', textAlign: 'right', letterSpacing: 0.3 },
  msg: { color: '#475569', fontSize: 11, fontWeight: '600', textAlign: 'right', marginTop: 2 },
  // Countdown track — thin hairline under the card body.
  progressTrack: { height: 3, backgroundColor: '#f1f5f9' },
  progressFill: { height: 3, borderBottomRightRadius: 18 },
});
