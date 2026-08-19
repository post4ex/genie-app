import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

/**
 * StyledTable: Reusable unified table component matching the app's crisp
 * post4ex styling (single-row or multi-row with micro-labels and dividers).
 *
 * Usage:
 *   <StyledTable>
 *     <StyledTable.Row>
 *       <StyledTable.Cell label="ACTUAL WT" value="12.50 kg" />
 *       <StyledTable.Cell label="CHG WT" value="15.00 kg" highlight last />
 *     </StyledTable.Row>
 *   </StyledTable>
 */
export default function StyledTable({ children, style }) {
  return <View style={[styles.tableWrap, style]}>{children}</View>;
}

function TableRow({ children, style, last = false }) {
  return (
    <View style={[styles.row, last && styles.rowLast, style]}>
      {children}
    </View>
  );
}

function TableCell({
  label,
  value,
  children,
  flex = 1,
  highlight = false,
  highlightBg = '#f0fdf4',
  highlightColor = '#047857',
  style,
  labelStyle,
  valueStyle,
  last = false,
}) {
  return (
    <View
      style={[
        styles.cell,
        { flex },
        last && styles.cellLast,
        highlight && { backgroundColor: highlightBg },
        style,
      ]}
    >
      {label ? (
        <Text
          style={[
            styles.cellLabel,
            highlight && { color: highlightColor },
            labelStyle,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      ) : null}
      {value != null ? (
        <Text
          style={[
            styles.cellValue,
            highlight && { color: highlightColor },
            valueStyle,
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function TableFooterBanner({ children, label, value, icon, style }) {
  return (
    <View style={[styles.footerBanner, style]}>
      {children ? (
        children
      ) : (
        <>
          <View style={styles.footerLabelRow}>
            {icon ? <View style={{ marginRight: 6 }}>{icon}</View> : null}
            <Text style={styles.footerLabel}>{label}</Text>
          </View>
          <Text style={styles.footerValue}>{value}</Text>
        </>
      )}
    </View>
  );
}

StyledTable.Row = TableRow;
StyledTable.Cell = TableCell;
StyledTable.Footer = TableFooterBanner;

const styles = StyleSheet.create({
  tableWrap: {
    backgroundColor: '#ffffff',
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    overflow: 'hidden',
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  cell: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    justifyContent: 'center',
  },
  cellLast: {
    borderRightWidth: 0,
  },
  cellLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cellValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
  },
  footerBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1.5,
    borderTopColor: '#bbf7d0',
  },
  footerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLabel: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#15803d',
    letterSpacing: 0.6,
  },
  footerValue: {
    fontSize: 16.5,
    fontWeight: '900',
    color: '#15803d',
  },
});
