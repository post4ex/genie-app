import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Print from 'expo-print';
import { COLORS, FONTS } from '../styles/theme';

const BILLER = {
  name: 'The Postman',
  address: 'R13 Shivalik Colony, Haripur Nawada',
  landmark: 'Chaudhary Garden, Jungle Line',
  city: 'Dehradun, Uttarakhand, India',
  pincode: '248001',
  phone: '7409353903',
  email: 'genieassists@gmail.com',
  pan: 'FVIPK9720D',
  gstin: '05FVIPK9720D1ZL',
  upiName: 'Shaily Nirwan',
  upiId: '7088551155@upi',
  account: '76023889849',
  ifsc: 'SBIN0RRUTGB',
  bank: 'Uttarakhand Gramin Bank',
};

const number = (value) => {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const money = (value) => `₹${number(value).toFixed(2)}`;
const text = (value, fallback = '—') => value === null || value === undefined || value === '' ? fallback : String(value);
const dateText = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return text(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const getCharge = (order, names) => {
  for (const name of names) {
    if (order?.[name] !== undefined && order?.[name] !== null && order?.[name] !== '') return number(order[name]);
  }
  return 0;
};

const twoDigitWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const tensWords = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function underThousand(value) {
  let n = Math.floor(value); let result = '';
  if (n >= 100) { result += `${twoDigitWords[Math.floor(n / 100)]} hundred`; n %= 100; if (n) result += ' '; }
  if (n < 20) return result + (n ? twoDigitWords[n] : '');
  return result + tensWords[Math.floor(n / 10)] + (n % 10 ? `-${twoDigitWords[n % 10]}` : '');
}
function amountInWords(amount) {
  let n = Math.floor(number(amount));
  if (!n) return 'zero';
  const parts = [];
  if (n >= 10000000) { parts.push(`${underThousand(Math.floor(n / 10000000))} crore`); n %= 10000000; }
  if (n >= 100000) { parts.push(`${underThousand(Math.floor(n / 100000))} lakh`); n %= 100000; }
  if (n >= 1000) { parts.push(`${underThousand(Math.floor(n / 1000))} thousand`); n %= 1000; }
  if (n) parts.push(underThousand(n));
  return parts.join(' ');
}

function htmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function rowFromOrder(order, index) {
  return {
    sr: index + 1,
    date: dateText(order.ORDER_DATE || order.DATE || order.TIME_STAMP),
    awb: `${text(order.AWB_NUMBER || order.AWB || order.REFERENCE)}: ${text(order.CARRIER || order.COMPANY_NAME)}`,
    mode: text(order.MODE || order.TRANSPORT_MODE || order.MODE_SHORT),
    pieces: text(order.PIECS || order.PIECES || order.PCS, '0'),
    destination: `${text(order.DEST_PINCODE || order.DESTINATION_PINCODE, '')}${order.DEST_CITY || order.DESTINATION_CITY ? `: ${text(order.DEST_CITY || order.DESTINATION_CITY)}` : ''}`.replace(/^: /, ''),
    chargeWeight: getCharge(order, ['CHG_WT', 'CHARGE_WEIGHT', 'CHG_WEIGHT', 'WEIGHT']),
    freight: getCharge(order, ['FREIGHT', 'FRIEGHT', 'FREIGHT_CHARGE', 'RATE', 'TOTAL_FREIGHT']),
  };
}

function buildInvoiceHtml(rows, client, charges, invoiceDate, totalAmount) {
  const qrPayload = `upi://pay?pa=${BILLER.upiId}&pn=${encodeURIComponent(BILLER.upiName)}&am=${totalAmount.toFixed(2)}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrPayload)}`;
  const rowMarkup = rows.length ? rows.map((row) => `<tr><td class="center">${row.sr}</td><td>${htmlEscape(row.date)}</td><td>${htmlEscape(row.awb)}</td><td class="center">${htmlEscape(row.mode)}</td><td class="center">${htmlEscape(row.pieces)}</td><td>${htmlEscape(row.destination)}</td><td class="right">${row.chargeWeight.toFixed(2)}</td><td class="right">₹${row.freight.toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="8" class="center">No shipments selected for this invoice.</td></tr>';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;font-size:11px;color:#000;margin:0}.box{max-width:800px;margin:auto;background:#fff;padding:20px;border:1px solid #eee}.header{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:16px}.logo{font-size:22px;font-weight:bold}.title{text-align:right}.title h1{margin:0;font-size:25px}.muted{color:#555}.info{display:flex;gap:18px;margin-bottom:15px}.col{width:50%}.col h3{font-size:12px;border-bottom:1px solid #ccc;padding-bottom:3px}.col p{margin:2px 0}.divider{height:2px;background:#000;margin-bottom:15px}.meta{font-weight:bold;margin-bottom:12px}table{width:100%;border-collapse:collapse;margin-bottom:15px}th,td{border:1px solid #000;padding:5px;text-align:left}th{background:#f2f2f2}.center{text-align:center}.right{text-align:right}.totals{display:flex;justify-content:space-between;gap:18px}.payment{width:55%}.charges{width:45%}.charges table{margin:0}.terms{font-size:10px;margin-top:24px}.sign{text-align:right;font-weight:bold;margin-top:35px}
  </style></head><body><div class="box"><div class="header"><div class="logo">${htmlEscape(BILLER.name)}</div><div class="title"><h1>TAX INVOICE</h1><p><b>Invoice Date:</b> ${htmlEscape(invoiceDate)}</p></div></div><div class="info"><div class="col"><h3>Billed By: ${htmlEscape(BILLER.name)}</h3><p><b>Address:</b> ${htmlEscape(BILLER.address)}</p><p><b>Landmark:</b> ${htmlEscape(BILLER.landmark)}</p><p><b>City:</b> ${htmlEscape(BILLER.city)}</p><p><b>Biller Pincode:</b> ${BILLER.pincode}</p><p><b>Phone:</b> ${BILLER.phone}</p><p><b>Email:</b> ${BILLER.email}</p><p><b>PAN / GST:</b> ${BILLER.pan} / ${BILLER.gstin}</p></div><div class="col"><h3>Bill To: ${htmlEscape(client.name)}</h3><p><b>Address:</b> ${htmlEscape(client.address)}</p><p><b>Landmark:</b> ${htmlEscape(client.landmark)}</p><p><b>City:</b> ${htmlEscape(client.city)}</p><p><b>Billing Pincode:</b> ${htmlEscape(client.pincode)}</p><p><b>Mobile Number:</b> ${htmlEscape(client.mobile)}</p><p><b>PAN / GST:</b> ${htmlEscape(client.pan)} / ${htmlEscape(client.gstin)}</p></div></div><div class="divider"></div><div class="meta">Bill For SAC Code 996812 Courier Services</div><table><thead><tr><th class="center">Sr</th><th>Date</th><th>AWB: Carrier</th><th class="center">Mode</th><th class="center">Pieces</th><th>Destination</th><th class="right">Chg. Wt</th><th class="right">Freight</th></tr></thead><tbody>${rowMarkup}</tbody><tfoot><tr><th colspan="4" class="right">Totals</th><th class="center">${rows.reduce((sum, row) => sum + number(row.pieces), 0)}</th><th></th><th class="right">${rows.reduce((sum, row) => sum + row.chargeWeight, 0).toFixed(2)}</th><th class="right">₹${charges.freight.toFixed(2)}</th></tr></tfoot></table><div class="totals"><div class="payment"><p><b>Pay via UPI:</b></p><img src="${qrUrl}" width="120" height="120" style="border:1px solid #ddd"><p>Name: ${BILLER.upiName}<br>UPI ID: ${BILLER.upiId}</p><p><b>Bank Details:</b><br>A/C: ${BILLER.account}<br>IFSC: ${BILLER.ifsc}<br>Bank: ${BILLER.bank}</p><p><b>Total Amount (in words):</b><br>${amountInWords(totalAmount)} only</p></div><div class="charges"><table><thead><tr><th>Charge Type</th><th class="right">Amount (₹)</th></tr></thead><tbody>${Object.entries(charges).map(([key, value]) => `<tr><td>${htmlEscape(key)}</td><td class="right">₹${number(value).toFixed(2)}</td></tr>`).join('')}<tr><th>Total Amount</th><th class="right">₹${totalAmount.toFixed(2)}</th></tr></tbody></table></div></div><div class="terms"><b>Terms & Conditions:</b><ol><li>All disputes are subject to Dehradun Jurisdiction.</li><li>Payment due on receipt of this bill.</li><li>This is a computer-generated bill; no signature is required.</li><li>Dev. charges of 5.00% will be waived if paid within 10 days.</li><li>This Bill is for SAC Code 996812 (Courier Services).</li></ol></div><div class="sign">Authorized Signatory<br><br>for ${htmlEscape(BILLER.name)}</div></div></body></html>`;
}

export default function InvoiceScreen({ orders = [], b2bList = [], user = {} }) {
  const [printing, setPrinting] = useState(false);
  const rows = useMemo(() => orders.map(rowFromOrder), [orders]);
  const sourceOrder = orders[0] || {};
  const clientRecord = b2bList.find((item) => item.CODE === sourceOrder.CODE) || {};
  const client = {
    name: clientRecord.B2B_NAME || sourceOrder.B2B_NAME || sourceOrder.CLIENT_NAME || user.NAME || user.USER || 'Client',
    address: clientRecord.B2B_ADDRESS || sourceOrder.B2B_ADDRESS || sourceOrder.BILLING_ADDRESS || '—',
    landmark: clientRecord.B2B_LANDMARK || sourceOrder.B2B_LANDMARK || '—',
    city: [clientRecord.B2B_CITY || sourceOrder.B2B_CITY, clientRecord.B2B_STATE || sourceOrder.B2B_STATE].filter(Boolean).join(', ') || '—',
    pincode: clientRecord.B2B_PINCODE || sourceOrder.B2B_PINCODE || '—',
    mobile: clientRecord.MOBILE_NUMBER || sourceOrder.MOBILE_NUMBER || sourceOrder.CLIENT_MOBILE || '—',
    pan: clientRecord.PAN || sourceOrder.PAN || '—',
    gstin: clientRecord.GSTIN || sourceOrder.GSTIN || '—',
  };
  const charges = useMemo(() => {
    const sum = (names) => orders.reduce((total, order) => total + getCharge(order, names), 0);
    return {
      Freight: rows.reduce((total, row) => total + row.freight, 0),
      'Fuel Charge': sum(['FUEL_CHARGES', 'FUEL_CHARGE', 'FUEL']),
      'COD Charge': sum(['COD_CHARGES', 'COD_CHARGE']),
      'Topay Charge': sum(['TOPAY_CHARGES', 'TOPAY_CHARGE', 'TOPAY']),
      'Insurance Charge': sum(['FOV_CHARGES', 'FOV_CHARGE', 'INSURANCE_CHARGE']),
      'Eway Handle Charge': sum(['EWAY_CHARGES', 'EWAY_CHARGE', 'EWAY_HANDLE_CHARGE']),
      'Awb Charges': sum(['AWB_CHARGES', 'AWB_CHARGE']),
      'Packaging Charges': sum(['PACKING_CHARGES', 'PACKAGING_CHARGE']),
      'Development Charges': sum(['DEV_CHARGES', 'DEVELOPMENT_CHARGE']),
      'Taxable Amount': sum(['TAXABLE_AMOUNT', 'TAXABLE']),
      SGST: sum(['SGST']),
      CGST: sum(['CGST']),
      IGST: sum(['IGST']),
    };
  }, [orders, rows]);
  const totalAmount = useMemo(() => {
    const explicit = orders.reduce((sum, order) => sum + getCharge(order, ['TOTAL_AMOUNT', 'GRAND_TOTAL', 'TOTAL_CHARGES']), 0);
    return explicit || Object.values(charges).reduce((sum, value) => sum + value, 0);
  }, [charges, orders]);
  const invoiceDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const qrPayload = `upi://pay?pa=${BILLER.upiId}&pn=${encodeURIComponent(BILLER.upiName)}&am=${totalAmount.toFixed(2)}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(qrPayload)}`;

  const printInvoice = async () => {
    setPrinting(true);
    try { await Print.printAsync({ html: buildInvoiceHtml(rows, client, charges, invoiceDate, totalAmount) }); }
    catch (_) {}
    finally { setPrinting(false); }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.invoiceBox}>
        <View style={styles.header}><View><Text style={styles.logo}>{BILLER.name}</Text><Text style={styles.logoSub}>Courier Services</Text></View><View style={styles.titleSection}><Text style={styles.invoiceTitle}>TAX INVOICE</Text><Text style={styles.invoiceDate}>Invoice Date: {invoiceDate}</Text><TouchableOpacity style={styles.printButton} onPress={printInvoice} disabled={printing}>{printing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.printText}>▣ Print Invoice</Text>}</TouchableOpacity></View></View>
        <View style={styles.infoContainer}><View style={styles.infoColumn}><Text style={styles.infoHeading}>Billed By: {BILLER.name}</Text><Text style={styles.infoLine}><Text style={styles.bold}>Address:</Text> {BILLER.address}</Text><Text style={styles.infoLine}><Text style={styles.bold}>Landmark:</Text> {BILLER.landmark}</Text><Text style={styles.infoLine}><Text style={styles.bold}>City:</Text> {BILLER.city}</Text><Text style={styles.infoLine}><Text style={styles.bold}>Biller Pincode:</Text> {BILLER.pincode}</Text><Text style={styles.infoLine}><Text style={styles.bold}>Phone:</Text> {BILLER.phone}</Text><Text style={styles.infoLine}><Text style={styles.bold}>Email:</Text> {BILLER.email}</Text><Text style={styles.infoLine}><Text style={styles.bold}>PAN / GST:</Text> {BILLER.pan} / {BILLER.gstin}</Text></View><View style={styles.verticalDivider} /><View style={styles.infoColumn}><Text style={styles.infoHeading}>Bill To: {client.name}</Text><Text style={styles.infoLine}><Text style={styles.bold}>Address:</Text> {client.address}</Text><Text style={styles.infoLine}><Text style={styles.bold}>Landmark:</Text> {client.landmark}</Text><Text style={styles.infoLine}><Text style={styles.bold}>City:</Text> {client.city}</Text><Text style={styles.infoLine}><Text style={styles.bold}>Billing Pincode:</Text> {client.pincode}</Text><Text style={styles.infoLine}><Text style={styles.bold}>Mobile Number:</Text> {client.mobile}</Text><Text style={styles.infoLine}><Text style={styles.bold}>PAN / GST:</Text> {client.pan} / {client.gstin}</Text></View></View>
        <View style={styles.divider} /><Text style={styles.sac}>Bill For SAC Code 996812 Courier Services</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator><View style={styles.table}><View style={[styles.tableRow, styles.tableHeader]}>{['Sr', 'Date', 'AWB: Carrier', 'Mode', 'Pieces', 'Destination', 'Chg. Wt', 'Freight'].map((heading) => <Text key={heading} style={[styles.tableCell, styles.tableHead]}>{heading}</Text>)}</View>{rows.length ? rows.map((row) => <View style={styles.tableRow} key={`${row.awb}-${row.sr}`}><Text style={styles.tableCell}>{row.sr}</Text><Text style={styles.tableCell}>{row.date}</Text><Text style={[styles.tableCell, styles.awbCell]}>{row.awb}</Text><Text style={styles.tableCell}>{row.mode}</Text><Text style={styles.tableCell}>{row.pieces}</Text><Text style={[styles.tableCell, styles.destinationCell]}>{row.destination}</Text><Text style={[styles.tableCell, styles.right]}>{row.chargeWeight.toFixed(2)}</Text><Text style={[styles.tableCell, styles.right]}>{money(row.freight)}</Text></View>) : <View style={styles.emptyTable}><Text style={styles.emptyText}>No shipments available for this invoice.</Text></View>}<View style={[styles.tableRow, styles.totalRow]}><Text style={[styles.tableCell, styles.totalLabel]}>Totals</Text><Text style={styles.tableCell}>{rows.reduce((sum, row) => sum + number(row.pieces), 0)}</Text><Text style={styles.tableCell}>{rows.reduce((sum, row) => sum + row.chargeWeight, 0).toFixed(2)}</Text><Text style={[styles.tableCell, styles.right]}>{money(charges.Freight)}</Text></View></View></ScrollView>
        <View style={styles.totalsContainer}><View style={styles.paymentDetails}><Text style={styles.paymentHeading}>Pay via UPI:</Text><Image source={{ uri: qrUrl }} style={styles.qr} /><Text style={styles.infoLine}>Name: {BILLER.upiName}{'\n'}UPI ID: {BILLER.upiId}</Text><Text style={styles.paymentHeading}>Bank Details:</Text><Text style={styles.infoLine}>A/C: {BILLER.account}{'\n'}IFSC: {BILLER.ifsc}{'\n'}Bank: {BILLER.bank}</Text><Text style={styles.paymentHeading}>Total Amount (in words):</Text><Text style={styles.infoLine}>{amountInWords(totalAmount)} only</Text></View><View style={styles.chargeBox}><Text style={styles.chargeHeader}>Charge Type                     Amount (₹)</Text>{Object.entries(charges).map(([key, value]) => <View style={styles.chargeRow} key={key}><Text style={styles.chargeName}>{key}</Text><Text style={styles.chargeValue}>{money(value)}</Text></View>)}<View style={[styles.chargeRow, styles.grandTotal]}><Text style={styles.chargeName}>Total Amount</Text><Text style={styles.chargeValue}>{money(totalAmount)}</Text></View></View></View>
        <View style={styles.terms}><Text style={styles.termsTitle}>Terms & Conditions:</Text><Text style={styles.term}>1. All disputes are subject to Dehradun Jurisdiction.</Text><Text style={styles.term}>2. Payment due on receipt of this bill.</Text><Text style={styles.term}>3. This is a computer-generated bill; no signature is required.</Text><Text style={styles.term}>4. Dev. charges of 5.00% will be waived if paid within 10 days.</Text><Text style={styles.term}>5. This Bill is for SAC Code 996812 (Courier Services).</Text></View><View style={styles.signatory}><Text style={styles.signText}>Authorized Signatory</Text><Text style={styles.signText}>for {BILLER.name}</Text></View>
      </View>
    </ScrollView>
  );
}

const shadow = Platform.OS === 'web' ? { boxShadow: '0px 0px 12px rgba(0,0,0,0.15)' } : { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 };
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f5f5' }, content: { padding: 16, paddingBottom: 30 }, invoiceBox: { width: '100%', maxWidth: 800, alignSelf: 'center', backgroundColor: '#fff', padding: 20, borderWidth: 1, borderColor: '#eee', ...shadow }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 2, borderBottomColor: '#000', paddingBottom: 14, marginBottom: 18, gap: 12 }, logo: { color: '#111', fontFamily: FONTS.extraBold, fontSize: 23 }, logoSub: { color: '#555', fontFamily: FONTS.body, fontSize: 11, marginTop: 3 }, titleSection: { alignItems: 'flex-end' }, invoiceTitle: { color: '#111', fontFamily: FONTS.extraBold, fontSize: 25 }, invoiceDate: { color: '#333', fontFamily: FONTS.body, fontSize: 11, marginTop: 4 }, printButton: { backgroundColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, marginTop: 8, minWidth: 110, alignItems: 'center' }, printText: { color: '#fff', fontFamily: FONTS.bold, fontSize: 10 }, infoContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 }, infoColumn: { flex: 1 }, verticalDivider: { width: 1, backgroundColor: '#ccc' }, infoHeading: { color: '#111', fontFamily: FONTS.bold, fontSize: 12, borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 4, marginBottom: 4 }, infoLine: { color: '#222', fontFamily: FONTS.body, fontSize: 10, lineHeight: 15, marginVertical: 1 }, bold: { fontFamily: FONTS.bold }, divider: { height: 2, backgroundColor: '#000', marginBottom: 14 }, sac: { color: '#111', fontFamily: FONTS.bold, fontSize: 11, marginBottom: 10 }, table: { minWidth: 760, borderWidth: 1, borderColor: '#000', marginBottom: 16 }, tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', minHeight: 31, alignItems: 'center' }, tableHeader: { backgroundColor: '#f2f2f2' }, tableCell: { color: '#111', borderRightWidth: 1, borderRightColor: '#000', paddingHorizontal: 5, paddingVertical: 5, fontFamily: FONTS.body, fontSize: 9, width: 74 }, tableHead: { fontFamily: FONTS.bold, fontSize: 9 }, awbCell: { width: 145 }, destinationCell: { width: 155 }, right: { textAlign: 'right' }, emptyTable: { padding: 22, alignItems: 'center' }, emptyText: { color: '#64748b', fontFamily: FONTS.body, fontSize: 11 }, totalRow: { backgroundColor: '#fafafa' }, totalLabel: { width: 293, textAlign: 'right', fontFamily: FONTS.bold }, totalsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 18 }, paymentDetails: { flexGrow: 1, flexBasis: 280 }, paymentHeading: { color: '#111', fontFamily: FONTS.bold, fontSize: 11, marginTop: 8, marginBottom: 3 }, qr: { width: 140, height: 140, borderWidth: 1, borderColor: '#ddd', marginVertical: 7 }, chargeBox: { flexGrow: 1, flexBasis: 280, borderWidth: 1, borderColor: '#000', alignSelf: 'flex-start' }, chargeHeader: { backgroundColor: '#f2f2f2', color: '#111', fontFamily: FONTS.bold, fontSize: 9, padding: 6, borderBottomWidth: 1, borderBottomColor: '#000' }, chargeRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingHorizontal: 6, paddingVertical: 5, gap: 8 }, chargeName: { color: '#222', fontFamily: FONTS.body, fontSize: 9, flex: 1 }, chargeValue: { color: '#222', fontFamily: FONTS.body, fontSize: 9, textAlign: 'right' }, grandTotal: { borderBottomWidth: 0, backgroundColor: '#fafafa' }, terms: { marginTop: 8, marginBottom: 30 }, termsTitle: { color: '#111', fontFamily: FONTS.bold, fontSize: 10 }, term: { color: '#333', fontFamily: FONTS.body, fontSize: 9, lineHeight: 14 }, signatory: { alignItems: 'flex-end', marginTop: 10 }, signText: { color: '#111', fontFamily: FONTS.bold, fontSize: 11, marginTop: 4 },
});
