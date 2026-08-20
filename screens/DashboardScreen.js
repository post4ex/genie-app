import React from 'react';
import { StyleSheet, Text, View, ScrollView, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Path, Polyline, Rect, Text as SvgText, G, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { COLORS } from '../styles/theme';
import Tile from '../components/Tile';
import ListItem from '../components/ListItem';
import GradientText from '../components/GradientText';
import Tray from '../components/Tray';

// ── Gradient Chart Colors ───────────────────────────────────────────────────
const CHART_PALETTE = [
  ['#6366f1', '#8b5cf6'],   // indigo → violet
  ['#0ea5e9', '#2563eb'],   // sky → blue
  ['#10b981', '#0d9488'],   // emerald → teal
  ['#f59e0b', '#f97316'],   // amber → orange
  ['#f43f5e', '#ec4899'],   // rose → pink
  ['#14b8a6', '#22c55e'],   // teal → green
  ['#8b5cf6', '#6366f1'],   // violet → indigo
];

const BAR_TRACK_H = 64;

// Local calendar date (YYYY-MM-DD) — buckets by local day, not UTC (avoids the
// off-by-one that toISOString() introduces for timezones ahead of UTC).
const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Catmull-Rom → cubic bezier smoothing — the silky curve of premium area charts.
const smoothPath = (pts) => {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
};
// Curve + close down to the baseline → gradient area fill.
const areaPath = (pts, bottom) => {
  const line = smoothPath(pts);
  if (!line) return '';
  const first = pts[0];
  const last = pts[pts.length - 1];
  return `${line} L ${last.x} ${bottom} L ${first.x} ${bottom} Z`;
};

// Service Level window: matured week ending 7 days ago (today-13 … today-7),
// e.g. today 16 Aug → shows 3 Aug – 9 Aug.
const SLA_START_OFFSET = 13;
const SLA_END_OFFSET = 7;
const SLA_CHART_H = 140;
const SLA_CHART_PAD = { top: 14, right: 10, bottom: 22, left: 30 };
// Series config — order controls render + legend order.
const SLA_SERIES = [
  { key: 'booked', label: 'Ordered', stroke: '#2563eb', fill: '#0ea5e9', fillOpacity: 0.28 },
  { key: 'delivered', label: 'Delivered', stroke: '#059669', fill: '#10b981', fillOpacity: 0.28 },
  { key: 'inTransit', label: 'In Transit', stroke: '#f59e0b', fill: '#f59e0b', fillOpacity: 0.16 },
  { key: 'outForDelivery', label: 'Out for Delivery', stroke: '#8b5cf6', fill: '#8b5cf6', fillOpacity: 0.16 },
];

// Simple vertical gradient bar
function GrowingBar({ pct, colors, value, label }) {
  const targetH = Math.max(((Number(pct) || 0) / 100) * BAR_TRACK_H, 4);
  return (
    <View style={styles.barCol}>
      <Text style={styles.barValText}>{value}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { height: targetH }]}>
          <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        </View>
      </View>
      <Text style={styles.barLblText}>{label}</Text>
    </View>
  );
}

// ── Coordinate graph geometry ───────────────────────────────────────────────
const CHART_H = 150;
const CHART_PAD = { top: 16, right: 12, bottom: 24, left: 30 };

// Top Destinations as a coordinate graph: grid + axes labels, a gradient line, and destination dots.
function DestinationsChart({ data }) {
  const [width, setWidth] = React.useState(0);
  const [selected, setSelected] = React.useState(null);

  const { top: padT, right: padR, bottom: padB, left: padL } = CHART_PAD;
  const plotW = Math.max(width - padL - padR, 0);
  const plotH = CHART_H - padT - padB;
  const maxY = Math.max(...data.map(d => d.count), 1);
  const n = data.length;

  const points = data.map((d, i) => {
    const x = n > 1 ? padL + (i * plotW) / (n - 1) : padL + plotW / 2;
    const y = padT + plotH - (d.count / maxY) * plotH;
    return { ...d, x, y };
  });

  // y-axis tick values (fixed scale: 0 · 10 · 50 · 100)
  const ticks = [0, 10, 50, 100];

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={CHART_H}>
          <Defs>
            <SvgLinearGradient id="destLine" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#8b5cf6" />
              <Stop offset="1" stopColor="#f59e0b" />
            </SvgLinearGradient>
            {points.map((p, i) => (
              <SvgLinearGradient key={i} id={`dot${i}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={CHART_PALETTE[i % CHART_PALETTE.length][0]} />
                <Stop offset="1" stopColor={CHART_PALETTE[i % CHART_PALETTE.length][1]} />
              </SvgLinearGradient>
            ))}
          </Defs>

          {/* horizontal gridlines + y-axis labels */}
          {ticks.map((t, i) => {
            const y = padT + plotH - (t / 100) * plotH;
            return (
              <G key={`t${i}`}>
                <Line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke="#eef2f7" strokeWidth={1} />
                <SvgText x={padL - 7} y={y + 3} fontSize={8.5} fill="#94a3b8" textAnchor="end">{t}</SvgText>
              </G>
            );
          })}

          {/* vertical guide lines under each destination */}
          {points.map((p, i) => (
            <Line key={`v${i}`} x1={p.x} y1={padT} x2={p.x} y2={padT + plotH} stroke="#f1f5f9" strokeWidth={1} strokeDasharray="2 3" />
          ))}

          {/* continuous gradient connection line */}
          <Polyline
            points={points.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="url(#destLine)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* destination coordinate dots — tap to reveal the city name */}
          {points.map((p, i) => {
            const isSel = selected === i;
            const tw = isSel ? Math.min(Math.max(p.city.length * 5.5 + 16, 40), plotW) : 0;
            const tx = isSel ? Math.min(Math.max(p.x, padL + tw / 2), padL + plotW - tw / 2) : 0;
            const ty = isSel ? Math.max(p.y - 38, 6) : 0;
            return (
              <G key={i}>
                {isSel && (
                  <Circle cx={p.x} cy={p.y} r={9.5} fill="none" stroke={CHART_PALETTE[i % CHART_PALETTE.length][0]} strokeWidth={2} />
                )}
                <Circle cx={p.x} cy={p.y} r={10} fill={CHART_PALETTE[i % CHART_PALETTE.length][0]} opacity={0.22} />
                <Circle cx={p.x} cy={p.y} r={5.5} fill={`url(#dot${i})`} stroke="#ffffff" strokeWidth={2} />
                <SvgText x={p.x} y={Math.max(p.y - 12, 10)} fontSize={9} fontWeight="700" fill="#475569" textAnchor="middle">{p.count}</SvgText>
                {/* invisible, larger tap target */}
                <Circle cx={p.x} cy={p.y} r={18} fill="transparent" onPress={() => setSelected(isSel ? null : i)} />
                {isSel && (
                  <G>
                    <Rect x={tx - tw / 2} y={ty} width={tw} height={17} rx={8.5} fill="#1e293b" />
                    <SvgText x={tx} y={ty + 11.5} fontSize={9} fontWeight="700" fill="#ffffff" textAnchor="middle">{p.city}</SvgText>
                  </G>
                )}
              </G>
            );
          })}

          {/* x-axis pin labels (city name on tap) */}
          {points.map((p, i) => (
            <SvgText key={`c${i}`} x={p.x} y={CHART_H - 7} fontSize={9} fontWeight="700" fill={selected === i ? '#9C2007' : '#64748b'} textAnchor="middle">
              {p.pin || (p.city.length > 8 ? `${p.city.slice(0, 7)}…` : p.city)}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  );
}

// ── Service Level: smooth multi-area chart ──
// The Stripe/Linear-style area chart: silky bezier curves per series with
// soft gradient fills fading to transparent, and dots on every data point.
function ServiceLevelChart({ data }) {
  const [width, setWidth] = React.useState(0);
  const { top: padT, right: padR, bottom: padB, left: padL } = SLA_CHART_PAD;
  const plotW = Math.max(width - padL - padR, 0);
  const plotH = SLA_CHART_H - padT - padB;
  const maxY = Math.max(...data.map(d => Math.max(...SLA_SERIES.map(s => d[s.key]))), 1);
  const n = data.length;
  const bottom = padT + plotH;

  const seriesPts = SLA_SERIES.map(s => ({
    ...s,
    pts: data.map((d, i) => ({
      x: n > 1 ? padL + (i * plotW) / (n - 1) : padL + plotW / 2,
      y: padT + plotH - (d[s.key] / maxY) * plotH,
    })),
  }));

  const ticks = [...new Set([0, Math.round(maxY / 2), maxY])];

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={SLA_CHART_H}>
          <Defs>
            {SLA_SERIES.map((s, i) => (
              <SvgLinearGradient key={i} id={`slaArea${i}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={s.fill} stopOpacity={s.fillOpacity} />
                <Stop offset="1" stopColor={s.fill} stopOpacity="0" />
              </SvgLinearGradient>
            ))}
          </Defs>

          {/* horizontal gridlines + y-axis labels */}
          {ticks.map((t, i) => {
            const y = padT + plotH - (t / maxY) * plotH;
            return (
              <G key={`t${i}`}>
                <Line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke="#eef2f7" strokeWidth={1} />
                <SvgText x={padL - 7} y={y + 3} fontSize={8.5} fill="#94a3b8" textAnchor="end">{t}</SvgText>
              </G>
            );
          })}

          {/* soft gradient area fills */}
          {seriesPts.map((s, i) => (
            <Path key={`a${i}`} d={areaPath(s.pts, bottom)} fill={`url(#slaArea${i})`} />
          ))}

          {/* silky curves */}
          {seriesPts.map((s, i) => (
            <Path key={`l${i}`} d={smoothPath(s.pts)} fill="none" stroke={s.stroke} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          ))}

          {/* data dots */}
          {seriesPts.map((s, si) => s.pts.map((p, i) => (
            <Circle key={`${si}-${i}`} cx={p.x} cy={p.y} r={3.2} fill="#ffffff" stroke={s.stroke} strokeWidth={2} />
          )))}

          {/* x-axis date labels */}
          {data.map((d, i) => {
            const x = n > 1 ? padL + (i * plotW) / (n - 1) : padL + plotW / 2;
            return (
              <SvgText key={`c${i}`} x={x} y={SLA_CHART_H - 6} fontSize={8.5} fontWeight="600" fill="#64748b" textAnchor="middle">{d.dateLabel}</SvgText>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

export default function DashboardScreen({
  orders = [],
  shipmentsMap = {},
  b2b2cMap = {},
  modesMap = {},
  refreshing,
  onRefresh,
  onNavigate,
  onOpenOrdersTile,
  onOpenOrder,
}) {
  // 1. Overall Stats linked with SHIPMENTS sheet state
  const totalOrders = orders.length;

  const getShipmentState = (o) => {
    const ref = o.REFERENCE || o.id;
    const s = shipmentsMap[ref] || {};
    return (s.state || s.STATE || o.STATE || o.STATUS || o.DELIVERY_STATUS || '').toString().toLowerCase();
  };
  
  const inTransitCount = orders.filter(o => {
    const st = getShipmentState(o);
    return st === 'intransit' || st.includes('transit') || st.includes('dispatch') || st.includes('shipped') || st.includes('way') || st === 'outfordelivery' || st.includes('out for delivery');
  }).length;

  const deliveredCount = orders.filter(o => {
    const st = getShipmentState(o);
    return st === 'delivered' || st.includes('deliver') || st.includes('complete') || st.includes('success');
  }).length;

  // 2. Bookings Last 7 Days Analysis
  const today = new Date();
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short' });
    const isoDate = localISO(d);
    
    const count = orders.filter(o => {
      const ts = o.ORDER_DATE || o.TIME_STAMP || o.REQ_TIME;
      if (!ts) return false;
      try {
        const num = Number(ts);
        const validTs = Number.isFinite(num) ? (num < 1e11 ? num * 1000 : num) : ts;
        const orderDate = localISO(new Date(validTs));
        return orderDate === isoDate;
      } catch (e) {
        return false;
      }
    }).length;

    last7Days.push({ label: dayLabel, count });
  }
  const max7DaysCount = Math.max(...last7Days.map(d => d.count), 1);

  // 3. Top Destinations Analysis — grouped by destination pincode
  //    (Top 6 for compact mobile layout; x-axis shows the pin, tap shows the city)
  const pinMap = {};
  orders.forEach(o => {
    const pin = String(o.DEST_PINCODE || o.CONSIGNEE_PINCODE || '').trim();
    const city = String(o.DEST_CITY || 'DEHRADUN').trim().toUpperCase();
    const key = pin || city || '—';
    if (!pinMap[key]) pinMap[key] = { pin, city, count: 0 };
    pinMap[key].count += 1;
  });
  const topDestinations = Object.values(pinMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // 4. Service Level — matured week (today-13 … today-7): dates vs ordered vs
  //    delivered vs in-transit vs out-for-delivery. The window stays 7+ days
  //    old so bookings have matured (e.g. today 16 Aug → shows 3 Aug – 9 Aug).
  const serviceLevelDays = [];
  for (let i = SLA_START_OFFSET; i >= SLA_END_OFFSET; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const isoDate = localISO(d);
    let booked = 0;
    let delivered = 0;
    let inTransit = 0;
    let outForDelivery = 0;
    orders.forEach(o => {
      const ts = o.ORDER_DATE || o.TIME_STAMP || o.REQ_TIME;
      if (!ts) return;
      try {
        const num = Number(ts);
        const validTs = Number.isFinite(num) ? (num < 1e11 ? num * 1000 : num) : ts;
        if (localISO(new Date(validTs)) !== isoDate) return;
      } catch (e) {
        return;
      }
      booked += 1;
      const st = getShipmentState(o);
      if (st === 'delivered' || st.includes('deliver') || st.includes('complete') || st.includes('success')) delivered += 1;
      else if (st === 'outfordelivery' || st.includes('out for delivery')) outForDelivery += 1;
      else if (st === 'intransit' || st.includes('transit') || st.includes('dispatch') || st.includes('shipped') || st.includes('way')) inTransit += 1;
    });
    serviceLevelDays.push({
      dateLabel: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      booked,
      delivered,
      inTransit,
      outForDelivery,
    });
  }
  const totalBooked = serviceLevelDays.reduce((acc, d) => acc + d.booked, 0);
  const totalDelivered = serviceLevelDays.reduce((acc, d) => acc + d.delivered, 0);
  const avgServiceLevel = totalBooked > 0 ? Math.round((totalDelivered / totalBooked) * 100) : 0;
  const fmtOffsetDay = (offset) => {
    const dd = new Date(today);
    dd.setDate(dd.getDate() - offset);
    return dd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };
  const slWindowLabel = `${fmtOffsetDay(SLA_START_OFFSET)} – ${fmtOffsetDay(SLA_END_OFFSET)}`;

  return (
    <ScrollView style={styles.scrollPage} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}>
      {/* Branded title */}
      <View style={styles.titleWrap}>
        <GradientText colors={['#9C2007', '#f59e0b']} style={styles.pageTitle}>Dashboard</GradientText>
        <LinearGradient
          colors={['#9C2007', '#f59e0b']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.titleBar}
        />
      </View>

      {/* ── Summary Stats as Tiles ── */}
      <View style={styles.statsRow}>
        <Tile
          size="sm"
          label="Total Orders"
          value={totalOrders}
          accent={['#2563eb', '#06b6d4']}
          onPress={() => {
            if (onOpenOrdersTile) onOpenOrdersTile('all');
            else if (onNavigate) onNavigate('orders');
          }}
        />
        <Tile
          size="sm"
          label="In Transit"
          value={inTransitCount}
          accent={['#f59e0b', '#f97316']}
          onPress={() => {
            if (onOpenOrdersTile) onOpenOrdersTile('intransit');
            else if (onNavigate) onNavigate('orders');
          }}
        />
        <Tile
          size="sm"
          label="Delivered"
          value={deliveredCount}
          accent={['#10b981', '#22c55e']}
          onPress={() => {
            if (onOpenOrdersTile) onOpenOrdersTile('delivered');
            else if (onNavigate) onNavigate('orders');
          }}
        />
      </View>

      {/* ── Tray 1: Bookings — Last 7 Days ── */}
      <Tray title="Bookings — Last 7 Days">
        <View style={styles.barChartContainer}>
          {last7Days.map((d, idx) => {
            const heightPercent = Math.max((d.count / max7DaysCount) * 100, 8);
            return (
              <GrowingBar
                key={idx}
                pct={heightPercent}
                colors={CHART_PALETTE[idx % CHART_PALETTE.length]}
                value={d.count}
                label={d.label}
              />
            );
          })}
        </View>
      </Tray>

      {/* ── Tray 2: Service Level — dates vs ordered vs delivered ── */}
      <Tray
        title="Service Level"
        right={
          <View style={styles.trayStat}>
            <Text style={styles.trayStatValue}>Avg {avgServiceLevel}%</Text>
          </View>
        }
      >
        {serviceLevelDays.every(d => d.booked === 0) ? (
          <Text style={styles.emptyText}>No bookings {slWindowLabel}</Text>
        ) : (
          <>
            <View style={styles.slaLegend}>
              {SLA_SERIES.map((s, i) => (
                <View key={i} style={styles.slaLegendItem}>
                  <View style={[styles.slaLegendDot, { backgroundColor: s.stroke }]} />
                  <Text style={styles.slaLegendText}>{s.label}</Text>
                </View>
              ))}
            </View>
            <ServiceLevelChart data={serviceLevelDays} />
          </>
        )}
      </Tray>

      {/* ── Tray 3: Top Destinations Coordinate Graph ── */}
      {topDestinations.length > 0 && (
        <Tray title="Top Destinations">
          <DestinationsChart data={topDestinations} />
        </Tray>
      )}

      {/* ── Tray 4: Recent Orders (centralized ListItem) ── */}
      <Tray title="Recent Orders">
        {orders.length === 0 ? (
          <Text style={styles.emptyText}>No orders yet</Text>
        ) : orders.slice(0, 5).map((ord, idx) => {
          const stateStr = getShipmentState(ord).toUpperCase();
          const consignee = (b2b2cMap[ord.CONSIGNEE]?.NAME || ord.CONSIGNEE || 'Unknown');
          const modeRec = modesMap[ord.MODE];
          const modeName = (typeof modeRec === 'string' ? modeRec : (modeRec?.MODE || modeRec?.NAME)) || ord.MODE || '';
          const hasCod = ord.COD && parseFloat(ord.COD) > 0;
          const meta = [
            ord.CODE || '', // B2B customer code (the order's client code)
            ord.WEIGHT ? `${ord.WEIGHT}kg` : '',
            ord.PIECS ? `${ord.PIECS} pcs` : '',
            modeName,
            ord.TOPAY === 'Yes' ? 'ToPay' : '',
            hasCod ? `COD ₹${ord.COD}` : '',
          ].filter(Boolean).join(' | ');
          return (
            <ListItem
              key={idx}
              title={consignee}
              subtitle={[
                `AWB: ${ord.AWB_NUMBER || 'Pending'} | Carrier: ${ord.CARRIER || 'JetLine'} | Ref: ${ord.REFERENCE || '—'}`,
                meta,
                `📍 ${ord.ORIGIN_CITY || 'DDN'} → 🏁 ${ord.DEST_CITY || 'DEST'}`,
              ]}
              status={stateStr || 'BOOKED'}
              onPress={onOpenOrder
                ? () => onOpenOrder(ord)
                : (onNavigate ? () => onNavigate('orders') : undefined)}
            />
          );
        })}
      </Tray>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollPage: { flex: 1, padding: 16 },
  titleWrap: { alignItems: 'center', marginBottom: 18 },
  titleBar: { width: 46, height: 3, borderRadius: 2, marginTop: 8 },
  pageTitle: { fontSize: 26, fontWeight: '900', letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  
  trayStat: { backgroundColor: '#fdf0ec', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  trayStatValue: { color: '#9C2007', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  
  // Bar Chart Styles
  barChartContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 95, paddingTop: 6 },
  barCol: { alignItems: 'center', width: 34 },
  barValText: { color: '#64748b', fontSize: 10, fontWeight: '600', marginBottom: 3 },
  barTrack: { width: 14, height: BAR_TRACK_H, backgroundColor: '#f1f5f9', borderRadius: 7, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderTopLeftRadius: 7, borderTopRightRadius: 7, bottom: 0, position: 'absolute', overflow: 'hidden' },
  barLblText: { color: '#475569', fontSize: 10, fontWeight: '600', marginTop: 4 },

  // Service Level smooth area-chart styles
  slaLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, rowGap: 8, marginBottom: 10 },
  slaLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  slaLegendDot: { width: 8, height: 8, borderRadius: 4 },
  slaLegendText: { color: '#64748b', fontSize: 10, fontWeight: '600' },

  emptyText: { color: '#94a3b8', fontSize: 12, textAlign: 'center', paddingVertical: 24 },
});
