import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as Print from 'expo-print';
import { COLORS } from '../styles/theme';
import { ROLE_LEVELS } from '../core/config';
import { getAppData } from '../core/storage';
import Dropdown from '../components/Dropdown';

const TILE_MIN_ROLE = {
  'sales-invoices': 'MANAGER', 'credit-notes': 'MANAGER', customers: 'CLIENT', 'service-items': 'MANAGER', 'product-items': 'MANAGER', billing: 'CLIENT',
  'purchase-bills': 'MANAGER', 'debit-notes': 'MANAGER', suppliers: 'CLIENT', inventory: 'MANAGER', 'stock-transfers': 'MANAGER', receipts: 'MANAGER', payments: 'MANAGER',
  cheques: 'ACCOUNTANT', 'bank-accounts': 'ACCOUNTANT', wallet: 'CLIENT', employees: 'MANAGER', payroll: 'MANAGER', 'expense-claims': 'MANAGER', 'petty-cash': 'MANAGER',
  'staff-advances': 'MANAGER', 'branch-advances': 'MANAGER', 'chart-of-accounts': 'CLIENT', 'journal-entries': 'MANAGER', recurring: 'ACCOUNTANT', 'opening-balances': 'ACCOUNTANT',
  'pending-approvals': 'ACCOUNTANT', taxes: 'MANAGER', summary: 'MANAGER', 'close-fy': 'ACCOUNTANT', 'bank-recon': 'ACCOUNTANT', 'bulk-import': 'ACCOUNTANT',
};

const GROUPS = [
  ['Overview', [['summary', '📊', 'Financial Summary']]],
  ['Sales', [['billing', '🧮', 'Billing'], ['sales-invoices', '🧾', 'Sales Invoices'], ['credit-notes', '📝', 'Credit Notes'], ['customers', '🤝', 'Customers']]],
  ['Purchases', [['purchase-bills', '🛒', 'Purchase Bills'], ['debit-notes', '📄', 'Debit Notes'], ['suppliers', '🏭', 'Suppliers']]],
  ['Inventory', [['inventory', '📦', 'Inventory'], ['stock-transfers', '🔀', 'Stock Transfers'], ['product-items', '🧰', 'Product Items'], ['service-items', '🛠️', 'Service Items']]],
  ['Payments', [['receipts', '💰', 'Receipts'], ['payments', '💸', 'Payments'], ['cheques', '🏦', 'Cheques & PDC'], ['bank-accounts', '🏛️', 'Bank Accounts'], ['wallet', '👛', 'Wallet']]],
  ['Payroll & Expenses', [['employees', '👥', 'Employees'], ['payroll', ['💼'], 'Payroll'], ['expense-claims', '🧳', 'Expense Claims'], ['petty-cash', '🪙', 'Petty Cash'], ['staff-advances', '👤', 'Staff Advances'], ['branch-advances', '🏢', 'Branch Advances']]],
  ['Ledger & Journals', [['chart-of-accounts', '📒', 'Chart of Accounts'], ['journal-entries', '✏️', 'Journal Entries'], ['recurring', '🔄', 'Recurring Entries'], ['opening-balances', '🗂️', 'Opening Balances'], ['pending-approvals', '⏳', 'Pending Approvals']]],
  ['Taxes & Reports', [['taxes', '🏷️', 'Taxes'], ['close-fy', '🗂️', 'Close FY'], ['bank-recon', '🏦', 'Bank Recon'], ['bulk-import', '📥', 'Bulk Import']]],
];

const ICON = (value) => Array.isArray(value) ? value[0] : value;
const roleLevel = (role) => ROLE_LEVELS[role] || 0;
const canTile = (role, tile) => roleLevel(role) >= (ROLE_LEVELS[TILE_MIN_ROLE[tile]] || 0);
const records = (value) => Array.isArray(value) ? value : Object.values(value || {});
const money = (value) => `₹${(Number(value) || 0).toFixed(2)}`;
const dateValue = (value) => { if (!value) return '—'; const numeric = Number(value); const d = new Date(numeric > 100000000000 ? numeric : numeric > 1000000000 ? numeric * 1000 : value); return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); };
const lower = (value) => String(value || '').toLowerCase();
const keyOf = (tile, record) => ({ customers: record.CODE, suppliers: record.CODE, 'sales-invoices': record.DOX_KEY, 'purchase-bills': record.DOX_KEY, 'credit-notes': record.DOX_KEY, 'debit-notes': record.DOX_KEY, receipts: record.DOX_KEY, payments: record.DOX_KEY, employees: record.STAFF_CODE, payroll: record.DOX_KEY, 'journal-entries': record.DOX_KEY, 'opening-balances': record.DOX_KEY, recurring: record.TXN_ID, taxes: record.period, inventory: record.key, 'bank-accounts': record.key || record.Key, cheques: record.key || record.Key, services: record.id }[tile] || record.id || record.REFERENCE || record.CODE || record.DOX_KEY || record.TXN_ID || record.PINCODE);

function actionTypeFor(tile) {
  if (tile === 'customers') return { title: 'Record Receipt', path: '/api/manager/receipts', query: 'code', label: 'Receipt amount' };
  if (tile === 'suppliers') return { title: 'Record Payment', path: '/api/manager/payments', query: 'code', label: 'Payment amount' };
  if (tile === 'credit-notes') return { title: 'Issue Credit Note', path: '/api/manager/credit-notes', query: 'code', label: 'Credit amount' };
  if (tile === 'debit-notes') return { title: 'Issue Debit Note', path: '/api/manager/debit-notes', query: 'code', label: 'Debit amount' };
  return null;
}

export default function VaultScreen({ token = '', apiBase = '', user = {} }) {
  const role = user?.ROLE || 'CLIENT';
  const [data, setData] = useState({});
  const [activeTile, setActiveTile] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(user?.BRANCH || '');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [managerIo, setManagerIo] = useState(null);
  const [action, setAction] = useState(null);
  const [actionForm, setActionForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: '', description: '' });
  const [actionBusy, setActionBusy] = useState(false);
  const [customerTab, setCustomerTab] = useState('transactions');
  const [liveRows, setLiveRows] = useState([]);

  const branchRequired = roleLevel(role) > ROLE_LEVELS.MANAGER;
  const branch = branchRequired ? selectedBranch : (user?.BRANCH || selectedBranch || '');
  const branches = records(data.BRANCHES).filter((item) => item.BRANCH_CODE);

  const callApi = async (path, method = 'GET', body) => {
    const response = await fetch(`${apiBase}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body || {}) });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.status === 'error') throw new Error(json.message || json.detail || `Request failed (${response.status})`);
    return json;
  };

  const reload = async () => { setLoading(true); try { setData(await getAppData()); } catch (error) { setMessage(error.message); } finally { setLoading(false); } };
  useEffect(() => { reload(); }, []);
  useEffect(() => { if (activeTile === 'services') callApi('/api/services/status').then((result) => setLiveRows(records(result.data || result))).catch(() => {}); }, [activeTile]);

  const localLedger = records(data.LEDGER);
  const headers = records(data.HEADER);
  const branchFilter = (row) => !branch || lower(row.BRANCH) === lower(branch);
  const localTileRows = (tile) => {
    if (tile === 'customers') return records(data.B2B).filter((row) => row.B2B_TYPE === 'CLIENT' && branchFilter(row));
    if (tile === 'suppliers') return records(data.B2B).filter((row) => ['SUPPLIER', 'CARRIER'].includes(row.B2B_TYPE) && branchFilter(row));
    if (['sales-invoices', 'purchase-bills', 'credit-notes', 'debit-notes', 'receipts', 'payments'].includes(tile)) {
      const type = { 'sales-invoices': 'Sales Invoice', 'purchase-bills': 'Purchase Invoice', 'credit-notes': 'Credit Note', 'debit-notes': 'Debit Note', receipts: 'Receipt', payments: 'Payment' }[tile];
      return headers.filter((row) => row.DOX_TYPE === type && branchFilter(row));
    }
    if (tile === 'taxes') return headers.filter((row) => (+row.SGST || 0) + (+row.CGST || 0) + (+row.IGST || 0) > 0 && branchFilter(row));
    if (tile === 'journal-entries') return headers.filter((row) => row.DOX_TYPE === 'Journal Entry' && branchFilter(row));
    if (tile === 'opening-balances') return headers.filter((row) => row.DOX_TYPE === 'Opening Balance' && branchFilter(row));
    if (tile === 'recurring') return localLedger.filter((row) => row.ENTRY_TYPE === 'JOURNAL' && row.JOURNAL_TYPE === 'RECURRING' && branchFilter(row));
    if (tile === 'pending-approvals') return localLedger.filter((row) => row.STATUS === 'PENDING' && branchFilter(row));
    if (tile === 'employees' || tile === 'payroll') return records(data.STAFF).filter(branchFilter);
    if (['expense-claims', 'petty-cash', 'staff-advances', 'branch-advances', 'bank-recon'].includes(tile)) return localLedger.filter((row) => branchFilter(row));
    if (tile === 'billing') return records(data.ORDERS).filter(branchFilter);
    return [];
  };

  const summary = useMemo(() => {
    let receivable = 0; let payable = 0; let bank = 0; let staff = 0;
    localLedger.filter(branchFilter).forEach((row) => {
      const debit = Number(row.DEBIT) || 0; const credit = Number(row.CREDIT) || 0; const account = lower(row.ACCOUNT);
      if (account === 'accounts receivable') receivable += debit - credit;
      if (account === 'accounts payable') payable += credit - debit;
      if (account.includes('bank') || account.includes('cash')) bank += debit - credit;
      if (account.includes('staff advance')) staff += debit - credit;
    });
    return { receivable, payable, bank, staff, net: bank + receivable - payable };
  }, [localLedger, branch]);

  const tileCount = (tile) => {
    if (tile === 'summary') return money(summary.net);
    if (tile === 'inventory' || tile === 'bank-accounts' || tile === 'cheques' || tile === 'chart-of-accounts' || tile === 'service-items' || tile === 'product-items') return liveRows.length || '…';
    if (tile === 'wallet') return '→';
    return localTileRows(tile).length;
  };

  const loadLiveTile = async (tile) => {
    setLiveRows([]);
    try {
      if (tile === 'inventory') { const result = await callApi(`/api/manager/all-inventory-items${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`); setLiveRows(result.inventoryItems || []); }
      else if (tile === 'bank-accounts') { const result = await callApi(`/api/manager/bank-accounts${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`); setLiveRows(result.bankAndCashAccounts || []); }
      else if (tile === 'cheques') { const result = await callApi(`/api/manager/cheques${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`); setLiveRows(result.cheques || result.data || []); }
      else if (tile === 'chart-of-accounts' || tile === 'service-items' || tile === 'product-items') { const result = await callApi('/api/manager/cache/keys'); const key = tile === 'chart-of-accounts' ? 'coa' : tile === 'service-items' ? 'non_inventory_items' : 'inventory_items'; setLiveRows(Object.entries(result?.[lower(branch)]?.[key] || result?.[key] || {}).map(([name, value]) => ({ key: value, name }))); }
      else if (tile === 'taxes') setLiveRows([]);
    } catch (error) { setMessage(error.message); }
  };

  const openTile = async (tile) => {
    if (!canTile(role, tile)) return;
    if (branchRequired && !branch) { setMessage('Select a branch before opening this module.'); return; }
    setActiveTile(tile); setSelected(null); setQuery(''); setMessage(''); setCustomerTab('transactions');
    if (['inventory', 'bank-accounts', 'cheques', 'chart-of-accounts', 'service-items', 'product-items'].includes(tile)) await loadLiveTile(tile);
    if (tile === 'services') { try { const result = await callApi('/api/services/status'); setLiveRows(records(result.data || result)); } catch (error) { setMessage(error.message); } }
  };

  const rows = useMemo(() => {
    let result = activeTile ? (['inventory', 'bank-accounts', 'cheques', 'chart-of-accounts', 'service-items', 'product-items', 'services'].includes(activeTile) ? liveRows : localTileRows(activeTile)) : [];
    const q = lower(query.trim());
    if (q) result = result.filter((row) => Object.values(row || {}).some((value) => lower(value).includes(q)));
    return result;
  }, [activeTile, liveRows, query, data, branch, localLedger, headers]);

  const customerStatement = (code) => localLedger.filter((row) => row.CODE === code && row.ACCOUNT === 'Accounts receivable').sort((a, b) => Number(a.TXN_DATE || 0) - Number(b.TXN_DATE || 0));
  const statementRows = selected && ['customers', 'suppliers'].includes(activeTile) ? (activeTile === 'customers' ? customerStatement(selected.CODE) : localLedger.filter((row) => row.CODE === selected.CODE && row.ACCOUNT === 'Accounts payable')) : [];
  const unpaid = statementRows.filter((row) => Number(row.DEBIT || 0) > Number(row.CREDIT || 0));
  const aging = unpaid.reduce((result, row) => { const age = Math.max(0, Math.floor((Date.now() - Number(row.TXN_DATE || Date.now())) / 86400000)); const bucket = age <= 30 ? '0–30 days' : age <= 60 ? '31–60 days' : age <= 90 ? '61–90 days' : '90+ days'; result[bucket] = (result[bucket] || 0) + (Number(row.DEBIT) || 0) - (Number(row.CREDIT) || 0); return result; }, {});

  const openAction = (type) => { setAction(type); setActionForm({ date: new Date().toISOString().slice(0, 10), amount: '', description: '' }); };
  const submitAction = async () => {
    const amount = Number(actionForm.amount);
    if (!selected || !action || !amount || amount <= 0) { Alert.alert('Invalid amount', 'Enter an amount greater than zero.'); return; }
    setActionBusy(true);
    try {
      const payload = action.title.includes('Receipt') ? { Date: actionForm.date, ReceivedIn: '', Customer: selected.CODE, Description: actionForm.description, Lines: [{ Amount: amount }] } : action.title.includes('Payment') ? { Date: actionForm.date, PaidFrom: '', Supplier: selected.CODE, Description: actionForm.description, Lines: [{ Amount: amount }] } : { Date: actionForm.date, Customer: selected.CODE, Supplier: selected.CODE, Description: actionForm.description, Lines: [{ UnitPrice: amount }] };
      await callApi(`${action.path}?${action.query}=${encodeURIComponent(selected.CODE)}`, 'POST', payload);
      setAction(null); setMessage(`${action.title} completed.`); await reload();
    } catch (error) { setMessage(error.message); } finally { setActionBusy(false); }
  };

  const managerStatus = async () => { try { const result = await callApi('/api/getManagerIOStatus'); setManagerIo(Boolean(result.enabled)); } catch (error) { setMessage(error.message); } };
  useEffect(() => { managerStatus(); }, []);
  const toggleManager = async () => { setManagerIo(null); try { const next = !managerIo; await callApi('/api/toggleManagerIO', 'POST', { enabled: next }); setManagerIo(next); } catch (error) { setMessage(error.message); await managerStatus(); } };

  const report = async () => {
    if (!activeTile) return;
    const title = `${GROUPS.flatMap(([, items]) => items).find(([id]) => id === activeTile)?.[2] || activeTile} Report`;
    const reportRows = rows.slice(0, 500).map((row) => `<tr>${Object.entries(row).slice(0, 8).map(([key, value]) => `<td>${String(value == null ? '' : value).replace(/[<>&]/g, '')}</td>`).join('')}</tr>`).join('');
    const headersHtml = rows[0] ? `<tr>${Object.keys(rows[0]).slice(0, 8).map((key) => `<th>${key}</th>`).join('')}</tr>` : '';
    const html = `<html><head><style>body{font-family:Arial;padding:20px}h1{color:#1e3a5f}table{width:100%;border-collapse:collapse;font-size:10px}td,th{border:1px solid #cbd5e1;padding:5px;text-align:left}th{background:#e2e8f0}</style></head><body><h1>${title}</h1><p>Branch: ${branch || 'All'} · Generated: ${new Date().toLocaleString('en-IN')}</p><table>${headersHtml}${reportRows}</table></body></html>`;
    try { await Print.printAsync({ html }); } catch (error) { Alert.alert('Report failed', error.message); }
  };

  const renderSummary = () => <View><Text style={styles.detailHeading}>🏛️ Financial Dashboard</Text><Text style={styles.detailDescription}>Branch: {branch || 'All branches'} · local LEDGER summary</Text><View style={styles.metricGrid}>{[['Receivables', summary.receivable, '#fee2e2'], ['Payables', summary.payable, '#dcfce7'], ['Bank & Cash', summary.bank, '#dbeafe'], ['Staff Advances', summary.staff, '#ede9fe']].map(([label, value, color]) => <View key={label} style={[styles.metric, { backgroundColor: color }]}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{money(value)}</Text></View>)}</View><View style={styles.netCard}><Text style={styles.metricLabel}>NET OPERATIONAL POSTURE</Text><Text style={[styles.netValue, { color: summary.net >= 0 ? '#15803d' : '#dc2626' }]}>{money(summary.net)}</Text><Text style={styles.detailDescription}>Bank Balance + Receivables − Payables</Text></View></View>;

  const renderRecord = (row, index) => {
    const id = keyOf(activeTile, row);
    const name = row.B2B_NAME || row.B2B || row.STAFF_NAME || row.DOX_REF || row.name || row.itemName || row.MODE || row.ACCOUNT || row.DESCRIPTION || id || `Row ${index + 1}`;
    const amount = row.AMOUNT || row.TOTAL || row.BALANCE || row.DEBIT || row.CREDIT || row.qtyOnHand;
    return <TouchableOpacity key={`${id}-${index}`} style={[styles.recordCard, selected && keyOf(activeTile, selected) === id && styles.recordSelected]} onPress={() => setSelected(row)}><View style={{ flex: 1 }}><Text style={styles.recordTitle}>{row.icon || ''} {String(name)}</Text><Text style={styles.recordSub}>{row.CODE || row.BRANCH || row.COMPANY_NAME || row.DOX_TYPE || row.ENTRY_TYPE || row.description || row.state || ''}</Text></View><View style={styles.recordRight}><Text style={styles.recordAmount}>{typeof amount === 'number' || !Number.isNaN(Number(amount)) ? money(amount) : String(amount || '—')}</Text><Text style={styles.recordDate}>{dateValue(row.DOX_DATE || row.IO_TIMESTAMP || row.TXN_DATE || row.ENTRY_DATE)}</Text></View></TouchableOpacity>;
  };

  const renderDetail = () => {
    if (!selected) return <View style={styles.empty}><Text style={styles.emptyText}>Select an item to view details.</Text></View>;
    if (activeTile === 'summary') return renderSummary();
    if (['customers', 'suppliers'].includes(activeTile)) return <View><Text style={styles.detailHeading}>{selected.B2B_NAME || selected.CODE}</Text><Text style={styles.detailDescription}>{selected.CODE} · {selected.BRANCH || branch} · {selected.MOBILE_NUMBER || selected.MOBILE || 'No mobile'}</Text><View style={styles.detailActions}><TouchableOpacity style={styles.smallButton} onPress={() => openAction(actionTypeFor(activeTile))}><Text style={styles.smallButtonText}>{activeTile === 'customers' ? 'Record Receipt' : 'Record Payment'}</Text></TouchableOpacity>{activeTile === 'customers' ? <TouchableOpacity style={styles.smallButton} onPress={() => openAction(actionTypeFor('credit-notes'))}><Text style={styles.smallButtonText}>Credit Note</Text></TouchableOpacity> : <TouchableOpacity style={styles.smallButton} onPress={() => openAction(actionTypeFor('debit-notes'))}><Text style={styles.smallButtonText}>Debit Note</Text></TouchableOpacity>}</View><View style={styles.tabs}>{['transactions', 'unpaid', 'summary', 'aging'].map((tab) => <TouchableOpacity key={tab} style={[styles.tab, customerTab === tab && styles.tabActive]} onPress={() => setCustomerTab(tab)}><Text style={[styles.tabText, customerTab === tab && styles.tabTextActive]}>{tab}</Text></TouchableOpacity>)}</View>{customerTab === 'summary' ? <View style={styles.summaryBox}><Text>Invoices: {statementRows.filter((r) => Number(r.DEBIT) > 0).length}</Text><Text>Payments: {statementRows.filter((r) => Number(r.CREDIT) > 0).length}</Text><Text>Total invoiced: {money(statementRows.reduce((sum, r) => sum + Number(r.DEBIT || 0), 0))}</Text><Text>Total paid: {money(statementRows.reduce((sum, r) => sum + Number(r.CREDIT || 0), 0))}</Text></View> : customerTab === 'aging' ? <View>{Object.entries(aging).map(([label, value]) => <View style={styles.detailPair} key={label}><Text>{label}</Text><Text style={styles.bold}>{money(value)}</Text></View>)}</View> : <View>{(customerTab === 'unpaid' ? unpaid : statementRows).map((row, index) => renderRecord(row, index))}{!(customerTab === 'unpaid' ? unpaid : statementRows).length && <Text style={styles.emptyText}>No entries found.</Text>}</View>}</View>;
    if (activeTile === 'taxes') { const tax = Number(selected.SGST || 0) + Number(selected.CGST || 0) + Number(selected.IGST || 0); return <View><Text style={styles.detailHeading}>Tax Document · {selected.DOX_REF || selected.DOX_KEY}</Text><Text style={styles.detailDescription}>{selected.DOX_TYPE} · {dateValue(selected.IO_TIMESTAMP)}</Text><View style={styles.metricGrid}><View style={styles.metric}><Text>Taxable</Text><Text style={styles.bold}>{money(selected.TAXABLE)}</Text></View><View style={styles.metric}><Text>CGST</Text><Text style={styles.bold}>{money(selected.CGST)}</Text></View><View style={styles.metric}><Text>SGST</Text><Text style={styles.bold}>{money(selected.SGST)}</Text></View><View style={styles.metric}><Text>IGST</Text><Text style={styles.bold}>{money(selected.IGST)}</Text></View></View><Text style={styles.totalLine}>Total GST: {money(tax)}</Text></View>; }
    if (activeTile === 'services') return <View><Text style={styles.detailHeading}>{selected.icon} {selected.name}</Text><Text style={styles.detailDescription}>{selected.desc}</Text><Text>Status: {selected.status || '—'} {selected.latency_ms ? `· ${selected.latency_ms}ms` : ''}</Text><View style={styles.detailActions}><TouchableOpacity style={styles.smallButton} onPress={() => callApi(`/api/services/ping/${selected.id}`).then(() => setMessage('Ping completed.')).catch((e) => setMessage(e.message))}><Text style={styles.smallButtonText}>Ping</Text></TouchableOpacity>{selected.id === 'tracking' && <TouchableOpacity style={styles.smallButton} onPress={() => callApi('/api/services/tracking/triggerWorker?ignore_interval=true', 'POST').then(() => setMessage('Tracking worker completed.')).catch((e) => setMessage(e.message))}><Text style={styles.smallButtonText}>Run Worker</Text></TouchableOpacity>}{selected.id === 'managerio' && <TouchableOpacity style={styles.smallButton} onPress={toggleManager}><Text style={styles.smallButtonText}>{managerIo ? 'Pause Sync' : 'Enable Sync'}</Text></TouchableOpacity>}</View></View>;
    if (activeTile === 'inventory') return <View><Text style={styles.detailHeading}>{selected.itemName || selected.ItemName}</Text><Text style={styles.detailDescription}>{selected.description || ''} · Branch {selected.branch || branch}</Text><View style={styles.metricGrid}><View style={styles.metric}><Text>On hand</Text><Text style={styles.bold}>{selected.qtyOnHand ?? '—'}</Text></View><View style={styles.metric}><Text>Available</Text><Text style={styles.bold}>{selected.qtyAvailable ?? '—'}</Text></View><View style={styles.metric}><Text>Reserved</Text><Text style={styles.bold}>{selected.qtyReserved ?? '—'}</Text></View><View style={styles.metric}><Text>Value</Text><Text style={styles.bold}>{money(selected.totalCost)}</Text></View></View></View>;
    return <View><View style={styles.detailHeader}><Text style={styles.detailHeading}>{String(rowTitle(activeTile))}</Text><TouchableOpacity style={styles.smallButton} onPress={report}><Text style={styles.smallButtonText}>Print Report</Text></TouchableOpacity></View>{Object.entries(selected).filter(([key]) => !['PASS', 'RESET_TOKEN'].includes(key)).slice(0, 40).map(([key, value]) => <View style={styles.detailPair} key={key}><Text style={styles.detailKey}>{key}</Text><Text style={styles.detailValue}>{String(value == null || value === '' ? '—' : value)}</Text></View>)}</View>;
  };

  const tileTitle = (tile) => GROUPS.flatMap(([, items]) => items).find(([id]) => id === tile)?.[2] || tile;
  const rowTitle = (tile) => tileTitle(tile);

  return <View style={styles.screen}><View style={styles.header}><View><Text style={styles.title}>The Vault</Text><Text style={styles.subtitle}>Accounting & Finance</Text></View><View style={styles.headerRight}>{branchRequired ? <Dropdown
  label="Branch"
  value={selectedBranch}
  options={branches.map(item => ({ value: item.BRANCH_CODE, label: item.BRANCH_NAME ? `${item.BRANCH_CODE} · ${item.BRANCH_NAME}` : item.BRANCH_CODE }))}
  onChange={setSelectedBranch}
  searchable={branches.length > 8}
  placeholder="Select Branch"
  style={styles.branchDropdown}
/> : <Text style={styles.branchText}>{branch ? `Branch ${branch}` : 'All branches'}</Text>}<TouchableOpacity onPress={toggleManager}><Text style={[styles.managerBadge, managerIo === true && styles.managerOn, managerIo === false && styles.managerOff]}>💼 Manager.io {managerIo == null ? '…' : managerIo ? 'ON' : 'OFF'}</Text></TouchableOpacity></View></View>{message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}{!activeTile ? <ScrollView contentContainerStyle={styles.tilesContent}>{GROUPS.map(([group, items]) => <View key={group} style={styles.group}><Text style={styles.groupTitle}>{group}</Text><View style={styles.grid}>{items.filter(([id]) => canTile(role, id)).map(([id, icon, label]) => <TouchableOpacity key={id} style={styles.tile} onPress={() => openTile(id)}><Text style={styles.tileIcon}>{ICON(icon)}</Text><Text style={styles.tileCount}>{tileCount(id)}</Text><Text style={styles.tileLabel}>{label}</Text></TouchableOpacity>)}</View></View>)}</ScrollView> : <View style={styles.split}><View style={styles.listPane}><View style={styles.listHeader}><TouchableOpacity onPress={() => { setActiveTile(null); setSelected(null); }}><Text style={styles.backText}>‹ Tiles</Text></TouchableOpacity><Text style={styles.listTitle}>{tileTitle(activeTile)}</Text><TouchableOpacity onPress={report}><Text style={styles.backText}>Report</Text></TouchableOpacity></View><TextInput value={query} onChangeText={setQuery} placeholder="Search…" style={styles.search} />{loading ? <ActivityIndicator color={COLORS.primary} style={{ margin: 20 }} /> : <ScrollView>{activeTile === 'summary' ? <TouchableOpacity style={styles.recordCard} onPress={() => setSelected({})}><Text style={styles.recordTitle}>📊 Financial Dashboard</Text><Text style={styles.recordSub}>Receivables {money(summary.receivable)} · Payables {money(summary.payable)}</Text></TouchableOpacity> : rows.length ? rows.map(renderRecord) : <Text style={styles.emptyText}>No records found.</Text>}</ScrollView>}</View><ScrollView style={styles.detailPane} contentContainerStyle={{ padding: 16 }}>{selected ? renderDetail() : <View style={styles.empty}><Text style={styles.emptyText}>Select an item to view details.</Text></View>}</ScrollView></View>}{action ? <Modal visible transparent animationType="slide" onRequestClose={() => setAction(null)}><View style={styles.modalBackdrop}><View style={styles.modal}><View style={styles.detailHeader}><Text style={styles.detailHeading}>{action.title}</Text><TouchableOpacity onPress={() => setAction(null)}><Text>✕</Text></TouchableOpacity></View><Text style={styles.fieldLabel}>Date</Text><TextInput value={actionForm.date} onChangeText={(value) => setActionForm((old) => ({ ...old, date: value }))} style={styles.input} /><Text style={styles.fieldLabel}>{action.label}</Text><TextInput value={actionForm.amount} onChangeText={(value) => setActionForm((old) => ({ ...old, amount: value }))} keyboardType="decimal-pad" style={styles.input} placeholder="0.00" /><Text style={styles.fieldLabel}>Description</Text><TextInput value={actionForm.description} onChangeText={(value) => setActionForm((old) => ({ ...old, description: value }))} style={styles.input} placeholder="Optional narration" /><TouchableOpacity style={styles.primaryButton} onPress={submitAction} disabled={actionBusy}>{actionBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Submit</Text>}</TouchableOpacity></View></View></Modal> : null}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' }, header: { padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, title: { fontSize: 24, fontWeight: '900', color: '#1f2937' }, subtitle: { color: '#64748b', fontSize: 11, marginTop: 3 },  headerRight: { alignItems: 'flex-end', gap: 5 },
  branchDropdown: { minWidth: 180 }, branchText: { color: COLORS.primary, fontSize: 11, fontWeight: '800' }, managerBadge: { fontSize: 10, color: '#475569', backgroundColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }, managerOn: { color: '#166534', backgroundColor: '#dcfce7' }, managerOff: { color: '#991b1b', backgroundColor: '#fee2e2' }, message: { padding: 8, backgroundColor: '#fff7ed', borderBottomWidth: 1, borderBottomColor: '#fed7aa' }, messageText: { color: '#9a3412', fontSize: 11 }, tilesContent: { padding: 14, paddingBottom: 40 }, group: { marginBottom: 18 }, groupTitle: { color: '#9ca3af', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }, tile: { width: 135, minHeight: 110, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#0f172a', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }, tileIcon: { fontSize: 27 }, tileCount: { color: '#111827', fontWeight: '900', fontSize: 18, marginTop: 4 }, tileLabel: { color: '#64748b', fontSize: 10, fontWeight: '800', textAlign: 'center', textTransform: 'uppercase', marginTop: 3 }, split: { flex: 1, flexDirection: 'row' }, listPane: { width: '38%', minWidth: 260, borderRightWidth: 1, borderRightColor: '#e2e8f0', backgroundColor: '#f8fafc' }, detailPane: { flex: 1, backgroundColor: '#fff' }, listHeader: { padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }, listTitle: { fontWeight: '900', color: '#1f2937', flex: 1, textAlign: 'center' }, backText: { color: COLORS.primary, fontWeight: '800', fontSize: 11 }, search: { margin: 10, paddingHorizontal: 10, minHeight: 40, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8 }, recordCard: { marginHorizontal: 10, marginBottom: 8, padding: 11, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 9, flexDirection: 'row', gap: 8 }, recordSelected: { borderColor: COLORS.primary, backgroundColor: '#fff7ed' }, recordTitle: { fontWeight: '800', color: '#1f2937', fontSize: 12 }, recordSub: { color: '#64748b', fontSize: 10, marginTop: 3 }, recordRight: { alignItems: 'flex-end' }, recordAmount: { color: '#334155', fontWeight: '800', fontSize: 11 }, recordDate: { color: '#94a3b8', fontSize: 9, marginTop: 3 }, empty: { minHeight: 220, alignItems: 'center', justifyContent: 'center' }, emptyText: { color: '#94a3b8', padding: 20, textAlign: 'center' }, detailHeading: { color: '#1e3a5f', fontSize: 19, fontWeight: '900', marginBottom: 5 }, detailDescription: { color: '#64748b', fontSize: 11, lineHeight: 17, marginBottom: 10 }, metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 }, metric: { minWidth: 115, flex: 1, padding: 12, borderRadius: 9, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' }, metricLabel: { color: '#64748b', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }, metricValue: { color: '#1f2937', fontSize: 17, fontWeight: '900', marginTop: 5 }, netCard: { padding: 15, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', marginTop: 10 }, netValue: { fontSize: 27, fontWeight: '900', marginTop: 4 }, detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }, detailPair: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }, detailKey: { color: '#64748b', fontSize: 10, fontWeight: '800', flex: 1 }, detailValue: { color: '#1f2937', fontSize: 11, flex: 2, textAlign: 'right' }, bold: { fontWeight: '800', color: '#1f2937' }, detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 }, smallButton: { backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 7 }, smallButtonText: { color: '#1e40af', fontWeight: '800', fontSize: 10 }, primaryButton: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 15 }, primaryText: { color: '#fff', fontWeight: '800' }, tabs: { flexDirection: 'row', gap: 5, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginVertical: 12 }, tab: { paddingHorizontal: 9, paddingVertical: 8 }, tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary }, tabText: { color: '#64748b', fontSize: 10, textTransform: 'capitalize' }, tabTextActive: { color: COLORS.primary, fontWeight: '800' }, summaryBox: { padding: 13, backgroundColor: '#f8fafc', borderRadius: 9, gap: 8 }, totalLine: { marginTop: 10, fontWeight: '900', color: '#1e3a5f' }, fieldLabel: { color: '#475569', fontSize: 11, fontWeight: '800', marginTop: 10, marginBottom: 5 }, input: { minHeight: 42, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 7, paddingHorizontal: 10, color: '#0f172a', backgroundColor: '#fff' }, modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,.45)', justifyContent: 'flex-end' }, modal: { maxHeight: '85%', backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 }, option: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
});
