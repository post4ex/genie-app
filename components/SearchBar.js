// components/SearchBar.js — Centralized futuristic search input with a
// built-in expanding barcode scanner. Tapping the scan icon expands the bar
// into a camera stage (no full-screen popup) that reads barcodes straight off
// the live stream:
//   • Native → expo-camera CameraView (MLKit / Vision, all formats)
//   • Web    → raw <video> + utils/web-barcode.js (BarcodeDetector → ZXing)
//              — expo-camera's web path only decodes QR, so the utils scanner
//              is used instead; it cannot be imported directly because
//              babel-preset-expo rejects its `import.meta` usage.
// A detected code is written straight into the search field (onChangeText) and
// the bar collapses. Fully static — the scan line is a plain setInterval and
// the expansion is a web-only CSS transition, so no Animated (crash-free).
//
//   <SearchBar value={q} onChangeText={setQ} placeholder="Search..." />
//   <SearchBar value={q} onChangeText={setQ} hints={['Try an AWB…', 'Try a consignee…']} />

import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import Icon, { GradientGlyph, GradientIcon } from './icons';
import { startWebBarcodeScan } from '../utils/web-barcode';

const IS_WEB = Platform.OS === 'web';

// Native barcode formats (the same list the uploader uses).
const BARCODE_TYPES = [
  'code128', 'code39', 'code93', 'ean13', 'ean8',
  'qr', 'pdf417', 'datamatrix', 'itf14', 'codabar', 'aztec', 'upc_a', 'upc_e',
];

// Scan line sweep range (percent of the frame height).
const LINE_MIN = 8;
const LINE_MAX = 86;

// Expanded camera stage height.
const SCAN_H = 236;

export default function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search...',
  hints = [],
  onSubmitEditing,
  autoFocus,
  hideScanner = false, // render as a plain search field (no barcode scanner)
  onFilterPress,       // embed filter button directly inside the bar
  filterActive = false,
  filterCount = 0,
  onActionPress,       // embed custom action button directly inside the bar (e.g. Get AWB)
  actionIcon = 'refresh',
  actionLabel = 'Get AWB',
  actionColors = ['#9C2007', '#f59e0b'],
  keyboardType,
  maxLength,
  style,
}) {
  const [focused, setFocused] = useState(false);
  const [hintIdx, setHintIdx] = useState(0);

  // Scanner state — the bar expands into a camera stage while scanning.
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scanLine, setScanLine] = useState(LINE_MIN);
  const [scanError, setScanError] = useState('');
  const webVideoRef = useRef(null);
  const webStopRef = useRef(null);

  // Rotating smart-placeholder hints — only while idle and empty.
  useEffect(() => {
    if (focused || value || hints.length < 2) return;
    const t = setInterval(() => setHintIdx(i => (i + 1) % hints.length), 2400);
    return () => clearInterval(t);
  }, [focused, value, hints.length]);

  // Sweeping scan line — plain interval, no Animated (crash-safe).
  useEffect(() => {
    if (!scanning) return;
    let dir = 1;
    const t = setInterval(() => {
      setScanLine(y => {
        let next = y + dir * 2;
        if (next >= LINE_MAX) { dir = -1; next = LINE_MAX; }
        if (next <= LINE_MIN) { dir = 1; next = LINE_MIN; }
        return next;
      });
    }, 34);
    return () => clearInterval(t);
  }, [scanning]);

  // Web: attach the utils scanner to the raw <video> element (all formats).
  useEffect(() => {
    if (!IS_WEB || !scanning) return;
    const el = webVideoRef.current;
    if (!el) return;
    const stop = startWebBarcodeScan(el, (code) => {
      finishScan(String(code).trim());
    }, (msg) => setScanError(msg));
    webStopRef.current = stop;
    return () => { if (webStopRef.current) { webStopRef.current(); webStopRef.current = null; } };
  }, [scanning]);

  const stopScanning = () => {
    if (webStopRef.current) { webStopRef.current(); webStopRef.current = null; }
    setScanning(false);
    setScanError('');
  };

  const finishScan = (code) => {
    if (!code) return;
    stopScanning();
    if (onChangeText) onChangeText(code);
  };

  const startScan = () => {
    setScanError('');
    if (!IS_WEB && permission && !permission.granted) requestPermission();
    setScanning(true);
  };

  const showHint = !focused && !value && hints.length > 0;
  const ph = showHint ? hints[hintIdx] : placeholder;

  return (
    <LinearGradient
      colors={focused || scanning ? ['#9C2007', '#f59e0b'] : ['#F54927', '#F54927']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.ring, style]}
    >
      <View style={styles.wrap}>
        <GradientGlyph name="magnify" size={24} colors={['#9C2007', '#f59e0b']} style={styles.icon} />

        <TextInput
          style={styles.input}
          placeholder={ph}
          placeholderTextColor={focused ? '#94a3b8' : '#a6b2c2'}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          keyboardType={keyboardType}
          maxLength={maxLength}
          returnKeyType="search"
          // A search field should never trigger OS/browser autofill — especially
          // pincode/AWB search fields. We set autoComplete="off", textContentType="none",
          // and importantForAutofill="no" (never use "new-password" which explicitly
          // triggers Google Password Manager / OS credential prompts).
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          autoCorrect={false}
        />

        {value ? (
          <Pressable
            onPress={() => onChangeText && onChangeText('')}
            style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Icon name="close" size={12} color="#94a3b8" />
          </Pressable>
        ) : null}

        {!hideScanner ? (
          <Pressable
            onPress={scanning ? stopScanning : startScan}
            style={({ pressed }) => [styles.scanBtn, scanning && styles.scanBtnActive, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={scanning ? 'Close scanner' : 'Scan barcode'}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <GradientGlyph name={scanning ? 'close' : 'barcode-scan'} size={22} colors={scanning ? ['#f59e0b', '#fbbf24'] : ['#0ea5e9', '#2563eb']} />
          </Pressable>
        ) : null}

        {onActionPress ? (
          <Pressable
            onPress={onActionPress}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={actionLabel || 'Action'}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <GradientIcon name={actionIcon} size={28} iconSize={13} colors={actionColors} />
          </Pressable>
        ) : null}

        {onFilterPress ? (
          <Pressable
            onPress={onFilterPress}
            style={({ pressed }) => [styles.filterBtn, filterActive && styles.filterBtnActive, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Open filter options"
          >
            <GradientIcon name="filter" size={28} iconSize={13} colors={['#F54927', '#F54927']} />
            {filterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{filterCount}</Text>
              </View>
            )}
          </Pressable>
        ) : null}
      </View>

      {/* ── Expanded camera stage (search bar grows into the scanner) ── */}
      <View style={[styles.scanPanel, scanning && styles.scanPanelOpen]}>
        {scanning ? (
          <View style={styles.scanStage}>
            {IS_WEB ? (
              React.createElement('video', {
                ref: webVideoRef,
                autoPlay: true,
                playsInline: true,
                muted: true,
                style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#020617' },
              })
            ) : (
              permission?.granted ? (
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
                  onBarcodeScanned={({ data }) => { if (data) finishScan(String(data).trim()); }}
                />
              ) : (
                <View style={styles.scanPerm}>
                  <GradientGlyph name="camera" size={26} colors={['#9C2007', '#f59e0b']} />
                  <Text style={styles.scanPermText}>Camera access needed</Text>
                  <Pressable onPress={() => requestPermission()} style={({ pressed }) => [styles.scanPermBtn, pressed && styles.pressed]}>
                    <Text style={styles.scanPermBtnText}>Enable Camera</Text>
                  </Pressable>
                </View>
              )
            )}

            {/* Dark stage + glowing scan frame over the live feed */}
            <View style={styles.scanDark}>
              {scanError ? (
                <Text style={styles.scanErrText}>{scanError}</Text>
              ) : (
                <>
                  <View style={styles.scanFrame}>
                    <LinearGradient colors={['#9C2007', '#f59e0b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.corner, styles.cornerTL]} />
                    <LinearGradient colors={['#f59e0b', '#9C2007']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.corner, styles.cornerTR]} />
                    <LinearGradient colors={['#9C2007', '#f59e0b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.corner, styles.cornerBL]} />
                    <LinearGradient colors={['#f59e0b', '#9C2007']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.corner, styles.cornerBR]} />
                    <LinearGradient
                      colors={['rgba(245,158,11,0)', '#f59e0b', '#9C2007', 'rgba(156,32,7,0)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.scanLine, { top: `${scanLine}%` }]}
                    />
                  </View>
                  <Text style={styles.scanHint}>Align barcode within the frame</Text>
                </>
              )}
            </View>
          </View>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderRadius: 16,
    padding: 1.5,
    ...(IS_WEB
      ? { boxShadow: '0px 1px 3px rgba(15, 23, 42, 0.05), 0px 4px 14px rgba(15, 23, 42, 0.06)' }
      : {
          shadowColor: '#0f172a',
          shadowOpacity: 0.07,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
        }),
  },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14.5,
    paddingHorizontal: 8,
    minHeight: 44,
  },
  icon: {
    marginRight: 8,
    shadowColor: '#9C2007',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  input: {
    flex: 1,
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 8,
  },
  scanBtn: {
    // 40×40 touch target (glyph stays 22px) + 4px hitSlop ≈ 48×48 effective —
    // comfortably above the 44px minimum tap size.
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    shadowColor: '#0ea5e9',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  scanBtnActive: {
    shadowColor: '#f59e0b',
    shadowOpacity: 0.35,
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#F54927',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    position: 'relative',
  },
  filterBtnActive: {
    backgroundColor: '#fff7f5',
    borderColor: '#F54927',
  },
  actionBtn: {
    marginLeft: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#9C2007',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },

  // ── Expanded scanner stage ──
  scanPanel: {
    height: 0,
    opacity: 0,
    overflow: 'hidden',
    ...(IS_WEB ? { transition: 'height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease' } : null),
  },
  scanPanelOpen: {
    height: SCAN_H,
    opacity: 1,
    marginTop: 6,
  },
  scanStage: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#020617',
  },
  scanDark: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanPerm: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#020617',
  },
  scanPermText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  scanPermBtn: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  scanPermBtnText: { color: '#fbbf24', fontSize: 12, fontWeight: '800' },
  scanErrText: { color: '#f87171', fontSize: 12, fontWeight: '700', paddingHorizontal: 16, textAlign: 'center' },

  // Scan frame: compact square with gradient corner brackets
  scanFrame: {
    width: 132,
    height: 132,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  cornerTL: { top: -2, left: -2, borderTopLeftRadius: 14 },
  cornerTR: { top: -2, right: -2, borderTopRightRadius: 14 },
  cornerBL: { bottom: -2, left: -2, borderBottomLeftRadius: 14 },
  cornerBR: { bottom: -2, right: -2, borderBottomRightRadius: 14 },

  scanLine: {
    position: 'absolute',
    left: 6,
    right: 6,
    height: 2.5,
    borderRadius: 2,
    opacity: 0.95,
  },
  scanHint: {
    position: 'absolute',
    bottom: 10,
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },

  pressed: { opacity: 0.65 },
});
