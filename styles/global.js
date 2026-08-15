import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS, SHADOW } from './theme';

// ── Global design system (GENIE_WEB assets/css/style.css parity) ──────────
// Every class below maps 1:1 to a web class so screens render the same
// language as the browser pages:
//
//   S.btn*            →  .btn / .btn-danger / .btn-ghost / .btn-otp (+ sizes)
//   S.input*          →  .form-input / .readonly-input
//   S.card            →  .controlCard / .card (white card with 1px slate border)
//   S.chip*           →  .chip pill toggle
//   S.badge*          →  .sv-status-badge
//   S.tab*            →  .tab-button
//   S.modal*          →  .modal-overlay / .modal-content
//   S.split*          →  .split-view panes
//   S.row / S.center  →  flexbox utilities
//
// Prefer these over per-screen StyleSheet entries. Screens can still layer
// local overrides by passing extra style arrays (Button's `style` prop, etc.).

export const S = StyleSheet.create({
  // ── Buttons (web .btn family) ─────────────────────────────────────────────
  btn: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,   // web 0.5rem
    paddingHorizontal: 16, // web 1rem
    borderRadius: RADIUS.sm,
    borderWidth: 2,       // web 2px borders
  },
  // .btn — primary: white bg, crimson 2px border + text; hover fills crimson
  btnPrimary: { borderColor: COLORS.primary, backgroundColor: COLORS.white },
  btnPrimaryPressed: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  btnPrimaryText: { color: COLORS.primary },
  btnPrimaryTextPressed: { color: COLORS.white },
  // .btn-danger — destructive/secondary: transparent bg, navy 2px border + text
  btnDanger: { borderColor: COLORS.secondary, backgroundColor: 'transparent' },
  btnDangerPressed: { borderColor: COLORS.secondary, backgroundColor: COLORS.secondary },
  btnDangerText: { color: COLORS.secondary },
  btnDangerTextPressed: { color: COLORS.white },
  // .btn-ghost — navy filled, white text; hover flips to white bg
  btnGhost: { borderColor: COLORS.secondary, backgroundColor: COLORS.secondary },
  btnGhostPressed: { borderColor: COLORS.secondary, backgroundColor: COLORS.white },
  btnGhostText: { color: COLORS.white },
  btnGhostTextPressed: { color: COLORS.secondary },
  // .btn-otp — accent orange outline
  btnOtp: { borderColor: COLORS.accent, backgroundColor: COLORS.white },
  btnOtpPressed: { borderColor: COLORS.accent, backgroundColor: COLORS.accent },
  btnOtpText: { color: COLORS.accent },
  btnOtpTextPressed: { color: COLORS.white },
  // Sizes — web .btn-sm (0.25rem/0.625rem, 0.75rem) and .btn-lg (0.625rem/1.5rem, 1rem)
  btnSm: { paddingVertical: 4, paddingHorizontal: 10 },
  btnSmText: { fontSize: 12 },
  btnLg: { paddingVertical: 10, paddingHorizontal: 24 },
  btnLgText: { fontSize: 16 },
  btnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  btnFullWidth: { width: '100%' },
  // .btn-close — circular dismiss control
  btnClose: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCloseText: { color: '#374151', fontSize: 15, fontWeight: '700' },

  // ── Inputs (web .form-input) ──────────────────────────────────────────────
  input: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '100%',
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
  },
  inputError: { borderColor: COLORS.error, backgroundColor: '#fff7f7' },
  inputDisabled: { backgroundColor: '#f3f4f6', color: '#9ca3af' }, // .readonly-input
  label: {
    color: COLORS.textLabel,
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    marginBottom: 6,
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    ...SHADOW,
  },

  // ── Chip pill ─────────────────────────────────────────────────────────────
  chip: {
    borderRadius: RADIUS.pill,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { color: '#475569', fontFamily: FONTS.semiBold, fontSize: 11 },
  chipTextActive: { color: COLORS.white },

  // ── Status badge (web .sv-status-badge) ───────────────────────────────────
  badge: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },

  // ── Tabs (web .tab-button) ────────────────────────────────────────────────
  tab: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { color: COLORS.textSecondary, fontFamily: FONTS.semiBold, fontSize: 14 },
  tabTextActive: { color: COLORS.primary, fontFamily: FONTS.bold },

  // ── Modal (web .modal-overlay / .modal-content) ───────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 12,
    marginBottom: 12,
    gap: 10,
  },
  modalTitle: { color: COLORS.textPrimary, fontFamily: FONTS.bold, fontSize: 18 },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  closeText: { color: COLORS.textSecondary, fontSize: 20, padding: 4 },

  // ── Split view (web .split-view) ──────────────────────────────────────────
  splitView: { flex: 1, flexDirection: 'row' },
  listPane: {
    width: '38%',
    minWidth: 260,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  detailPane: { flex: 1, backgroundColor: COLORS.white },

  // ── Layout utilities ──────────────────────────────────────────────────────
  screen: { flex: 1, backgroundColor: COLORS.background },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: COLORS.textPrimary, fontFamily: FONTS.bold, fontSize: 16 },
  muted: { color: COLORS.textSecondary, fontSize: 12 },
  errorText: { color: COLORS.error, fontSize: 12 },
});
