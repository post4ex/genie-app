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

export const resolveUploadUri = (url, apiBase = '') => {
  if (!url) return '';
  if (/^(https?:|data:|blob:|file:)/i.test(String(url))) return String(url);
  return `${apiBase}${String(url).startsWith('/') ? '' : '/'}${url}`;
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

export const openUploadExternally = async (uri) => {
  if (!uri) return false;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(uri, '_blank', 'noopener,noreferrer');
    return true;
  }
  return Linking.openURL(uri);
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
