import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Native WebView for rendering PDFs in-app on iOS / Android
let WebView = null;
try {
  WebView = require('react-native-webview').WebView;
} catch (_) {
  WebView = null;
}

export const resolveUploadUri = (url, apiBase = '', token = '') => {
  if (!url) return '';
  let res = String(url).trim();

  // Prepend apiBase if it's a relative path
  const isExternal = /^(https?:|data:|blob:|file:)/i.test(res);
  if (!isExternal) {
    res = `${apiBase}${res.startsWith('/') ? '' : '/'}${res}`;
  }

  // Only append auth token for our own operations server endpoints (/api/file/, etc.)
  const isOurApi = (apiBase && res.startsWith(apiBase)) || res.includes('/api/file/') || res.includes('/api/download');
  if (isOurApi && token && !res.includes('token=')) {
    res += (res.includes('?') ? '&' : '?') + `token=${encodeURIComponent(token)}`;
  }

  return res;
};

export const isImageUpload = (upload = {}) => {
  const type = String(upload.content_type || upload.CONTENT_TYPE || upload.MIME_TYPE || '').toLowerCase();
  const url = String(upload.FILE_URL || upload.url || '').toLowerCase();
  return type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|heic)(\?|$)/i.test(url) || String(upload.UPLOAD_TYPE || '').toUpperCase() === 'POD';
};

export const isPdfUpload = (upload = {}) => {
  const type = String(upload.content_type || upload.CONTENT_TYPE || upload.MIME_TYPE || '').toLowerCase();
  const url = String(upload.FILE_URL || upload.url || '').toLowerCase();
  return type === 'application/pdf' || /\.pdf(\?|$)/i.test(url);
};

export const downloadUploadNative = async (uri, title = 'Download') => {
  if (!uri) return false;

  const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');

  // Web Platform Native Download
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = cleanTitle;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      return true;
    } catch (e) {
      const a = document.createElement('a');
      a.href = uri;
      a.download = cleanTitle;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    }
  }

  // Native iOS / Android Platform Download
  try {
    const rawUrl = uri.split('?')[0];
    const extMatch = rawUrl.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'pdf';
    const targetPath = `${FileSystem.documentDirectory}${cleanTitle}_${Date.now()}.${ext}`;

    const result = await FileSystem.downloadAsync(uri, targetPath);
    if (result && result.uri) {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          dialogTitle: `Save ${title}`,
          mimeType: ext === 'pdf' ? 'application/pdf' : ext.match(/(jpg|jpeg|png|webp|gif)/) ? `image/${ext}` : undefined,
        });
      } else {
        Alert.alert('Download Complete', `File saved to ${result.uri}`);
      }
      return true;
    }
  } catch (err) {
    console.warn('[Native Download] Error downloading file:', err);
    Alert.alert('Download Error', `Unable to download file: ${err.message || 'Network error'}`);
  }
  return false;
};

export const openUploadExternally = async (uri, title = 'File') => {
  return downloadUploadNative(uri, title);
};

export function UploadViewer({ visible, uri, title = 'Upload preview', isPdf = false, onClose }) {
  const [downloading, setDownloading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(true);

  if (!visible || !uri) return null;

  const handleDownload = async () => {
    setDownloading(true);
    await downloadUploadNative(uri, title);
    setDownloading(false);
  };

  const isWeb = Platform.OS === 'web';
  const pdfUrl = isPdf && uri.startsWith('http') && !isWeb
    ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(uri)}`
    : uri;

  return (
    <Modal visible={!!visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.viewer}>
          {/* Header Bar */}
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.downloadBtn}
                onPress={handleDownload}
                disabled={downloading}
                accessibilityRole="button"
                accessibilityLabel="Download file"
              >
                {downloading ? (
                  <ActivityIndicator size="small" color="#38bdf8" />
                ) : (
                  <Text style={styles.downloadBtnText}>📥 Save</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close viewer"
              >
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Content Body (Max Fit between Header & Footer) */}
          <View style={styles.contentBody}>
            {isPdf ? (
              isWeb ? (
                React.createElement('iframe', {
                  title,
                  src: uri,
                  style: { width: '100%', height: '100%', border: '0', backgroundColor: '#ffffff' },
                })
              ) : WebView ? (
                <View style={{ flex: 1, width: '100%', height: '100%' }}>
                  {pdfLoading && (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator size="large" color="#38bdf8" />
                      <Text style={styles.loadingText}>Loading PDF...</Text>
                    </View>
                  )}
                  <WebView
                    source={{ uri: pdfUrl }}
                    style={{ flex: 1, backgroundColor: '#ffffff' }}
                    originWhitelist={['*']}
                    allowFileAccess={true}
                    scalesPageToFit={true}
                    onLoadEnd={() => setPdfLoading(false)}
                    onError={() => setPdfLoading(false)}
                  />
                </View>
              ) : (
                <View style={styles.fallbackBox}>
                  <Text style={styles.pdfBadge}>PDF</Text>
                  <Text style={styles.fallbackText}>{title}</Text>
                  <TouchableOpacity style={styles.fallbackBtn} onPress={handleDownload}>
                    <Text style={styles.fallbackBtnText}>📥 Download PDF to View</Text>
                  </TouchableOpacity>
                </View>
              )
            ) : (
              <Image
                source={{ uri }}
                style={styles.imageFit}
                resizeMode="contain"
                accessibilityLabel={title}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 55 : 50,    // Stays strictly below header bar
    paddingBottom: Platform.OS === 'ios' ? 70 : 65, // Stays strictly above bottom navigation bar
    paddingHorizontal: 10,
  },
  viewer: {
    width: '100%',
    maxWidth: 960,
    height: '100%',
    maxHeight: '100%',
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  header: {
    height: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  title: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    marginRight: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  downloadBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  downloadBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  closeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  closeText: {
    color: '#94a3b8',
    fontSize: 18,
    fontWeight: '900',
  },
  contentBody: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageFit: {
    width: '100%',
    height: '100%',
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 10,
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  fallbackBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  pdfBadge: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    overflow: 'hidden',
  },
  fallbackText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  fallbackBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  fallbackBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
