// components/PackagingsPane.js
import React, { useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Tray from './Tray';
import Button from './Button';
import Icon, { GradientGlyph, GradientIcon } from './icons';
import GradientText from './GradientText';
import { fmtDate } from '../utils/formatIST';
import { isPdfUpload } from '../utils/upload-viewer';
import * as FileSystem from 'expo-file-system';

// Native WebView for rendering PDFs in-app on iOS / Android
let WebView = null;
try {
  WebView = require('react-native-webview').WebView;
} catch (_) {
  WebView = null;
}

const PANE_GRAD     = ["#8b5cf6", "#6366f1"];
const PRODUCT_GRAD  = ["#0ea5e9", "#2563eb"];
const MULTIBOX_GRAD = ["#f59e0b", "#ea580c"];
const UPLOAD_GRAD   = ["#10b981", "#0d9488"];

function SectionHeader({ icon, title, grad }) {
  return (
    <View style={styles.sectionHeader}>
      <GradientGlyph name={icon} size={15} colors={grad} />
      <GradientText colors={grad} style={styles.sectionTitle}>{title}</GradientText>
    </View>
  );
}

function uploadDetail(up) {
  if (up.UPLOAD_TYPE === "MultiBox") return "Child:" + (up.CHILD_AWB || "N/A");
  if (up.UPLOAD_TYPE === "KYC") return (up.CUSTOMER_UID || "N/A") + "(" + (up.KYC_TYPE || "N/A") + ")";
  if (up.UPLOAD_TYPE === "Product") return (up.DOC_NUMBER || "N/A") + "(" + (up.DOC_TYPE || "N/A") + ")";
  return up.STATUS_REMARK || "N/A";
}

// Inline file preview — image or PDF — rendered inside the upload popup so
// there is ONE popup with the controls (Download / Delete), no second viewer.
function UploadPreview({ uri, isPdf, title }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pdfSrc, setPdfSrc] = useState(uri);

  // The API serves files with `Content-Disposition: attachment`, which makes a
  // raw iframe/WebView download instead of render. So fetch the PDF as a blob
  // (web) or a local file (native) and preview THAT. `uri` may be absolute
  // (https://…) or a relative path (/api/file/…) — both need the blob load.
  const isRemote = uri && (/^https?:/i.test(uri) || uri.startsWith('/'));
  const needsLoad = isPdf && isRemote && pdfSrc === uri;
  if (needsLoad) {
    (async () => {
      try {
        if (Platform.OS === 'web') {
          const res = await fetch(uri);
          const blob = await res.blob();
          setPdfSrc(URL.createObjectURL(blob));
        } else {
          const target = `${FileSystem.cacheDirectory}preview_${Date.now()}.pdf`;
          await FileSystem.downloadAsync(uri, target);
          setPdfSrc(target);
        }
        setLoading(false);
      } catch (e) {
        setError(true);
        setLoading(false);
      }
    })();
  }

  if (!uri) return null;

  if (isPdf) {
    // Only mount the frame once the blob/file is ready — mounting it with the
    // raw attachment URL triggers a download before the fetch completes.
    const ready = pdfSrc !== uri || !isRemote;
    if (Platform.OS === 'web') {
      return (
        <View style={styles.previewBox}>
          {error ? (
            <View style={styles.previewLoading}>
              <Text style={styles.previewFallback}>Failed to load preview</Text>
            </View>
          ) : !ready ? (
            <View style={styles.previewLoading}>
              <ActivityIndicator size="small" color="#10b981" />
            </View>
          ) : (
            React.createElement('iframe', {
              title,
              src: pdfSrc,
              style: { width: '100%', height: '100%', border: '0', backgroundColor: '#ffffff' },
            })
          )}
        </View>
      );
    }
    return (
      <View style={styles.previewBox}>
        {error ? (
          <View style={styles.previewLoading}>
            <Text style={styles.previewFallback}>Failed to load preview</Text>
          </View>
        ) : !ready ? (
          <View style={styles.previewLoading}>
            <ActivityIndicator size="small" color="#10b981" />
          </View>
        ) : WebView ? (
          <WebView
            source={{ uri: pdfSrc }}
            style={{ flex: 1, backgroundColor: '#ffffff' }}
            originWhitelist={['*']}
            allowFileAccess={true}
            scalesPageToFit={true}
            onLoadEnd={() => setLoading(false)}
            onError={() => setLoading(false)}
          />
        ) : (
          <Text style={styles.previewFallback}>PDF — tap Download to view</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.previewBox}>
      {loading && !error ? (
        <View style={styles.previewLoading}>
          <ActivityIndicator size="small" color="#8b5cf6" />
        </View>
      ) : null}
      {error ? (
        <View style={styles.previewLoading}>
          <Text style={styles.previewFallback}>Failed to load preview</Text>
        </View>
      ) : null}
      <Image
        source={{ uri }}
        style={styles.previewImage}
        resizeMode="contain"
        accessibilityLabel={title}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setError(true); setLoading(false); }}
      />
    </View>
  );
}

export default function PackagingsPane({
  products = [],
  boxes = [],
  uploads = [],
  onUpload,
  onMailAll,
  onWhatsAppAll,
  onDownloadUpload,
  onDeleteUpload,
  resolveUrl = (u) => u,
}) {
  const [viewIndex, setViewIndex] = useState(null);
  const viewing = viewIndex != null ? uploads[viewIndex] || null : null;
  const noProducts = products.length === 0;
  const noBoxes    = boxes.length === 0;
  const noUploads  = uploads.length === 0;
  const isEmpty    = noProducts && noBoxes && noUploads;

  // Step to the previous / next upload (wraps around).
  const stepUpload = (delta) => {
    if (!uploads.length) return;
    const cur = viewIndex == null ? 0 : viewIndex;
    setViewIndex((cur + delta + uploads.length) % uploads.length);
  };

  const productNames = !noProducts
    ? [...new Set(products.map(function(p) { return p.PRODUCT || p.NAME; }).filter(Boolean))].join(', ') || products.length
    : '';

  return (
    <Tray
      title="Packagings & Uploads"
      colors={PANE_GRAD}
      floating
      right={
        <View style={styles.actionRow}>
          <Button size="xs" variant="tint" iconOnly icon="upload" onPress={onUpload} accessibilityLabel="Upload File" />
          {!noUploads ? (
            <View style={styles.actionRow}>
              <Button size="xs" variant="tint" iconOnly icon="envelope" onPress={onMailAll} accessibilityLabel="Mail All" />
              <Button size="xs" variant="tint" iconOnly icon="whatsapp" onPress={onWhatsAppAll} accessibilityLabel="WhatsApp All" />
            </View>
          ) : null}
        </View>
      }
    >
      {isEmpty ? (
        <Text style={styles.noDataText}>No product, box, or upload details on file.</Text>
      ) : (
        <View style={styles.sections}>
          {/* ── 1. Product ── */}
          {!noProducts ? (
            <View style={styles.productCard}>
              <SectionHeader icon="package-variant" title={"Product (" + productNames + ")"} grad={PRODUCT_GRAD} />
              <View style={styles.tableBox}>
                <View style={styles.productHead}>
                  <Text style={styles.productHeadCell}>DOC</Text>
                  <Text style={styles.productHeadCell}>TYPE</Text>
                  <Text style={styles.productHeadCell}>EWAY</Text>
                  <Text style={[styles.productHeadCell, { textAlign: "right" }]}>AMT</Text>
                </View>
                {products.map(function(p, i) {
                  return (
                    <View key={i} style={[styles.productRow, i === products.length - 1 && styles.lastRow]}>
                      <Text style={[styles.productCell, { fontSize: 10.5 }]} numberOfLines={1}>{p.DOC_NUMBER || "N/A"}</Text>
                      <Text style={[styles.productCell, { fontSize: 10.5, color: '#64748b' }]} numberOfLines={1}>{p.DOC_TYPE || "—"}</Text>
                      <Text style={[styles.productCell, { fontSize: 10.5, color: '#64748b' }]} numberOfLines={1}>{p.EWAY_IF || "—"}</Text>
                      <Text style={[styles.productCell, { fontSize: 10.5, textAlign: "right" }]} numberOfLines={1}>{parseFloat(p.AMOUNT || 0).toFixed(2)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* ── 2. MultiBox ── */}
          {!noBoxes ? (
            <View style={styles.productCard}>
              <SectionHeader icon="package-variant-closed" title={"MultiBox (" + boxes.length + ")"} grad={MULTIBOX_GRAD} />
              <View style={styles.tableBox}>
                <View style={styles.productHead}>
                  <Text style={styles.productHeadCell}>BOX</Text>
                  <Text style={styles.productHeadCell}>WT</Text>
                  <Text style={styles.productHeadCell}>LBH</Text>
                  <Text style={[styles.productHeadCell, { textAlign: "right" }]}>CHG</Text>
                </View>
                {boxes.map(function(b, bi) {
                  const lbh = (parseFloat(b.LENGTH)||0) + "x" + (parseFloat(b.BREADTH)||0) + "x" + (parseFloat(b.HIGHT)||0);
                  return (
                    <View key={bi} style={[styles.productRow, bi === boxes.length - 1 && styles.lastRow]}>
                      <Text style={styles.productCell}>{b.BOX_NUM || bi+1}</Text>
                      <Text style={styles.productCell}>{b.WEIGHT || 0}</Text>
                      <Text style={styles.productCell}>{lbh}</Text>
                      <Text style={[styles.productCell, { textAlign: "right" }]}>{parseFloat(b.CHG_WT||0).toFixed(2)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* ── 3. Uploads ── */}
          {!noUploads ? (
            <View style={styles.productCard}>
              <SectionHeader icon="upload" title={"Uploads (" + uploads.length + ")"} grad={UPLOAD_GRAD} />
              <View style={styles.tableBox}>
                <View style={styles.productHead}>
                  <Text style={styles.productHeadCell}>TYPE</Text>
                  <Text style={styles.productHeadCell}>DETAILS</Text>
                  <Text style={[styles.productHeadCell, { textAlign: 'right' }]}>DATE</Text>
                </View>
                {uploads.map(function(up, ui) {
                  var ts = 'N/A';
                  try { ts = up.TIME_STAMP ? new Date(Number(up.TIME_STAMP)).toLocaleDateString('en-GB') : 'N/A'; } catch(e) {}
                  return (
                    <TouchableOpacity
                      key={ui}
                      style={[styles.productRow, ui === uploads.length - 1 && styles.lastRow]}
                      activeOpacity={0.7}
                      onPress={function() { setViewIndex(ui); }}
                    >
                      <Text style={[styles.productCell, { fontSize: 10.5, fontWeight: '700' }]} numberOfLines={1}>{up.UPLOAD_TYPE || 'Upload'}</Text>
                      <Text style={[styles.productCell, { fontSize: 10.5, color: '#64748b' }]} numberOfLines={1}>{uploadDetail(up)}</Text>
                      <Text style={[styles.productCell, { fontSize: 10, color: '#94a3b8', textAlign: 'right' }]} numberOfLines={1}>{ts}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      )}

      {/* ── Upload bottom sheet — 3/4 height, icon actions in the header ── */}
      <Modal visible={!!viewing} transparent animationType="slide" onRequestClose={function() { setViewIndex(null); }}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleRow}>
                <GradientIcon name="upload" size={30} iconSize={14} colors={UPLOAD_GRAD} />
                <View style={styles.popupTitleBlock}>
                  <GradientText colors={UPLOAD_GRAD} style={styles.popupTitle}>
                    {viewing ? (viewing.UPLOAD_TYPE || 'Upload') : 'Upload'}
                  </GradientText>
                  <Text style={styles.popupSubtitle}>
                    {viewing ? fmtDate(viewing.TIME_STAMP, 'full') : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.sheetHeaderActions}>
                <TouchableOpacity
                  style={[styles.sheetBtn, { backgroundColor: '#e0f2fe', borderColor: '#bae6fd' }]}
                  onPress={function() { stepUpload(-1); }}
                  disabled={uploads.length < 2}
                  accessibilityLabel="Previous upload"
                >
                  <Icon name="back" size={14} color="#0284c7" chunky />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sheetBtn, { backgroundColor: '#e0f2fe', borderColor: '#bae6fd' }]}
                  onPress={function() { stepUpload(1); }}
                  disabled={uploads.length < 2}
                  accessibilityLabel="Next upload"
                >
                  <Icon name="forward" size={14} color="#0284c7" chunky />
                </TouchableOpacity>
                {viewing && viewing.FILE_URL ? (
                  <TouchableOpacity
                    style={[styles.sheetBtn, { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}
                    onPress={function() { onDownloadUpload(viewing); setViewIndex(null); }}
                    accessibilityLabel="Download file"
                  >
                    <Icon name="download" size={14} color="#64748b" chunky />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[styles.sheetBtn, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}
                  onPress={function() { onDeleteUpload(viewing); setViewIndex(null); }}
                  accessibilityLabel="Delete upload"
                >
                  <Icon name="trash" size={14} color="#ef4444" chunky />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sheetBtn, { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}
                  onPress={function() { setViewIndex(null); }}
                  accessibilityLabel="Close"
                >
                  <Icon name="close" size={14} color="#64748b" chunky />
                </TouchableOpacity>
              </View>
            </View>

            {viewing ? (
              <View style={styles.sheetBody}>
                {viewing.FILE_URL ? (
                  <UploadPreview
                    uri={resolveUrl(viewing.FILE_URL)}
                    isPdf={isPdfUpload(viewing)}
                    title={viewing.UPLOAD_TYPE || 'Upload'}
                  />
                ) : (
                  <View style={styles.noFileBox}>
                    <Icon name="file" size={32} color="#94a3b8" />
                    <Text style={styles.noFileText}>No document file attached</Text>
                  </View>
                )}

                <View style={styles.popupDetailRow}>
                  <Text style={styles.popupDetailLabel}>ID</Text>
                  <Text style={styles.popupDetailValue} numberOfLines={1}>{viewing.AWB_NUMBER || viewing.KYC_NUMBER || viewing.REFERENCE || 'N/A'}</Text>
                  <Text style={styles.popupDetailSep}>·</Text>
                  <Text style={styles.popupDetailLabel}>Details</Text>
                  <Text style={styles.popupDetailValue} numberOfLines={1}>{uploadDetail(viewing)}</Text>
                </View>

                {uploads.length > 1 ? (
                  <View style={styles.sheetCounter}>
                    <Text style={styles.sheetCounterText}>
                      {(viewIndex != null ? viewIndex : 0) + 1} / {uploads.length}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </Tray>
  );
}

const styles = StyleSheet.create({
  actionRow:      { flexDirection: "row", gap: 4, alignItems: "center" },
  noDataText:     { fontSize: 12, color: "#94a3b8", fontStyle: "italic", paddingVertical: 4 },
  sections:       { paddingTop: 2 },
  sectionHeader:  { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  sectionTitle:   { fontSize: 12.5, fontWeight: "900", letterSpacing: 0.3 },
  productCard:    { marginBottom: 10 },
  tableBox: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  productHead: {
    flexDirection: "row",
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  productHeadCell:{ flex: 1, fontSize: 8.5, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 },
  productRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    alignItems: 'center',
  },
  lastRow:        { borderBottomWidth: 0 },
  productCell:    { flex: 1, fontSize: 11, fontWeight: "700", color: "#0f172a" },
  // Bottom sheet (FilterModal / UpdateStatusModal popup class)
  sheetOverlay:  { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: '#ffffff', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    overflow: 'hidden', height: '75%',
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  sheetHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  popupTitleBlock:{ flex: 1, minWidth: 0 },
  popupTitle:     { fontSize: 13.5, fontWeight: "900", letterSpacing: -0.3 },
  popupSubtitle:  { fontSize: 9, fontWeight: "600", color: "#94a3b8", marginTop: 1 },
  sheetBody:      { flex: 1, paddingHorizontal: 14, paddingTop: 10 },
  previewBox: {
    flex: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#0f172a',
    borderWidth: 1, borderColor: '#1e293b', marginBottom: 8,
  },
  previewImage:   { width: '100%', height: '100%' },
  previewLoading: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  previewFallback:{ color: '#94a3b8', fontSize: 11, fontWeight: '600', textAlign: 'center', paddingTop: 60 },
  popupDetailRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingBottom: 12 },
  popupDetailLabel: { fontSize: 8.5, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 },
  popupDetailSep: { fontSize: 10, color: '#cbd5e1', fontWeight: '700' },
  popupDetailValue: { fontSize: 10.5, fontWeight: "700", color: "#0f172a", flexShrink: 1 },
  popupActionText:{ fontSize: 11, fontWeight: "800" },
  sheetBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noFileBox: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 8,
  },
  noFileText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  sheetCounter: { alignItems: 'center', paddingBottom: 12 },
  sheetCounterText: { fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 1 },
});
