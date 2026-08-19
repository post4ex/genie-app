// components/DatePickerModal.js — Centralized futuristic Date Picker Modal.
// Features:
// - Left-grouped navigation arrows (‹ / ›)
// - Centered uppercase gradient Month & Year heading
// - Top-right circular cross close button
// - Integrated SegmentedToggle quick-date picker (Yesterday / Today / Tomorrow)
// - High-contrast days grid with glowing selected state & today indicator dot
// - Ambient violet card glow and top gradient accent line

import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GradientText from './GradientText';
import SegmentedToggle from './SegmentedToggle';
import Icon from './icons';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DEFAULT_GRAD = ['#9C2007', '#f59e0b'];

const formatYmd = (d) => {
  if (!d) return '';
  const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return '';
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function DatePickerModal({
  visible = false,
  value,
  onChange,
  onClose,
  colors = DEFAULT_GRAD,
}) {
  const currentDateStr = useMemo(() => {
    if (!value) return formatYmd(new Date());
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return formatYmd(value);
  }, [value]);

  const [calYear, setCalYear] = useState(() => {
    const p = (currentDateStr || '').split('-');
    return p.length === 3 ? Number(p[0]) : new Date().getFullYear();
  });

  const [calMonth, setCalMonth] = useState(() => {
    const p = (currentDateStr || '').split('-');
    return p.length === 3 ? Number(p[1]) - 1 : new Date().getMonth();
  });

  // Keep view aligned with the active value whenever modal opens
  useEffect(() => {
    if (visible && currentDateStr) {
      const p = currentDateStr.split('-');
      if (p.length === 3) {
        setCalYear(Number(p[0]));
        setCalMonth(Number(p[1]) - 1);
      }
    }
  }, [visible, currentDateStr]);

  // Calendar days grid calculator
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
    const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDayIndex; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(d);
    return days;
  }, [calYear, calMonth]);

  const activeQuickKey = useMemo(() => {
    if (!currentDateStr) return null;
    const now = new Date();
    const todayStr = formatYmd(now);
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const yestStr = formatYmd(yest);
    const tom = new Date(); tom.setDate(tom.getDate() + 1);
    const tomStr = formatYmd(tom);

    if (currentDateStr === todayStr) return '0';
    if (currentDateStr === yestStr) return '-1';
    if (currentDateStr === tomStr) return '1';
    return null;
  }, [currentDateStr]);

  const handleSelectDay = (dayNum) => {
    if (!dayNum) return;
    const mStr = String(calMonth + 1).padStart(2, '0');
    const dStr = String(dayNum).padStart(2, '0');
    const selectedDate = `${calYear}-${mStr}-${dStr}`;
    onChange && onChange(selectedDate);
    onClose && onClose();
  };

  const handleQuickDate = (offsetDays) => {
    const target = new Date();
    target.setDate(target.getDate() + offsetDays);
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, '0');
    const d = String(target.getDate()).padStart(2, '0');
    const selectedDate = `${y}-${m}-${d}`;
    setCalYear(y);
    setCalMonth(target.getMonth());
    onChange && onChange(selectedDate);
    onClose && onClose();
  };

  const isDaySelected = (dayNum) => {
    if (!dayNum || !currentDateStr) return false;
    const p = currentDateStr.split('-');
    if (p.length === 3) {
      return Number(p[0]) === calYear && Number(p[1]) === (calMonth + 1) && Number(p[2]) === dayNum;
    }
    return false;
  };

  const isDayToday = (dayNum) => {
    if (!dayNum) return false;
    const t = new Date();
    return t.getFullYear() === calYear && t.getMonth() === calMonth && t.getDate() === dayNum;
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.calendarModalContent}>
          {/* Top glowing accent bar */}
          <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.calendarTopBar} />

          {/* Calendar Header: Left arrows + Center Title + Top-Right Close Button */}
          <View style={styles.calendarHeader}>
            <View style={styles.calNavGroup}>
              <TouchableOpacity
                onPress={() => {
                  if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                  else { setCalMonth(m => m - 1); }
                }}
                style={styles.calNavBtn}
                activeOpacity={0.7}
                accessibilityLabel="Previous month"
              >
                <Icon name="back" size={11} color="#0f172a" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                  else { setCalMonth(m => m + 1); }
                }}
                style={styles.calNavBtn}
                activeOpacity={0.7}
                accessibilityLabel="Next month"
              >
                <Icon name="forward" size={11} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarTitleWrap}>
              <GradientText colors={colors} style={styles.calendarMonthTitle}>
                {MONTH_NAMES[calMonth].toUpperCase()} {calYear}
              </GradientText>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityLabel="Close date picker"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Access Segmented Toggle */}
          <View style={styles.calQuickWrap}>
            <SegmentedToggle
              options={[
                { key: '-1', label: 'Yesterday' },
                { key: '0', label: 'Today' },
                { key: '1', label: 'Tomorrow' },
              ]}
              value={activeQuickKey}
              onChange={(val) => handleQuickDate(Number(val))}
              colors={colors}
              size="sm"
              flex
            />
          </View>

          {/* Days of Week Header */}
          <View style={styles.calWeekRow}>
            {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map((d, di) => (
              <Text key={di} style={[styles.calWeekDayText, (di === 0 || di === 6) && styles.calWeekDayWeekend]}>
                {d}
              </Text>
            ))}
          </View>

          {/* Calendar Days Grid */}
          <View style={styles.calGrid}>
            {calendarDays.map((dayNum, idx) => {
              if (!dayNum) {
                return <View key={idx} style={styles.calDayBox} />;
              }
              const isSelected = isDaySelected(dayNum);
              const isToday = isDayToday(dayNum);

              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.calDayBox,
                    isToday && !isSelected && styles.calDayBoxToday,
                  ]}
                  activeOpacity={0.6}
                  onPress={() => handleSelectDay(dayNum)}
                >
                  {isSelected ? (
                    <LinearGradient
                      colors={colors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.calDaySelectedFill}
                    >
                      <Text style={styles.calDayTextSelected}>{dayNum}</Text>
                    </LinearGradient>
                  ) : (
                    <>
                      <Text style={[styles.calDayText, isToday && styles.calDayTextToday]}>
                        {dayNum}
                      </Text>
                      {isToday ? <View style={styles.calTodayDot} /> : null}
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.60)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  calendarModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 18,
    width: '90%',
    maxWidth: 350,
    borderWidth: 1.5,
    borderColor: '#8b5cf6',
    position: 'relative',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 0 1px rgba(167,139,250,0.28), 0 0 14px rgba(139,92,246,0.32), 0 12px 40px rgba(15,23,42,0.24)' }
      : { shadowColor: '#8b5cf6', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 }),
  },
  calendarTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  calNavGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calendarTitleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthTitle: {
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: 1,
  },
  calNavBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  calQuickWrap: {
    marginBottom: 12,
  },
  calWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 6,
  },
  calWeekDayText: {
    width: 38,
    textAlign: 'center',
    fontSize: 10.5,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  calWeekDayWeekend: {
    color: '#f59e0b',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  calDayBox: {
    width: '14.28%',
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
    borderRadius: 10,
    position: 'relative',
  },
  calDayBoxToday: {
    borderWidth: 1,
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  calTodayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#f59e0b',
    position: 'absolute',
    bottom: 3,
  },
  calDaySelectedFill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 3px 8px rgba(156,32,7,0.38)' }
      : { shadowColor: '#9C2007', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 }),
  },
  calDayText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  calDayTextToday: {
    color: '#b45309',
    fontWeight: '800',
  },
  calDayTextSelected: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
  },
});
