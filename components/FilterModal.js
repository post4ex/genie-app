// components/FilterModal.js — Centralized futuristic filter modal.
// Generic model so any list can reuse it:
//
//   <FilterModal
//     visible={open}
//     title="Filter Shipments"
//     resultCount={filtered.length}
//     dateRange={{ start, end, onStart: setStart, onEnd: setEnd }}
//     sections={[
//       { title: 'SHIPMENT STATUS', options: [{ value: 'ALL', label: 'All Statuses' }, ...], selected, onSelect },
//       ...
//     ]}
//     onApply={close}
//     onReset={reset}
//     onClose={close}
//   />
//
// Renders a bottom sheet with a DATE RANGE section (presets + calendar
// picker) and one dropdown per section (options may be strings or
// { value, label, sublabel? }). Cool indigo→violet accent palette — no warm
// colours. Fully static — no Animated.

import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from './icons';
import GradientText from './GradientText';
import Button from './Button';
import Dropdown from './Dropdown';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Keep the original UTC-based date formatting so filter comparisons don't shift.
const yyyyMmDd = (d) => d.toISOString().split('T')[0];

export default function FilterModal({
  visible = false,
  title = 'Filter',
  resultCount,
  dateRange,
  sections = [],
  onApply,
  onReset,
  onClose,
}) {
  const start = dateRange?.start || '';
  const end = dateRange?.end || '';
  const onStart = dateRange?.onStart;
  const onEnd = dateRange?.onEnd;

  // Internal calendar state
  const [calTarget, setCalTarget] = useState(null); // 'start' | 'end' | null
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
    const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDayIndex; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(d);
    return days;
  }, [calYear, calMonth]);

  const applyDatePreset = (type) => {
    if (!onStart || !onEnd) return;
    const today = new Date();
    if (type === 'today') {
      onStart(yyyyMmDd(today));
      onEnd(yyyyMmDd(today));
    } else if (type === '7days') {
      const past = new Date(today);
      past.setDate(today.getDate() - 7);
      onStart(yyyyMmDd(past));
      onEnd(yyyyMmDd(today));
    } else if (type === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      onStart(yyyyMmDd(firstDay));
      onEnd(yyyyMmDd(today));
    } else if (type === 'clear') {
      onStart('');
      onEnd('');
    }
  };

  const handleSelectCalendarDay = (dayNum) => {
    if (!dayNum) return;
    const mStr = String(calMonth + 1).padStart(2, '0');
    const dStr = String(dayNum).padStart(2, '0');
    const formatted = `${calYear}-${mStr}-${dStr}`;
    if (calTarget === 'start' && onStart) onStart(formatted);
    else if (calTarget === 'end' && onEnd) onEnd(formatted);
    setCalTarget(null);
  };

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <GradientText colors={['#047857', '#065f46']} style={styles.headerTitle}>{title}</GradientText>
              <Button
                variant="mint"
                size="sm"
                iconOnly
                icon="close"
                onPress={onClose}
                accessibilityLabel={`Close ${title}`}
              />
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              {/* ── Date Range ── */}
              <Text style={styles.sectionTitle}>DATE RANGE</Text>
              <View style={styles.chipRow}>
                {[{ key: 'today', label: 'Today' }, { key: '7days', label: '7 Days' }, { key: 'month', label: 'This Month' }].map(p => (
                  <Pressable key={p.key} style={({ pressed }) => [styles.chip, pressed && styles.pressed]} onPress={() => applyDatePreset(p.key)}>
                    <Text style={styles.chipText}>{p.label}</Text>
                  </Pressable>
                ))}
                <Pressable style={({ pressed }) => [styles.chip, styles.chipClear, pressed && styles.pressed]} onPress={() => applyDatePreset('clear')}>
                  <Text style={[styles.chipText, styles.chipClearText]}>Clear Date</Text>
                </Pressable>
              </View>

              <View style={styles.dateInputsRow}>
                {[
                  { label: 'From Date:', value: start, target: 'start' },
                  { label: 'To Date:', value: end, target: 'end' },
                ].map((f) => (
                  <View key={f.target} style={styles.dateField}>
                    <Text style={styles.dateInputLabel}>{f.label}</Text>
                    <Pressable style={({ pressed }) => [styles.calendarTriggerBtn, pressed && styles.pressed]} onPress={() => { setCalTarget(f.target); }}>
                      <Icon name="calendar" size={14} color="#047857" />
                      <Text style={styles.calendarTriggerText}>{f.value || 'Select Date'}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>

              {/* ── Sections — consecutive `half` sections share a row ── */}
              {(() => {
                const rows = [];
                for (let i = 0; i < sections.length; i++) {
                  const sec = sections[i];
                  if (sec.half && sections[i + 1] && sections[i + 1].half) {
                    rows.push([sec, sections[i + 1]]);
                    i++;
                  } else {
                    rows.push([sec]);
                  }
                }
                return rows.map((row, ri) => (
                  <View key={ri} style={[styles.sectionGap, row.length === 2 && styles.sectionRow]}>
                    {row.map((sec, si) => (
                      <Dropdown
                        key={sec.title}
                        label={sec.title}
                        value={sec.selected}
                        options={sec.options}
                        onChange={sec.onSelect}
                        searchable={sec.options && sec.options.length > 8}
                        style={row.length === 2 ? [styles.sectionHalf, sec.flex ? { flex: sec.flex } : undefined] : undefined}
                      />
                    ))}
                  </View>
                ));
              })()}
            </ScrollView>

            <View style={styles.actions}>
              <Button variant="mint" size="md" label="Reset Filters" onPress={onReset} style={styles.actionReset} />
              <Button
                variant="primary"
                size="md"
                colors={['#047857', '#065f46']}
                label={resultCount != null ? `Apply (${resultCount})` : 'Apply'}
                onPress={onApply}
                style={styles.actionApply}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Calendar Picker ── */}
      <Modal visible={calTarget !== null} animationType="fade" transparent onRequestClose={() => setCalTarget(null)}>
        <View style={styles.overlay}>
          <View style={styles.calModal}>
            <View style={styles.calHeader}>
              <Pressable style={({ pressed }) => [styles.calNavBtn, pressed && styles.pressed]} onPress={prevMonth}>
                <Text style={styles.calNavBtnText}>‹</Text>
              </Pressable>
              <Text style={styles.calMonthTitle}>{MONTH_NAMES[calMonth]} {calYear}</Text>
              <Pressable style={({ pressed }) => [styles.calNavBtn, pressed && styles.pressed]} onPress={nextMonth}>
                <Text style={styles.calNavBtnText}>›</Text>
              </Pressable>
            </View>

            <View style={styles.calWeekRow}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, di) => (
                <Text key={di} style={styles.calWeekDayText}>{d}</Text>
              ))}
            </View>

            <View style={styles.calGrid}>
              {calendarDays.map((dayNum, idx) => (
                <Pressable
                  key={idx}
                  disabled={!dayNum}
                  style={({ pressed }) => [styles.calDayBox, dayNum && styles.calDayBoxActive, pressed && styles.pressed]}
                  onPress={() => handleSelectCalendarDay(dayNum)}
                >
                  <Text style={[styles.calDayText, !dayNum && styles.calDayTextEmpty]}>{dayNum || ''}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={({ pressed }) => [styles.calCancelBtn, pressed && styles.pressed]} onPress={() => setCalTarget(null)}>
              <Text style={styles.calCancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  sheet: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 640 : '100%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    maxHeight: '90%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },

  scroll: {
    flexShrink: 1, // absorb overflow inside the capped sheet — actions stay pinned
    maxHeight: 360,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  chipClear: {
    backgroundColor: '#d1fae5',
    borderColor: '#6ee7b7',
  },
  chipClearText: {
    color: '#065f46',
  },
  sectionGap: {
    marginTop: 6,
  },
  sectionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sectionHalf: {
    flex: 1,
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  dateField: {
    flex: 1,
  },
  dateInputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 4,
  },
  calendarTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  calendarTriggerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 34, // breathing room below the buttons
  },
  actionReset: {
    flex: 1,
  },
  actionApply: {
    flex: 1.4,
  },

  // Calendar
  calModal: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 20,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calNavBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
  },
  calMonthTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
  },
  calWeekRow: {
    flexDirection: 'row',
  },
  calWeekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    paddingVertical: 4,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calDayBox: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  calDayBoxActive: {
    // tappable days get a subtle hover/press surface via pressed style
  },
  calDayText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  calDayTextEmpty: {
    color: 'transparent',
  },
  calCancelBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  calCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
});
