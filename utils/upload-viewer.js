import React from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  Linking,
  Platform,
  StyleSheet,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

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

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const a = document.createElement('a');
    a.href = uri;
    a.target = '_blank';
    a.download = title;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }

  try {
    const rawUrl = uri.split('?')[0];
    const extMatch = rawUrl.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'pdf';
    
    const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetPath = `${FileSystem.documentDirectory}${cleanTitle}_${Date.now()}.${ext}`;

    const result = await FileSystem.downloadAsync(uri, targetPath);
    if (result && result.uri) {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          dialogTitle: `Save ${title}`,
          mimeType: ext === 'pdf' ? 'application/pdf' : ext.match(/(jpg|jpeg|png|webp)/) ? `image/${ext}` : undefined,
        });
      }
      return true;
    }
  } catch (err) {
    console.warn('[Native Download] Error downloading file:', err);
    Linking.openURL(uri).catch(() => {});
  }
  return false;
};

export const openUploadExternally = async (uri, title = 'File') => {
  return downloadUploadNative(uri, title);
};

// A dependency-free viewer: images render inside the app on every platform;
// PDFs render inline on web and use the platform PDF handler on native because
// the project intentionally does not depend on a native WebView/PDF package.
export function UploadViewer({ visible, uri, title = 'Upload preview', isPdf = false, onClose }) {
  const webPdf = isPdf && Platform.OS === 'web' && uri;
  return (
    <Modal visible={!!visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.viewer}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close viewer">
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          {webPdf ? (
            React.createElement('iframe', {
              title,
              src: uri,
              style: { width: '100%', height: '78vh', border: '0', backgroundColor: '#fff' },
            })
          ) : isPdf ? (
            <View style={styles.pdfFallback}>
              <Text style={styles.pdfIcon}>PDF</Text>
              <Text style={styles.pdfText}>This PDF is ready to view.</Text>
              <TouchableOpacity style={styles.openButton} onPress={() => openUploadExternally(uri)}>
                <Text style={styles.openButtonText}>Open PDF</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Image source={{ uri }} style={styles.image} resizeMode="contain" accessibilityLabel={title} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.78)', justifyContent: 'center', padding: 14 },
  viewer: { width: '100%', maxWidth: 900, maxHeight: '94%', alignSelf: 'center', backgroundColor: '#0f172a', borderRadius: 14, overflow: 'hidden' },
  header: { minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#334155' },
  title: { flex: 1, color: '#f8fafc', fontSize: 14, fontWeight: '700', marginRight: 12 },
  close: { color: '#e2e8f0', fontSize: 20, padding: 4 },
  image: { width: '100%', height: Platform.OS === 'web' ? '78vh' : 320, minHeight: 260, backgroundColor: '#020617' },
  pdfFallback: { height: 320, alignItems: 'center', justifyContent: 'center', gap: 12 },
  pdfIcon: { color: '#f87171', fontSize: 28, fontWeight: '900' },
  pdfText: { color: '#cbd5e1', fontSize: 14 },
  openButton: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  openButtonText: { color: '#fff', fontWeight: '700' },
});
