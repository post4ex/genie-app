import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import Icon, { GradientGlyph } from './icons';
import { startWebBarcodeScan } from '../utils/web-barcode';
import Button from './Button';

const IS_WEB = Platform.OS === 'web';
const BARCODE_TYPES = [
  'code128', 'code39', 'code93', 'ean13', 'ean8',
  'qr', 'pdf417', 'datamatrix', 'itf14', 'codabar', 'aztec', 'upc_a', 'upc_e',
];

const LINE_MIN = 10;
const LINE_MAX = 85;

export default function BarcodeScanModal({
  visible = false,
  onClose,
  onScan,
  title = 'Scan Barcode',
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanLine, setScanLine] = useState(LINE_MIN);
  const [scanError, setScanError] = useState('');
  const webVideoRef = useRef(null);
  const webStopRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    setScanError('');
    if (!IS_WEB && permission && !permission.granted) {
      requestPermission();
    }
  }, [visible, permission]);

  // Sweep animation
  useEffect(() => {
    if (!visible) return;
    let dir = 1;
    const t = setInterval(() => {
      setScanLine((y) => {
        let next = y + dir * 2;
        if (next >= LINE_MAX) { dir = -1; next = LINE_MAX; }
        if (next <= LINE_MIN) { dir = 1; next = LINE_MIN; }
        return next;
      });
    }, 34);
    return () => clearInterval(t);
  }, [visible]);

  // Web barcode detector loop
  useEffect(() => {
    if (!IS_WEB || !visible) return;
    const el = webVideoRef.current;
    if (!el) return;
    const stop = startWebBarcodeScan(el, (code) => {
      if (onScan && code) onScan(String(code).trim());
      if (onClose) onClose();
    }, (msg) => setScanError(msg));
    webStopRef.current = stop;
    return () => {
      if (webStopRef.current) {
        webStopRef.current();
        webStopRef.current = null;
      }
    };
  }, [visible]);

  const handleClose = () => {
    if (webStopRef.current) {
      webStopRef.current();
      webStopRef.current = null;
    }
    if (onClose) onClose();
  };

  const handleNativeBarcodeScanned = (res) => {
    const code = res?.data || res?.raw;
    if (code) {
      if (onScan) onScan(String(code).trim());
      handleClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <GradientGlyph name="barcode-scan" size={20} colors={['#9C2007', '#f59e0b']} />
              <Text style={styles.title}>{title}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Camera Stage */}
          <View style={styles.stage}>
            {IS_WEB ? (
              React.createElement('video', {
                ref: webVideoRef,
                autoPlay: true,
                playsInline: true,
                muted: true,
                style: { width: '100%', height: '100%', objectFit: 'cover' },
              })
            ) : permission?.granted ? (
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
                onBarcodeScanned={handleNativeBarcodeScanned}
              />
            ) : (
              <View style={styles.permWrap}>
                <Text style={styles.permText}>Camera permission needed to scan barcodes.</Text>
                <Button variant="primary" size="sm" label="Grant Permission" onPress={requestPermission} />
              </View>
            )}

            {/* Reticle frame */}
            <View style={styles.reticleFrame} pointerEvents="none">
              <LinearGradient colors={['#f59e0b', '#fbbf24']} style={[styles.corner, styles.cornerTL]} />
              <LinearGradient colors={['#f59e0b', '#fbbf24']} style={[styles.corner, styles.cornerTR]} />
              <LinearGradient colors={['#f59e0b', '#fbbf24']} style={[styles.corner, styles.cornerBL]} />
              <LinearGradient colors={['#f59e0b', '#fbbf24']} style={[styles.corner, styles.cornerBR]} />
              <LinearGradient
                colors={['transparent', '#ef4444', '#ef4444', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.scanLine, { top: `${scanLine}%` }]}
              />
            </View>
          </View>

          {scanError ? <Text style={styles.errorText}>{scanError}</Text> : null}

          <Text style={styles.hintText}>Point camera at the 12-digit E-Way barcode</Text>

          <View style={{ marginTop: 12 }}>
            <Button variant="secondary" size="md" label="Cancel" onPress={handleClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 10px 25px rgba(15, 23, 42, 0.2)' }
      : { shadowColor: '#0f172a', shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  stage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#020617',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permWrap: {
    alignItems: 'center',
    gap: 10,
    padding: 16,
  },
  permText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  reticleFrame: {
    width: 170,
    height: 140,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 5,
  },
  cornerTL: { top: -2, left: -2, borderTopLeftRadius: 12 },
  cornerTR: { top: -2, right: -2, borderTopRightRadius: 12 },
  cornerBL: { bottom: -2, left: -2, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: -2, right: -2, borderBottomRightRadius: 12 },
  scanLine: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 2.5,
    borderRadius: 2,
    opacity: 0.95,
  },
  hintText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
    marginTop: 10,
  },
  errorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 6,
  },
});
