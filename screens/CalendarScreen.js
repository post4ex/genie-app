import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getSheet } from '../core/storage';
import { COLORS, FONTS } from '../styles/theme';

const HOLIDAYS = {
  '2024-01-26': 'Republic Day',
  '2024-03-25': 'Holi',
  '2024-04-11': 'Eid-ul-Fitr',
  '2024-08-15': 'Independence Day',
  '2024-10-02': 'Gandhi Jayanti',
  '2024-10-31': 'Diwali',
  '2024-11-15': 'Guru Nanak Jayanti',
  '2024-12-25': 'Christmas Day',
  '2025-01-26': 'Republic Day',
  '2025-03-14': 'Holi',
  '2025-03-31': 'Eid-ul-Fitr',
  '2025-04-10': 'Mahavir Jayanti',
  '2025-04-18': 'Good Friday',
  '2025-08-15': 'Independence Day',
  '2025-10-02': 'Gandhi Jayanti',
  '2025-10-20': 'Diwali',
  '2025-11-05': 'Guru Nanak Jayanti',
  '2025-12-25': 'Christmas Day',
  '2026-01-26': 'Republic Day',
  '2026-03-03': 'Holi',
  '2026-03-20': 'Eid-ul-Fitr',
  '2026-04-03': 'Good Friday',
  '2026-08-15': 'Independence Day',
  '2026-10-02': 'Gandhi Jayanti',
  '2026-11-08': 'Diwali',
  '2026-12-25': 'Christmas Day',
};

const OP_STATUS = {
  'Republic Day': 'Closed',
  'Independence Day': 'Closed',
  'Gandhi Jayanti': 'Closed',
  Diwali: 'Closed',
  Deepavali: 'Closed',
  'Christmas Day': 'Closed',
  Holi: 'Closed',
  'Good Friday': 'Partial Ops',
  'Eid-ul-Fitr': 'Partial Ops',
  'Mahavir Jayanti': 'Partial Ops',
  'Guru Nanak Jayanti': 'Closed',
};

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SESSION_OPTIONS = [2024, 2025, 2026];

const pad = (value) => String(value).padStart(2, '0');
const toKey = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;

function statusFor(name) {
  if (!name) return '';
  if (OP_STATUS[name]) return OP_STATUS[name];
  const lower = name.toLowerCase();
  if (lower.includes('diwali') || lower.includes('deepavali') || lower.includes('christmas')) return 'Closed';
  if (lower.includes('eid')) return 'Partial Ops';
  if (lower.includes('republic') || lower.includes('independence') || lower.includes('gandhi')) return 'Closed';
  return 'Subject to Area';
}

function formatDate(date) {
  return date.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

function formatMonth(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function normalizeEvents(value) {
  const records = Array.isArray(value) ? value : Object.values(value || {});
  return records.filter(Boolean).map((event) => ({
    ...event,
    DATE: String(event.DATE || event.date || '').slice(0, 10),
    TITLE: event.TITLE || event.title || 'Scheduled operation',
    TIME: event.TIME || event.time || 'SCHEDULED',
    DESC: event.DESC || event.description || event.DESC_TEXT || 'Operational task.',
  }));
}

function InfoCard({ icon, title, rows }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>{icon} {title}</Text>
      {rows.map(([label, value, danger]) => (
        <View style={styles.infoRow} key={label}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={[styles.infoValue, danger && styles.dangerText]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function DetailItem({ children, tone = 'default' }) {
  return <View style={[styles.detailItem, tone === 'holiday' && styles.holidayDetail, tone === 'task' && styles.taskDetail]}>{children}</View>;
}

export default function CalendarScreen({ token = '', apiBase = '' }) {
  const [sessionYear, setSessionYear] = useState(2025);
  const [currentDate, setCurrentDate] = useState(() => new Date(2025, 0, 1));
  const [events, setEvents] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadEvents = async () => {
      setLoading(true);
      let loaded = [];
      try {
        const local = await getSheet('CALENDAR_EVENTS');
        loaded = normalizeEvents(local);
      } catch (_) {}
      try {
        // The web calendar calls getData for CALENDAR_EVENTS. Keep the same
        // authenticated request, while retaining local/offline events first.
        if (apiBase) {
          const response = await fetch(`${apiBase}/api/getData`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ collection: 'CALENDAR_EVENTS' }),
          });
          const json = await response.json().catch(() => ({}));
          if (response.ok && json.status === 'success' && json.data) loaded = normalizeEvents(json.data);
        }
      } catch (_) {
        // The web intentionally treats internal calendar tasks as optional.
      }
      if (!cancelled) {
        setEvents(loaded);
        setLoading(false);
      }
    };
    loadEvents();
    return () => { cancelled = true; };
  }, [apiBase, token]);

  useEffect(() => {
    const now = new Date();
    setCurrentDate(now.getFullYear() === sessionYear ? now : new Date(sessionYear, 0, 1));
    setSelectedKey(null);
  }, [sessionYear]);

  const gridDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: firstDay }, () => null),
      ...Array.from({ length: count }, (_, index) => index + 1),
    ];
  }, [currentDate]);

  const sessionHolidayRows = useMemo(() => Object.entries(HOLIDAYS)
    .filter(([key]) => {
      const year = Number(key.slice(0, 4));
      return year === sessionYear || year === sessionYear + 1;
    })
    .sort(([a], [b]) => a.localeCompare(b)), [sessionYear]);

  const selectedDate = selectedKey ? new Date(`${selectedKey}T00:00:00Z`) : null;
  const selectedHoliday = selectedKey ? HOLIDAYS[selectedKey] : null;
  const selectedEvents = selectedKey ? events.filter((event) => event.DATE === selectedKey) : [];

  const selectDate = (day) => {
    if (!day) return;
    setSelectedKey(toKey(currentDate.getFullYear(), currentDate.getMonth(), day));
  };

  const changeMonth = (step) => {
    setCurrentDate((previous) => new Date(previous.getFullYear(), previous.getMonth() + step, 1));
    setSelectedKey(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedKey(null);
  };

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        <View style={styles.headerCard}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>◷ Operations Dashboard</Text>
            <Text style={styles.subtitle}>Live India Public Holidays & Internal Task Manager.</Text>
          </View>
          <View style={styles.sessionBar}>
            <View style={styles.readyDot} />
            <View style={styles.sessionOptions}>
              {SESSION_OPTIONS.map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[styles.sessionOption, sessionYear === year && styles.sessionOptionActive]}
                  onPress={() => setSessionYear(year)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sessionYear === year }}
                >
                  <Text style={[styles.sessionText, sessionYear === year && styles.sessionTextActive]}>{year}-{year + 1}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.mainGrid}>
          <View style={styles.calendarCard}>
            <View style={styles.calendarToolbar}>
              <View style={styles.monthControls}>
                <Text style={styles.monthTitle}>{formatMonth(currentDate)}</Text>
                <View style={styles.arrowGroup}>
                  <TouchableOpacity style={styles.arrowButton} onPress={() => changeMonth(-1)} accessibilityLabel="Previous month"><Text style={styles.arrowText}>‹</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.arrowButton} onPress={() => changeMonth(1)} accessibilityLabel="Next month"><Text style={styles.arrowText}>›</Text></TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity onPress={goToToday} accessibilityRole="button"><Text style={styles.todayButton}>GO TO TODAY</Text></TouchableOpacity>
            </View>
            <View style={styles.calendarInner}>
              <View style={styles.dayHeaderRow}>{DAY_HEADERS.map((day) => <Text key={day} style={styles.dayHeader}>{day}</Text>)}</View>
              <View style={styles.calendarGrid}>
                {gridDays.map((day, index) => {
                  const key = day ? toKey(currentDate.getFullYear(), currentDate.getMonth(), day) : `empty-${index}`;
                  const holiday = day ? HOLIDAYS[key] : null;
                  const hasTask = day ? events.some((event) => event.DATE === key) : false;
                  const isToday = day && new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
                  const isSelected = key === selectedKey;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.dayCell, !day && styles.emptyDay, holiday && styles.holidayDay, isSelected && styles.selectedDay]}
                      onPress={() => selectDate(day)}
                      disabled={!day}
                      accessibilityLabel={day ? `${formatDate(new Date(`${key}T00:00:00Z`))}${holiday ? `, ${holiday}` : ''}` : undefined}
                    >
                      {day ? <Text style={[styles.dayNumber, isToday && styles.todayNumber]}>{day}</Text> : null}
                      {holiday ? <Text numberOfLines={2} style={styles.holidayName}>{holiday}</Text> : null}
                      {(holiday || hasTask) ? (
                        <View style={styles.markers}>
                          {holiday ? <View style={[styles.dot, styles.holidayDot]} /> : null}
                          {hasTask ? <View style={[styles.dot, styles.taskDot]} /> : null}
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.sideColumn}>
            <View style={styles.detailCard}>
              <Text style={styles.detailTitle}>{selectedDate ? `${selectedDate.getUTCDate()} ${selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}` : 'Select a date'}</Text>
              <Text style={styles.detailSub}>{selectedDate ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) : 'SCHEDULED OPERATIONS'}</Text>
              {!selectedDate ? (
                <View style={styles.emptyDetails}>
                  <Text style={styles.emptyIcon}>▦</Text>
                  <Text style={styles.emptyText}>Click on a date to view specific tasks, events, or holiday details.</Text>
                </View>
              ) : (
                <View style={styles.detailsList}>
                  {selectedHoliday ? (
                    <DetailItem tone="holiday">
                      <Text style={styles.detailBadge}>⚑ PUBLIC HOLIDAY</Text>
                      <Text style={styles.itemTitle}>{selectedHoliday}</Text>
                      <Text style={styles.itemMeta}>Ops Status: <Text style={styles.bold}>{statusFor(selectedHoliday).toUpperCase()}</Text></Text>
                    </DetailItem>
                  ) : null}
                  {selectedDate.getUTCDay() === 0 ? (
                    <DetailItem>
                      <Text style={styles.sundayTitle}>◉ Sunday - Weekly Off</Text>
                      <Text style={styles.itemMeta}>No scheduled hub operations.</Text>
                    </DetailItem>
                  ) : null}
                  {selectedEvents.map((event, index) => (
                    <DetailItem tone="task" key={`${event.TITLE}-${index}`}>
                      <View style={styles.taskHeader}><Text style={styles.itemTitle}>{event.TITLE}</Text><Text style={styles.taskTime}>{event.TIME}</Text></View>
                      <Text style={styles.itemMeta}>{event.DESC}</Text>
                    </DetailItem>
                  ))}
                  {!selectedHoliday && selectedDate.getUTCDay() !== 0 && selectedEvents.length === 0 ? (
                    <View style={styles.regularDay}><Text style={styles.regularIcon}>✦</Text><Text style={styles.regularText}>REGULAR OPS DAY</Text></View>
                  ) : null}
                </View>
              )}
            </View>
            <View style={styles.cutoffCard}>
              <Text style={styles.cutoffTitle}>⚡ BOOKING DEADLINES</Text>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Express Air</Text><Text style={styles.cutoffValue}>16:30</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Surface / PTL</Text><Text style={styles.cutoffValue}>18:00</Text></View>
            </View>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <InfoCard icon="◷" title="Office Hours" rows={[
            ['Mon - Fri', '09:00 AM - 08:00 PM'], ['Saturday', '10:00 AM - 06:00 PM'], ['Sunday', 'Closed', true],
          ]} />
          <InfoCard icon="▣" title="Service Cut-offs" rows={[
            ['Local Delivery', '12:00 PM'], ['Outstation Air', '04:30 PM'], ['Outstation Surface', '06:00 PM'],
          ]} />
          <InfoCard icon="♧" title="Support Window" rows={[
            ['Voice Support', '10 AM - 7 PM'], ['WhatsApp Chat', '9 AM - 9 PM'], ['Email Query', '24/7 Response'],
          ]} />
        </View>

        <View style={styles.holidayTableCard}>
          <View style={styles.tableHeader}>
            <View><Text style={styles.tableTitle}>Gazetted Holidays</Text><Text style={styles.tableSubtitle}>Official non-working days based on the selected session.</Text></View>
            <Text style={styles.tableIcon}>◎</Text>
          </View>
          {loading ? (
            <View style={styles.loadingRow}><ActivityIndicator color={COLORS.primary} /><Text style={styles.loadingText}>Loading operational events...</Text></View>
          ) : null}
          <View style={styles.tableHeadRow}><Text style={[styles.tableHead, styles.dateColumn]}>Date</Text><Text style={[styles.tableHead, styles.nameColumn]}>Holiday Name</Text><Text style={[styles.tableHead, styles.statusHeadColumn]}>Operation Status</Text></View>
          {sessionHolidayRows.length === 0 ? <Text style={styles.noRows}>No holiday data available for this session.</Text> : sessionHolidayRows.map(([key, name]) => {
            const status = statusFor(name);
            return <TouchableOpacity key={key} style={styles.tableRow} onPress={() => { setCurrentDate(new Date(`${key}T00:00:00Z`)); setSelectedKey(key); }}><Text style={[styles.tableCell, styles.dateColumn, styles.cellBold]}>{formatDate(new Date(`${key}T00:00:00Z`))}</Text><Text style={[styles.tableCell, styles.nameColumn]}>{name}</Text><View style={styles.statusColumn}><Text style={[styles.statusBadge, status === 'Closed' ? styles.closedBadge : styles.partialBadge]}>{status}</Text></View></TouchableOpacity>;
          })}
        </View>

        <View style={styles.notice}><Text style={styles.noticeText}>ⓘ Timings are strictly in IST (GMT+5:30). Public holiday data is served from the internal configuration manifest.</Text></View>
      </View>
    </ScrollView>
  );
}

const shadow = Platform.OS === 'web'
  ? { boxShadow: '0px 4px 14px rgba(15, 23, 42, 0.08)' }
  : { shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 };

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, paddingBottom: 32 },
  container: { width: '100%', maxWidth: 1280, alignSelf: 'center' },
  headerCard: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', padding: 18, marginBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, ...shadow },
  headerTextBlock: { flex: 1, minWidth: 240 },
  title: { color: '#173b70', fontFamily: FONTS.bold, fontSize: 22 },
  subtitle: { color: '#6b7280', fontFamily: FONTS.body, fontSize: 12, marginTop: 5 },
  sessionBar: { backgroundColor: '#173b70', borderRadius: 24, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#12315c' },
  readyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80', marginRight: 8 },
  sessionOptions: { flexDirection: 'row', alignItems: 'center' },
  sessionOption: { paddingHorizontal: 5, paddingVertical: 3, borderRadius: 12 },
  sessionOptionActive: { backgroundColor: 'rgba(255,255,255,0.16)' },
  sessionText: { color: '#dbeafe', fontFamily: FONTS.bold, fontSize: 10, letterSpacing: 0.3 },
  sessionTextActive: { color: '#fff' },
  mainGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', marginHorizontal: -6 },
  calendarCard: { flexGrow: 2, flexBasis: 560, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden', margin: 6, ...shadow },
  calendarToolbar: { backgroundColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  monthControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  monthTitle: { color: '#1f2937', fontFamily: FONTS.bold, fontSize: 17, minWidth: 140 },
  arrowGroup: { flexDirection: 'row', gap: 5 },
  arrowButton: { width: 32, height: 32, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  arrowText: { color: '#374151', fontSize: 24, lineHeight: 24 },
  todayButton: { color: '#1d4ed8', fontFamily: FONTS.bold, fontSize: 10 },
  calendarInner: { padding: 12 },
  dayHeaderRow: { flexDirection: 'row', marginBottom: 4 },
  dayHeader: { flex: 1, textAlign: 'center', color: '#9ca3af', fontFamily: FONTS.bold, fontSize: 9, paddingVertical: 6 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden', backgroundColor: '#e5e7eb' },
  dayCell: { width: '14.2857%', minHeight: 82, backgroundColor: '#fff', borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#e5e7eb', padding: 7, position: 'relative' },
  emptyDay: { backgroundColor: '#f9fafb' },
  holidayDay: { backgroundColor: '#fef2f2' },
  selectedDay: { backgroundColor: '#dbeafe', borderColor: '#2563eb', borderWidth: 2 },
  dayNumber: { color: '#374151', fontFamily: FONTS.bold, fontSize: 13 },
  todayNumber: { color: '#fff', backgroundColor: '#173b70', overflow: 'hidden', borderRadius: 7, paddingHorizontal: 6, paddingVertical: 5, alignSelf: 'flex-start' },
  holidayName: { color: '#dc2626', fontFamily: FONTS.bold, fontSize: 8, lineHeight: 10, marginTop: 3 },
  markers: { flexDirection: 'row', gap: 4, position: 'absolute', bottom: 7, left: 7 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  holidayDot: { backgroundColor: '#ef4444' },
  taskDot: { backgroundColor: '#3b82f6' },
  sideColumn: { flexGrow: 1, flexBasis: 300, margin: 6 },
  detailCard: { backgroundColor: '#fff', borderRadius: 12, borderTopWidth: 4, borderTopColor: '#173b70', padding: 18, minHeight: 390, ...shadow },
  detailTitle: { color: '#1f2937', fontFamily: FONTS.extraBold, fontSize: 20 },
  detailSub: { color: '#6b7280', fontFamily: FONTS.bold, fontSize: 9, letterSpacing: 1.2, marginTop: 4, marginBottom: 12, textTransform: 'uppercase' },
  emptyDetails: { flex: 1, minHeight: 270, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  emptyIcon: { color: '#e5e7eb', fontSize: 65, marginBottom: 12 },
  emptyText: { color: '#9ca3af', fontFamily: FONTS.body, fontSize: 12, textAlign: 'center', fontStyle: 'italic', lineHeight: 18 },
  detailsList: { gap: 10 },
  detailItem: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12 },
  holidayDetail: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  taskDetail: { backgroundColor: '#fff', borderLeftWidth: 4, borderLeftColor: '#2563eb' },
  detailBadge: { color: '#b91c1c', fontFamily: FONTS.bold, fontSize: 10, marginBottom: 6 },
  itemTitle: { color: '#1f2937', fontFamily: FONTS.bold, fontSize: 12, flex: 1 },
  itemMeta: { color: '#6b7280', fontFamily: FONTS.body, fontSize: 10, marginTop: 5, lineHeight: 15 },
  bold: { fontFamily: FONTS.bold },
  sundayTitle: { color: '#6b7280', fontFamily: FONTS.bold, fontSize: 12 },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  taskTime: { color: '#1e40af', backgroundColor: '#dbeafe', fontFamily: FONTS.bold, fontSize: 8, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5 },
  regularDay: { alignItems: 'center', paddingVertical: 40, opacity: 0.45 },
  regularIcon: { color: '#9ca3af', fontSize: 32 },
  regularText: { color: '#9ca3af', fontFamily: FONTS.bold, fontSize: 10, letterSpacing: 1.2, marginTop: 6 },
  cutoffCard: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 12, padding: 15, marginTop: 14 },
  cutoffTitle: { color: '#173b70', fontFamily: FONTS.bold, fontSize: 10, letterSpacing: 1, marginBottom: 8 },
  cutoffValue: { color: '#1e40af', backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbeafe', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3, fontFamily: FONTS.bold, fontSize: 10 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, marginTop: 6, marginBottom: 18 },
  infoCard: { flexGrow: 1, flexBasis: 260, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 9, padding: 16, margin: 6, ...shadow },
  infoTitle: { color: '#1f2937', fontFamily: FONTS.bold, fontSize: 14, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 9, marginBottom: 7 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 6 },
  infoLabel: { color: '#6b7280', fontFamily: FONTS.body, fontSize: 11, flex: 1 },
  infoValue: { color: '#374151', fontFamily: FONTS.semiBold, fontSize: 11, textAlign: 'right' },
  dangerText: { color: '#dc2626', fontFamily: FONTS.bold },
  holidayTableCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 9, overflow: 'hidden', ...shadow },
  tableHeader: { backgroundColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', padding: 16, flexDirection: 'row', justifyContent: 'space-between' },
  tableTitle: { color: '#1f2937', fontFamily: FONTS.bold, fontSize: 16 },
  tableSubtitle: { color: '#6b7280', fontFamily: FONTS.body, fontSize: 10, marginTop: 4 },
  tableIcon: { color: '#d1d5db', fontSize: 25 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  loadingText: { color: '#6b7280', fontFamily: FONTS.body, fontSize: 11 },
  tableHeadRow: { flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 11, paddingHorizontal: 14 },
  tableHead: { color: '#6b7280', fontFamily: FONTS.bold, fontSize: 9, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingVertical: 12, paddingHorizontal: 14 },
  tableCell: { color: '#4b5563', fontFamily: FONTS.body, fontSize: 12 },
  cellBold: { color: '#374151', fontFamily: FONTS.bold },
  dateColumn: { width: '28%' },
  nameColumn: { width: '42%' },
  statusColumn: { width: '30%', alignItems: 'center' },
  statusHeadColumn: { width: '30%', textAlign: 'center' },
  statusBadge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 4, fontFamily: FONTS.bold, fontSize: 8, textTransform: 'uppercase', overflow: 'hidden' },
  closedBadge: { color: '#b91c1c', backgroundColor: '#fee2e2' },
  partialBadge: { color: '#c2410c', backgroundColor: '#ffedd5' },
  noRows: { color: '#9ca3af', fontFamily: FONTS.body, textAlign: 'center', fontSize: 11, padding: 22 },
  notice: { backgroundColor: '#173b70', borderRadius: 8, padding: 16, marginTop: 18, alignItems: 'center' },
  noticeText: { color: '#fff', opacity: 0.85, fontFamily: FONTS.semiBold, fontSize: 11, textAlign: 'center', lineHeight: 17 },
});
