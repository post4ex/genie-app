// components/Dropdown.js — Centralized futuristic dropdown / select field.
// A tappable field (label + current value + cool gradient chevron) that opens a
// glass option menu with the active option highlighted in a cool indigo→violet
// gradient, optional quick search for long lists, and a Close control.
//
//   <Dropdown label="SHIPMENT STATUS" value="intransit" options={STATUS_OPTIONS} onChange={setStatus} searchable />
//
// options: array of strings (value = label) OR
//          { value, label, sublabel? } — sublabel renders a muted second line
//          (e.g. branch/carrier code under its full name).
// Fully static — no Animated (crash-free pattern).

import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientGlyph } from './icons';

const normalizeOptions = (options) => (options || []).map(o =>
  typeof o === 'string' ? { value: o, label: o } : o
);

const CHEVRON = ['#047857', '#065f46'];   // deep emerald accent
const ACTIVE = ['#047857', '#065f46'];    // deep emerald (active option)
const GRAY = ['#94a3b8', '#94a3b8'];      // neutral chevron colour

export default function Dropdown({
  label,
  value,
  options = [],
  onChange,
  placeholder = 'Select',
  searchable = false,
  disabled = false,
  style,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const opts = useMemo(() => normalizeOptions(options), [options]);
  const current = opts.find(o => o.value === value);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return opts;
    return opts.filter(o =>
      [o.label, o.sublabel, o.value].filter(Boolean).map(String).some(s => s.toLowerCase().includes(needle))
    );
  }, [opts, q]);

  const openMenu = () => { setQ(''); setOpen(true); };

  return (
    <>
      <View style={[styles.fieldWrap, style]}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <Pressable
          onPress={disabled ? undefined : openMenu}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={label ? `${label}: ${current?.label || placeholder}` : (current?.label || placeholder)}
          accessibilityState={{ disabled }}
          style={({ pressed }) => [styles.field, disabled && styles.fieldDisabled, pressed && styles.pressed]}
        >
          <Text style={[styles.valueText, !current && styles.placeholderText]} numberOfLines={1}>
            {current ? current.label : placeholder}
          </Text>
          {/* Neutral chevron — no colour chip */}
          <GradientGlyph name="chevron-down" size={16} colors={GRAY} />
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.menu}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>{label || 'Select'}</Text>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={8}
                style={({ pressed }) => [styles.menuClose, pressed && styles.pressed]}
                accessibilityLabel="Close dropdown"
              >
                <GradientGlyph name="close" size={15} colors={['#475569', '#64748b']} />
              </Pressable>
            </View>

            {searchable && opts.length > 8 ? (
              <View style={styles.searchWrap}>
                <GradientGlyph name="magnify" size={16} colors={CHEVRON} />
                <TextInput
                  style={styles.searchInput}
                  value={q}
                  onChangeText={setQ}
                  placeholder="Search options…"
                  placeholderTextColor="#94a3b8"
                  autoFocus
                />
              </View>
            ) : null}

            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {filtered.map(opt => {
                const active = opt.value === value;
                return (
                  <Pressable
                    key={String(opt.value)}
                    onPress={() => { if (onChange) onChange(opt.value); setOpen(false); }}
                    style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                  >
                    {active ? (
                      <LinearGradient colors={ACTIVE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.optionActiveFill}>
                        <Text style={styles.optionLabelActive} numberOfLines={1}>{opt.label}</Text>
                        {opt.sublabel ? <Text style={styles.optionSubActive} numberOfLines={1}>{opt.sublabel}</Text> : null}
                      </LinearGradient>
                    ) : (
                      <>
                        <Text style={styles.optionLabel} numberOfLines={1}>{opt.label}</Text>
                        {opt.sublabel ? <Text style={styles.optionSub} numberOfLines={1}>{opt.sublabel}</Text> : null}
                      </>
                    )}
                  </Pressable>
                );
              })}
              {filtered.length === 0 ? <Text style={styles.emptyText}>No options match “{q}”</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fieldWrap: {},
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 5,
  },
  fieldDisabled: {
    opacity: 0.55,
    backgroundColor: '#f8fafc',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 46,
    backgroundColor: '#ffffff',
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#34d399',   // emerald field border — the dropdown's identity colour
    paddingLeft: 13,
    paddingRight: 8,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 1px 3px rgba(15, 23, 42, 0.04), 0px 4px 14px rgba(15, 23, 42, 0.05)' }
      : {
          shadowColor: '#0f172a',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
        }),
  },
  valueText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  placeholderText: {
    color: '#94a3b8',
    fontWeight: '600',
  },

  pressed: { opacity: 0.7 },

  // ── Menu ──
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  menu: {
    width: '100%',
    maxWidth: 380,
    maxHeight: 440,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 10px 40px rgba(15, 23, 42, 0.18)' }
      : {
          shadowColor: '#0f172a',
          shadowOpacity: 0.2,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
          elevation: 12,
        }),
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: 0.3,
  },
  menuClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 12,
    marginBottom: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 11,
    paddingHorizontal: 10,
    minHeight: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0f172a',
    paddingVertical: 6,
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  option: {
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginTop: 4,
  },
  optionActiveFill: {
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  optionLabelActive: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  optionSub: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 2,
  },
  optionSubActive: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 18,
  },
});
