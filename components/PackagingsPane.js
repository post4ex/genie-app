import React, { useState, useEffect } from 'react';
import { ActivityIndicator, Image, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Tray from './Tray';
import Button from './Button';
import Icon, { GradientGlyph, GradientIcon } from './icons';
import GradientText from './GradientText';
import { fmtDate } from '../utils/formatIST';
import { isPdfUpload } from '../utils/upload-viewer';
import { File as FSFile, Paths } from 'expo-file-system';

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

// Per-section tint identity for the furnished tables — header, zebra stripe,
// accent bar and value pills all derive from the section's gradient.
const TABLE_TINTS = {
  product: {
    headBg: '#f0f9ff', headBorder: '#bae6fd', rowAlt: '#f6fbff',
    accent: '#0ea5e9', label: '#0369a1', pillBg: '#e0f2fe', pillText: '#075985', dot: '#0ea5e9',
  },
  multibox: {
    headBg: '#fffbeb', headBorder: '#fde68a', rowAlt: '#fffaf0',
    accent: '#f59e0b', label: '#b45309', pillBg: '#fef3c7', pillText: '#92400e', dot: '#f59e0b',
  },
  upload: {
    headBg: '#ecfdf5', headBorder: '#a7f3d0', rowAlt: '#f5fdf9',
    accent: '#10b981', label: '#047857', pillBg: '#d1fae5', pillText: '#065f46', dot: '#10b981',
  },
};

function SectionHeader({ icon, title, grad }) {
  return (
    <View style={styles.sectionHeader}>
      <GradientGlyph name={icon} size={15} colors={grad} />
      <GradientText colors={grad} style={styles.sectionTitle}>{title}</GradientText>
    </View>
  );
}

// Tinted table header: soft section-colored band, gradient accent bar on the
// left, uppercase labels in the section's ink colour.
function TableHead({ tint, cols }) {
  return (
    <View style={[styles.tableHead, { backgroundColor: tint.headBg, borderBottomColor: tint.headBorder }]}>
      <View style={[styles.headAccent, { backgroundColor: tint.accent }]} />
      {cols.map(function(c, i) {
        return (
          <Text key={i} style={[styles.tableHeadCell, { color: tint.label }, c.right && styles.headCellRight]}>{c.label}</Text>
        );
      })}
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
  const [pdfSrc, setPdfSrc] = useState(null);

  useEffect(() => {
    let isMounted = true;
    let createdBlobUrl = null;

    setLoading(true);
    setError(false);
    setPdfSrc(null);

    if (!uri) {
      setLoading(false);
      return;
    }

    if (!isPdf) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        if (Platform.OS === 'web') {
          if (uri.startsWith('blob:') || uri.startsWith('data:')) {
            if (isMounted) {
              setPdfSrc(uri);
              setLoading(false);
            }
            return;
          }

          // Fetch as blob to prevent Content-Disposition: attachment from forcing download in iframe
          const res = await fetch(uri);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          createdBlobUrl = URL.createObjectURL(blob);
          if (isMounted) {
            setPdfSrc(createdBlobUrl);
            setLoading(false);
          }
        } else {
          // Native Platforms (iOS & Android)
          if (uri.startsWith('data:') || uri.startsWith('file:')) {
            if (isMounted) {
              setPdfSrc(uri);
              setLoading(false);
            }
            return;
          }

          if (/^https?:/i.test(uri)) {
            if (Platform.OS === 'android') {
              // Android WebView cannot render raw PDF URLs natively; Google Docs viewer renders inline
              const gviewUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(uri)}`;
              if (isMounted) {
                setPdfSrc(gviewUrl);
                setLoading(false);
              }
            } else {
              // iOS WebView renders PDF URLs directly
              if (isMounted) {
                setPdfSrc(uri);
                setLoading(false);
              }
            }
          } else {
            // Download to cache for local file access (SDK 54 File API)
            try {
              const dest = new FSFile(Paths.cache, `preview_${Date.now()}.pdf`);
              const downloadRes = await FSFile.downloadFileAsync(uri, dest, { idempotent: true });
              if (isMounted) {
                setPdfSrc(downloadRes.uri);
                setLoading(false);
              }
            } catch (dlErr) {
              if (isMounted) {
                setPdfSrc(uri);
                setLoading(false);
              }
            }
          }
        }
      } catch (e) {
        console.warn('[UploadPreview] PDF load error:', e);
        if (isMounted) {
          setPdfSrc(uri);
          setError(false); // allow fallback render or iframe try
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
      if (createdBlobUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [uri, isPdf]);

  if (!uri) return null;

  if (isPdf) {
    return (
      <View style={styles.previewBox}>
        {loading ? (
          <View style={styles.previewLoading}>
            <ActivityIndicator size="small" color="#10b981" />
          </View>
        ) : error ? (
          <View style={styles.previewLoading}>
            <Icon name="file-document" size={32} color="#ef4444" />
            <Text style={[styles.previewFallback, { marginTop: 8 }]}>Unable to load PDF preview</Text>
          </View>
        ) : Platform.OS === 'web' ? (
          pdfSrc ? (
            React.createElement('iframe', {
              title: title || 'PDF Preview',
              src: pdfSrc,
              style: { width: '100%', height: '100%', border: '0', backgroundColor: '#ffffff' },
            })
          ) : null
        ) : WebView && pdfSrc ? (
          <WebView
            source={{ uri: pdfSrc }}
            style={{ flex: 1, backgroundColor: '#ffffff' }}
            originWhitelist={['*']}
            allowFileAccess={true}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
            scalesPageToFit={true}
            onLoadEnd={() => setLoading(false)}
            onError={() => setError(true)}
          />
        ) : (
          <View style={styles.previewLoading}>
            <Icon name="file-document" size={32} color="#10b981" />
            <Text style={[styles.previewFallback, { marginTop: 8 }]}>PDF File</Text>
          </View>
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
  onShareUpload,
  onDeleteUpload,
  onShareArea,
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
          {onShareArea ? <Button size="xs" variant="tint" iconOnly icon="shareImage" onPress={onShareArea} accessibilityLabel="Share shipment area as image" /> : null}
          {!noUploads ? (
            <View style={styles.actionRow}>
              <Button size="xs" variant="tint" iconOnly icon="eye" onPress={function() { setViewIndex(0); }} accessibilityLabel="View uploads" />
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
              <View style={styles.tableWrap}>
                <View style={styles.tableBox}>
                  <TableHead tint={TABLE_TINTS.product} cols={[{ label: 'DOC' }, { label: 'TYPE' }, { label: 'EWAY' }, { label: 'AMT', right: true }]} />
                  {products.map(function(p, i) {
                    return (
                      <View key={i} style={[styles.tableRow, i % 2 === 1 && { backgroundColor: TABLE_TINTS.product.rowAlt }, i === products.length - 1 && styles.lastRow]}>
                        <Text style={styles.cellStrong} numberOfLines={1}>{p.DOC_NUMBER || "N/A"}</Text>
                        <Text style={styles.cellMuted} numberOfLines={1}>{p.DOC_TYPE || "—"}</Text>
                        <Text style={styles.cellMuted} numberOfLines={1}>{p.EWAY_IF || "—"}</Text>
                        <View style={styles.pillWrap}>
                          <Text style={[styles.amountPill, { backgroundColor: TABLE_TINTS.product.pillBg, color: TABLE_TINTS.product.pillText }]}>{parseFloat(p.AMOUNT || 0).toFixed(2)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : null}

          {/* ── 2. MultiBox ── */}
          {!noBoxes ? (
            <View style={styles.productCard}>
              <SectionHeader icon="package-variant-closed" title={"MultiBox (" + boxes.length + ")"} grad={MULTIBOX_GRAD} />
              <View style={styles.tableWrap}>
                <View style={styles.tableBox}>
                  <TableHead tint={TABLE_TINTS.multibox} cols={[{ label: 'BOX' }, { label: 'WT' }, { label: 'LBH' }, { label: 'CHG', right: true }]} />
                  {boxes.map(function(b, bi) {
                    const lbh = (parseFloat(b.LENGTH)||0) + "x" + (parseFloat(b.BREADTH)||0) + "x" + (parseFloat(b.HIGHT)||0);
                    return (
                      <View key={bi} style={[styles.tableRow, bi % 2 === 1 && { backgroundColor: TABLE_TINTS.multibox.rowAlt }, bi === boxes.length - 1 && styles.lastRow]}>
                        <View style={[styles.boxBadge, { backgroundColor: TABLE_TINTS.multibox.pillBg }]}>
                          <Text style={[styles.boxBadgeText, { color: TABLE_TINTS.multibox.pillText }]}>{b.BOX_NUM || bi+1}</Text>
                        </View>
                        <Text style={styles.cellStrong}>{b.WEIGHT || 0}</Text>
                        <Text style={styles.cellMuted}>{lbh}</Text>
                        <View style={styles.pillWrap}>
                          <Text style={[styles.amountPill, { backgroundColor: TABLE_TINTS.multibox.pillBg, color: TABLE_TINTS.multibox.pillText }]}>{parseFloat(b.CHG_WT||0).toFixed(2)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : null}

          {/* ── 3. Uploads ── */}
          {!noUploads ? (
            <View style={styles.productCard}>
              <SectionHeader icon="upload" title={"Uploads (" + uploads.length + ")"} grad={UPLOAD_GRAD} />
              <View style={styles.tableWrap}>
                <View style={styles.tableBox}>
                  <TableHead tint={TABLE_TINTS.upload} cols={[{ label: 'TYPE' }, { label: 'DETAILS' }, { label: 'DATE', right: true }]} />
                  {uploads.map(function(up, ui) {
                    var ts = 'N/A';
                    try { ts = up.TIME_STAMP ? new Date(Number(up.TIME_STAMP)).toLocaleDateString('en-GB') : 'N/A'; } catch(e) {}
                    return (
                      <TouchableOpacity
                        key={ui}
                        style={[styles.tableRow, ui % 2 === 1 && { backgroundColor: TABLE_TINTS.upload.rowAlt }, ui === uploads.length - 1 && styles.lastRow]}
                        activeOpacity={0.7}
                        onPress={function() { setViewIndex(ui); }}
                      >
                        <View style={styles.typeCell}>
                          <View style={[styles.typeDot, { backgroundColor: TABLE_TINTS.upload.dot }]} />
                          <Text style={styles.cellStrong} numberOfLines={1}>{up.UPLOAD_TYPE || 'Upload'}</Text>
                        </View>
                        <Text style={styles.cellMuted} numberOfLines={1}>{uploadDetail(up)}</Text>
                        <Text style={[styles.cellMuted, styles.dateCell]} numberOfLines={1}>{ts}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
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
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.sheetBtn, { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}
                      onPress={function() { onShareUpload(viewing); }}
                      accessibilityLabel="Share file"
                    >
                      <Icon name="share" size={14} color="#0891b2" chunky />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.sheetBtn, { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}
                      onPress={function() { onDownloadUpload(viewing); setViewIndex(null); }}
                      accessibilityLabel="Download file"
                    >
                      <Icon name="download" size={14} color="#64748b" chunky />
                    </TouchableOpacity>
                  </View>
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
  productCard:    { marginBottom: 12 },
  tableWrap: {
    borderRadius: 10,
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5,
    elevation: 2,
  },
  tableBox: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  tableHead: {
    flexDirection: "row",
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: 7,
    paddingRight: 8,
    paddingLeft: 0,
  },
  headAccent:     { width: 3.5, height: '100%', alignSelf: 'stretch', marginRight: 6 },
  tableHeadCell:  { flex: 1, fontSize: 8.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  headCellRight:  { textAlign: "right" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    alignItems: 'center',
  },
  lastRow:        { borderBottomWidth: 0 },
  cellStrong:     { flex: 1, fontSize: 11, fontWeight: "700", color: "#0f172a" },
  cellMuted:      { flex: 1, fontSize: 10.5, fontWeight: "600", color: "#64748b" },
  dateCell:       { fontSize: 10, color: '#94a3b8', textAlign: 'right' },
  pillWrap:       { flex: 1, alignItems: 'flex-end' },
  amountPill: {
    fontSize: 9.5, fontWeight: "800", letterSpacing: 0.3,
    paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 99, overflow: 'hidden',
  },
  boxBadge: {
    minWidth: 24, height: 22, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8, paddingHorizontal: 5,
  },
  boxBadgeText:   { fontSize: 10.5, fontWeight: "900" },
  typeCell:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeDot:        { width: 7, height: 7, borderRadius: 99 },

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
