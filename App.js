import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TouchableOpacity, Alert, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Montserrat_900Black,
  Montserrat_800ExtraBold,
  Montserrat_700Bold,
  Montserrat_600SemiBold,
} from '@expo-google-fonts/montserrat';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import {
  Comfortaa_400Regular,
  Comfortaa_500Medium,
  Comfortaa_600SemiBold,
  Comfortaa_700Bold,
} from '@expo-google-fonts/comfortaa';

import { API_BASE, ROLE_LEVELS, SHEET_KEYS } from './core/config';
import { COLORS } from './styles/theme';
import {
  saveSession, getSession, removeSession, clearLocalReplica,
  getLocalCacheOwner, setLocalCacheOwner, getAccountKey,
  getSheet, putSheet, putSheetNewer, deleteFromSheet, getAppData, getLastSyncTime,
  getLastEventStamp, setLastEventStamp, initializeStorage
} from './core/storage';
import { fullSync, pullDeltaSince, fetchAllBusinessLayers } from './core/sync';
import { SSEListener } from './core/sse';
import { auditAndReconcile } from './core/reconcile';

import Header from './components/Header';
import Footer from './components/Footer';
import BottomMenuSheet from './components/BottomMenuSheet';

import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import OrdersScreen from './screens/OrdersScreen';
import BookOrderScreen from './screens/BookOrderScreen';
import TrackingScreen from './screens/TrackingScreen';
import NotificationsPanel from './components/NotificationsPanel';

function MainApp() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'orders' | 'book' | 'track'

  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [trackRef, setTrackRef] = useState('');
  const [trackResult, setTrackResult] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  const [bookForm, setBookForm] = useState({
    code: '', branch: 'DDN', carrier: 'JetLine', consignor: '',
    consignee: '', originCity: 'DEHRADUN', originPincode: '248001',
    destCity: '', destPincode: '', weight: '0.5', pieces: '1', value: '1000', cod: '0', topay: 'No',
  });
  const [bookingLoading, setBookingLoading] = useState(false);
  // Edit flow: Orders detail → Edit button → book tab pre-filled (web editOrderRef parity)
  const [editOrder, setEditOrder] = useState(null);
  const sseRef = useRef(null);
  const tokenRef = useRef('');
  const refreshTokenRef = useRef('');
  const sessionExpiresAtRef = useRef(0);
  const refreshPromiseRef = useRef(null);
  const syncInProgressRef = useRef(false);
  const deltaChainRef = useRef(Promise.resolve()); // serialize delta writes
  const lastEventTimeRef = useRef(0);   // web window._lastEventTime parity
  const reloadTimerRef = useRef(null);  // web _scheduleRefresh debounce timer

  useEffect(() => { tokenRef.current = token; }, [token]);

  // Rotate the short-lived access JWT without storing the user's password.
  // One promise serializes simultaneous heartbeat/SSE/API refresh attempts.
  const refreshSessionSilently = async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    const refreshToken = refreshTokenRef.current;
    if (!refreshToken || !tokenRef.current) return false;

    refreshPromiseRef.current = (async () => {
      try {
        if (sessionExpiresAtRef.current && Date.now() >= sessionExpiresAtRef.current) {
          return false;
        }
        const res = await fetch(`${API_BASE}/api/refreshSession`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.status !== 'success' || !json.sessionId || !json.refreshToken) {
          // A 401/403 is a definitive session rejection; other failures are
          // transient and should be retried on the next heartbeat.
          return res.status === 401 || res.status === 403 ? false : null;
        }

        const nextToken = json.sessionId;
        const nextRefreshToken = json.refreshToken;
        const nextExpires = Date.now() + Number(json.expiresIn || 8 * 60 * 60) * 1000;
        const nextAbsolute = Number(json.sessionExpiresAt || sessionExpiresAtRef.current || 0);
        const saved = await getSession();
        const nextUser = json.userData || saved?.user || user;
        const persisted = await saveSession(
          nextUser,
          nextToken,
          nextExpires,
          nextRefreshToken,
          nextAbsolute,
        );
        // Do not commit a rotated token to memory if durable storage failed:
        // the server has consumed the old refresh token and a restart would
        // otherwise be unable to recover this session safely.
        if (!persisted) return false;
        refreshTokenRef.current = nextRefreshToken;
        sessionExpiresAtRef.current = nextAbsolute;
        tokenRef.current = nextToken;
        setUser(nextUser);
        setToken(nextToken);

        // The old SSE Authorization header cannot be updated in place.
        // Reconnect immediately with the rotated access token; the listener's
        // onReconnect callback performs event-delta catch-up.
        if (sseRef.current) {
          sseRef.current.stop();
          startSSEOnly(nextToken);
        }
        return true;
      } catch (_) {
        // null means retryable transport/server failure; false means the
        // server definitively rejected the refresh or persistence failed.
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();
    return refreshPromiseRef.current;
  };

  // ── Notifications + sync-status UI state ─────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | streaming | live | reconnecting

  // ── 1. Startup: Restore Saved Session & Hydrate Local Data ───────────────
  useEffect(() => {
    (async () => {
      await initializeStorage();
      let saved = await getSession();
      if (saved && saved.user && saved.token) {
        // Restore refresh metadata before deciding whether the access JWT needs
        // rotation. A valid absolute session may outlive its 8-hour access token.
        tokenRef.current = saved.token;
        refreshTokenRef.current = saved.refreshToken || '';
        sessionExpiresAtRef.current = Number(saved.sessionExpiresAt || 0);
        if (sessionExpiresAtRef.current && Date.now() >= sessionExpiresAtRef.current) {
          await removeSession();
          return;
        }
        if (saved.expires && saved.expires <= Date.now()) {
          const refreshed = await refreshSessionSilently();
          if (refreshed !== true) {
            if (refreshed === false) await removeSession();
            return;
          }
          saved = await getSession();
          if (!saved?.user || !saved?.token) {
            await removeSession();
            return;
          }
        }
        const savedId = getAccountKey(saved.user);
        const owner = await getLocalCacheOwner();
        // A persisted session must still pass the same account-isolation check
        // as a fresh login before any cached row is rendered.
        if (!savedId) return;
        if (owner && owner !== savedId) {
          // A known owner mismatch is a different account: clear before any
          // cached row is rendered. A missing owner is a legacy/upgrade case;
          // preserve the durable replica for the already persisted session and
          // establish ownership instead of discarding the user's cache.
          const cleared = await clearLocalReplica();
          if (!cleared) return;
        }
        if (!(await setLocalCacheOwner(savedId))) return;
        setUser(saved.user);
        setToken(saved.token);
        tokenRef.current = saved.token;
        refreshTokenRef.current = saved.refreshToken || refreshTokenRef.current || '';
        sessionExpiresAtRef.current = Number(saved.sessionExpiresAt || sessionExpiresAtRef.current || 0);
        await reloadLocalState();
        startSyncAndSSE(saved.token);
        loadNotifications(true);
      }
    })();
    return () => {
      if (sseRef.current) sseRef.current.stop();
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, []);

  // Session heartbeat: refresh the access token shortly before its 8-hour
  // expiry, while still enforcing the server's 30-day absolute boundary.
  useEffect(() => {
    const tick = setInterval(async () => {
      if (!tokenRef.current) return;
      try {
        const saved = await getSession();
        const absolute = Number(sessionExpiresAtRef.current || saved?.sessionExpiresAt || 0);
        if (absolute && absolute <= Date.now()) {
          await handleLogout();
          return;
        }
        if (saved?.expires && saved.expires <= Date.now()) {
          const refreshed = await refreshSessionSilently();
          if (refreshed === false) await handleLogout();
          return;
        }
        if (saved?.expires && (saved.expires - Date.now()) <= 5 * 60 * 1000) {
          const refreshed = await refreshSessionSilently();
          if (refreshed === false) await handleLogout();
        }
      } catch (_) {}
    }, 60 * 1000);

    // Mobile Foreground Resume: catch events missed while app was backgrounded
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active' && tokenRef.current) {
        if (sseRef.current && !sseRef.current.connected) {
          sseRef.current.connect();
        }
        runDeltaCatchup(tokenRef.current);
        auditAndReconcile(tokenRef.current).then((res) => {
          if (res?.mismatches?.length) reloadLocalState();
        }).catch(() => {});
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Periodic 5-minute audit timer while app is actively open
    const auditInterval = setInterval(() => {
      if (tokenRef.current) {
        auditAndReconcile(tokenRef.current).then((res) => {
          if (res?.mismatches?.length) reloadLocalState();
        }).catch(() => {});
      }
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(tick);
      subscription.remove();
      clearInterval(auditInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [shipmentsMap, setShipmentsMap] = useState({});
  const [b2b2cMap, setB2b2cMap] = useState({});
  const [carriersMap, setCarriersMap] = useState({});
  const [modesMap, setModesMap] = useState({});
  const [productsMap, setProductsMap] = useState({});
  const [multiboxMap, setMultiboxMap] = useState({});
  const [uploadsMap, setUploadsMap] = useState({});
  const [ratesMap, setRatesMap] = useState({});
  const [branchesMap, setBranchesMap] = useState({});
  const [b2bList, setB2bList] = useState([]);

  const reloadLocalState = async () => {
    // All maps are hydrated from the storage adapter; native reads SQLite and
    // web reads the canonicalized fallback with the same object shape.
    const rawOrders = await getSheet('ORDERS');
    const rawShipments = await getSheet('SHIPMENTS');
    const rawB2b = await getSheet('B2B');
    const rawB2b2c = await getSheet('B2B2C');
    const rawCarriers = await getSheet('CARRIERS');
    const rawModes = await getSheet('MODES');
    const rawProducts = await getSheet('PRODUCTS');
    const rawMultibox = await getSheet('MULTIBOX');
    const rawUploads = await getSheet('UPLOADS');
    const rawRates = await getSheet('RATES');
    const rawBranches = await getSheet('BRANCHES');

    const b2bClientsList = Array.isArray(rawB2b) ? rawB2b : Object.values(rawB2b || {});
    setB2bList(b2bClientsList);

    const rawOrdersList = Array.isArray(rawOrders)
      ? rawOrders
      : Object.values(rawOrders || {});

    // Collapse duplicates by REFERENCE, keeping the freshest TIME_STAMP. The web's
    // bulkMerge re-keys every record by keyPath so duplicates can never exist there;
    // this mirrors that guarantee for any legacy/wrong-key rows in local storage.
    const seenRefs = new Set();
    const ordersList = [];
    [...rawOrdersList]
      .sort((a, b) => (Number(b?.TIME_STAMP || 0) - Number(a?.TIME_STAMP || 0)))
      .forEach(o => {
        const ref = o?.REFERENCE;
        if (ref != null) {
          if (seenRefs.has(ref)) return;
          seenRefs.add(ref);
        }
        ordersList.push(o);
      });

    // Build lookup maps by key (UID, CODE, REFERENCE)
    const b2b2cLookup = {};
    (Array.isArray(rawB2b2c) ? rawB2b2c : Object.values(rawB2b2c || {})).forEach(item => {
      const k = item.UID || item.CODE || item.NAME;
      if (k) b2b2cLookup[k] = item;
    });

    const carriersLookup = {};
    (Array.isArray(rawCarriers) ? rawCarriers : Object.values(rawCarriers || {})).forEach(item => {
      const k = item.COMPANY_CODE || item.CODE;
      // Preserve the complete carrier record. BookOrder needs COMPANY_CODE,
      // while other screens can still derive the display name from COMPANY_NAME.
      if (k) carriersLookup[k] = item;
    });

    const modesLookup = {};
    (Array.isArray(rawModes) ? rawModes : Object.values(rawModes || {})).forEach(item => {
      const k = item.SHORT || item.CODE;
      // Preserve VOL_INGR, MIN_WT, and zone availability flags for the
      // BookOrder mode picker; reducing this to a label breaks web parity.
      if (k) modesLookup[k] = item;
    });

    const ratesLookup = {};
    (Array.isArray(rawRates) ? rawRates : Object.values(rawRates || {})).forEach(item => {
      // RATES is keyed by UID in the web IndexedDB and in FastAPI's RateEntry.
      // UID is authoritative; RATE_UID is only a legacy/display field and must
      // never make the same row addressable under a different rate key.
      const k = item?.UID || item?.RATE_UID;
      if (k != null && String(k).trim() !== '') {
        ratesLookup[String(k).trim()] = item;
      }
    });

    const branchesLookup = {};
    (Array.isArray(rawBranches) ? rawBranches : Object.values(rawBranches || {})).forEach(item => {
      const k = item.BRANCH_CODE || item.CODE;
      if (k) branchesLookup[k] = item;
    });

    const productsLookup = {};
    (Array.isArray(rawProducts) ? rawProducts : Object.values(rawProducts || {})).forEach(item => {
      const ref = item.REFERENCE;
      if (ref) {
        if (!productsLookup[ref]) productsLookup[ref] = [];
        productsLookup[ref].push(item);
      }
    });

    const multiboxLookup = {};
    (Array.isArray(rawMultibox) ? rawMultibox : Object.values(rawMultibox || {})).forEach(item => {
      const ref = item.REFERENCE;
      if (ref) {
        if (!multiboxLookup[ref]) multiboxLookup[ref] = [];
        multiboxLookup[ref].push(item);
      }
    });

    const uploadsLookup = {};
    (Array.isArray(rawUploads) ? rawUploads : Object.values(rawUploads || {})).forEach(item => {
      const ref = item.REFERENCE || item.AWB_NUMBER;
      if (ref) {
        if (!uploadsLookup[ref]) uploadsLookup[ref] = [];
        uploadsLookup[ref].push(item);
      }
    });

    setOrders(ordersList);
    // SHIPMENTS is keyed by REFERENCE in both SQLite and the web adapter. Keep
    // a defensive re-key for rows created by an older build or server payload.
    const shipmentsLookup = {};
    Object.values(rawShipments || {}).forEach((shipment) => {
      const ref = shipment?.REFERENCE || shipment?.reference || shipment?.ORDER_REFERENCE;
      if (ref) shipmentsLookup[String(ref)] = shipment;
    });
    setShipmentsMap(shipmentsLookup);
    setB2b2cMap(b2b2cLookup);
    setCarriersMap(carriersLookup);
    setModesMap(modesLookup);
    setRatesMap(ratesLookup);
    setBranchesMap(branchesLookup);
    setProductsMap(productsLookup);
    setMultiboxMap(multiboxLookup);
    setUploadsMap(uploadsLookup);
  };

  // Web _scheduleRefresh parity: coalesce UI refreshes so a burst of deltas
  // (e.g. booking → ORDERS + MULTIBOX + PRODUCTS + UPLOADS) triggers ONE reload
  // instead of N full reloads (each reads all 11 sheets). immediate=true forces
  // a synchronous reload for explicit events (resync).
  const scheduleReload = (immediate = false) => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    if (immediate) {
      reloadTimerRef.current = null;
      return reloadLocalState();
    }
    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null;
      reloadLocalState();
    }, 300);
    return Promise.resolve();
  };

  // ── Real-time SSE handling (web layout.js _handleSSEMessage + app-api.js _applyDelta parity) ──
  // The server broadcasts deltas with the FULL record data — apply it directly,
  // exactly like the web's _applyDelta, instead of re-fetching events.
  const applyDeltaToStorage = async (delta) => {
    const { collection, action, key, data, id, PB_ID, pb_id, ts } = delta || {};
    if (!collection) return;
    try {
      if (action === 'upsert' || action === 'create' || action === 'update') {
        // Web bulkMerge parity: re-key by the sheet's keyPath (e.g. REFERENCE for
        // ORDERS), ignoring the server's object key — a record can never land under
        // two keys (duplicate rows). Same rule pullDeltaSince/streamSync use.
        const keyPath = SHEET_KEYS[collection] || 'id';
        const recKey = data?.[keyPath] || data?.id || data?.PB_ID || key;
        // putSheetNewer = web bulkMerge _checkAndPut: never clobber a fresher record
        if (recKey && data) await putSheetNewer(collection, { [recKey]: data });
      } else if (action === 'delete') {
        const current = await getSheet(collection);
        const dels = [];
        if (key) dels.push(key);
        for (const identity of [id, PB_ID, pb_id, data?.id, data?.PB_ID, data?.pb_id]) {
          if (!identity || identity === key || dels.includes(identity)) continue;
          const hit = Object.keys(current).find(k => [current[k]?.id, current[k]?.PB_ID]
            .filter((value) => value != null)
            .some((value) => String(value) === String(identity)));
          if (hit && !dels.includes(hit)) dels.push(hit);
          // Pass the identity through as well. SQLite matches record_id/pb_id
          // directly, and the web fallback resolves it from the record fields.
          if (!dels.includes(identity)) dels.push(identity);
        }
        if (dels.length) await deleteFromSheet(collection, dels);
        // Cascaded deletes for ORDERS — remove child records (web app-api.js parity)
        if (collection === 'ORDERS' && dels.length) {
          for (const childCol of ['MULTIBOX', 'PRODUCTS', 'UPLOADS']) {
            const child = await getSheet(childCol);
            const childDeletes = Object.entries(child)
              .filter(([, v]) => dels.some(d => String(v?.REFERENCE ?? '') === String(d)))
              .map(([k]) => k);
            if (childDeletes.length) await deleteFromSheet(childCol, childDeletes);
          }
        }
      }
      // Advance the resume point so catch-ups don't replay this event
      // SSE payloads generated by older backend workers may not include ts;
      // only advance the event cursor when the server supplied an event stamp.
      if (ts) await setLastEventStamp(ts);
    } catch (e) {
      console.warn('[SSE] delta apply failed:', e.message);
    }
  };

  // Catch-up pull — resume from the last event stamp, not wall-clock time
  // (web uses lastEventStamp; Date.now() can skip or outrun server stamps).
  // Skipped while a full sync is mid-flight (web pullDeltaSince _syncInProgress guard).
  const runDeltaCatchup = async (authToken) => {
    if (syncInProgressRef.current) return;
    try {
      const since = (await getLastEventStamp()) || (await getLastSyncTime());
      if (since) await pullDeltaSince(authToken, since);
    } catch (_) {}
  };

  const handleSSEEvent = async (authToken, payload) => {
    const type = payload?.type;
    lastEventTimeRef.current = Date.now(); // web window._lastEventTime parity
    if (type === 'heartbeat' || type === 'system_status') return; // keep-alive — no data work
    if (type === 'logout') { handleLogout(); return; }
    if (type === 'resync') {
      // Web parity: ignore resync while a full sync is mid-flight
      if (syncInProgressRef.current) return;
      setSyncStatus('streaming');
      syncInProgressRef.current = true;
      try {
        await fullSync(authToken);
      } finally {
        syncInProgressRef.current = false;
      }
      await reloadLocalState();
      setSyncStatus('live');
      return;
    }
    if (type === 'delta') {
      // Apply immediately — NEVER buffer behind a running sync. Every write here
      // and in streamSync/fullSync is TIME_STAMP-guarded via putSheetNewer, so a
      // live delta can't be clobbered by the sync (or vice versa). Buffering behind
      // syncInProgressRef previously swallowed bookings made mid-sync: the
      // notification still arrived (ungated) but the ORDERS delta sat in the
      // buffer until the (possibly long) stream finished — order list never updated.
      deltaChainRef.current = deltaChainRef.current
        .then(() => applyDeltaToStorage(payload))
        .then(() => scheduleReload()) // coalesced — web _scheduleRefresh 300ms parity
        .catch(() => {});
      return;
    }
    if (type === 'notification') {
      // Web layout.js parity: store into NOTIFICATIONS sheet
      const notif = payload?.data;
      const nid = notif?.NOTIF_ID || payload?.key;
      if (notif && nid) await putSheet('NOTIFICATIONS', { [nid]: { ...notif, IS_READ: false } });
      await loadNotifications(false);
      return;
    }
    if (type === 'notif_count') {
      // Web parity: badge alone isn't enough — pull fresh notifications + re-render
      loadNotifications(true);
      return;
    }
    // unknown → light catch-up
    runDeltaCatchup(authToken);
  };

  // ── Notifications (web app-notify.js parity) ─────────────────────────────
  const loadNotifications = async (fromServer = false) => {
    try {
      if (fromServer && tokenRef.current) {
        const res = await fetch(`${API_BASE}/api/fetchNotifications`, {
          headers: { 'Authorization': `Bearer ${tokenRef.current}` }
        });
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          await putSheetNewer('NOTIFICATIONS', json.data);
        }
      }
      const raw = await getSheet('NOTIFICATIONS');
      const list = Object.values(raw || {})
        .sort((a, b) => (Number(b.TIMESTAMP) || 0) - (Number(a.TIMESTAMP) || 0));
      setNotifications(list);
      setUnreadCount(list.filter(n => !n.IS_READ).length);
    } catch (e) {
      console.warn('[Notif] loadNotifications:', e.message);
    }
  };

  const _postNotif = (endpoint, ids) => {
    if (!tokenRef.current || !ids.length) return;
    fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenRef.current}` },
      body: JSON.stringify({ notif_ids: ids })
    }).catch(() => {});
  };

  const markNotifRead = async (id) => {
    const raw = await getSheet('NOTIFICATIONS');
    const rec = raw[id];
    if (!rec) return;
    await putSheet('NOTIFICATIONS', { [id]: { ...rec, IS_READ: true } });
    _postNotif('/api/notifread', [id]);
    await loadNotifications(false);
  };

  const markAllNotifsRead = async () => {
    const raw = await getSheet('NOTIFICATIONS');
    const ids = Object.keys(raw || {}).filter(k => !raw[k]?.IS_READ);
    if (!ids.length) return;
    for (const id of ids) await putSheet('NOTIFICATIONS', { [id]: { ...raw[id], IS_READ: true } });
    _postNotif('/api/notifread', ids);
    await loadNotifications(false);
  };

  const clearNotif = async (id) => {
    await deleteFromSheet('NOTIFICATIONS', id);
    _postNotif('/api/notifclear', [id]);
    await loadNotifications(false);
  };

  const clearAllNotifs = async () => {
    const raw = await getSheet('NOTIFICATIONS');
    const ids = Object.keys(raw || {}).filter(k => raw[k]?.LEVEL !== 'CRITICAL');
    if (ids.length) {
      await deleteFromSheet('NOTIFICATIONS', ids);
      _postNotif('/api/notifclear', ids);
    }
    await loadNotifications(false);
  };

  const startSSEOnly = (authToken) => {
    if (!authToken) return;
    if (sseRef.current) sseRef.current.stop();
    sseRef.current = new SSEListener(
      authToken,
      (eventPayload) => { handleSSEEvent(authToken, eventPayload); },
      (err) => {
        if (err === 'UNAUTHORIZED') {
          // A near-expiry stream can fail while the heartbeat is rotating.
          // Try the serialized refresh once before logging the user out.
          refreshSessionSilently().then((ok) => { if (ok === false) handleLogout(); });
        } else setSyncStatus('reconnecting');
      },
      () => { setSyncStatus('live'); runDeltaCatchup(authToken); },
      () => { setSyncStatus('live'); runDeltaCatchup(authToken); }
    );
    sseRef.current.start();
  };

  const startSyncAndSSE = async (authToken) => {
    // A. Perform Fast Initial Sync (~1 sec)
    setSyncStatus('streaming');
    syncInProgressRef.current = true;
    let syncOk = false;
    try {
      syncOk = (await fullSync(authToken)) !== null;
    } finally {
      syncInProgressRef.current = false;
    }
    await reloadLocalState();
    setSyncStatus(syncOk ? 'live' : 'reconnecting');

    // Web parity (layout.js after sync_complete): catch events that occurred
    // during the stream before opening the live connection.
    runDeltaCatchup(authToken);

    // B. Start Non-Blocking Parallel Background Layer Sync
    setSyncStatus('streaming');
    fetchAllBusinessLayers(authToken, () => {
      setSyncStatus('live');
      reloadLocalState();
    });
    // Server counts are scoped to the authenticated user. Repair only after the
    // initial stream so a reconnect cannot briefly replace fresh local deltas.
    auditAndReconcile(authToken).then((result) => {
      if (result?.mismatches?.length) reloadLocalState();
    }).catch(() => {});

    // C. Start Real-time SSE Stream Listener (web openSSE parity)
    startSSEOnly(authToken);
  };

  // Online recovery + 5-min safety net (web layout.js visibilitychange / 5min-tick parity)
  useEffect(() => {
    // Web parity: skip the catch-up pull while SSE is live and recent (< 60s)
    const isSseRecent = () => sseRef.current?.connected &&
      lastEventTimeRef.current &&
      (Date.now() - lastEventTimeRef.current) < 60000;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !tokenRef.current) return;
      if (!isSseRecent()) runDeltaCatchup(tokenRef.current);
      // Web parity (openSSE on visibilitychange): if the listener never connected
      // or went silent > 45s, restart it rather than waiting for its backoff loop.
      const stale = !lastEventTimeRef.current || (Date.now() - lastEventTimeRef.current) > 45000;
      if (stale && sseRef.current && !sseRef.current.connected && !sseRef.current.active) {
        sseRef.current.stop();
        sseRef.current.start();
      }
    });
    const tick = setInterval(async () => {
      if (!tokenRef.current || AppState.currentState !== 'active') return;

      // The backend's inactivity clock is based on authenticated requests. An
      // open foreground app is active even when its SSE stream has no business
      // events, so keep that server-side activity marker alive without storing
      // credentials or changing the 30-day absolute session boundary.
      try {
        const ping = await fetch(`${API_BASE}/api/ping`, {
          headers: { 'Authorization': `Bearer ${tokenRef.current}` },
          cache: 'no-store',
        });
        if (ping.status === 401) {
          const refreshed = await refreshSessionSilently();
          if (refreshed === false) await handleLogout();
          return;
        }
      } catch (_) {}

      if (!isSseRecent()) runDeltaCatchup(tokenRef.current);
    }, 5 * 60 * 1000);
    return () => { sub.remove(); clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoginSuccess = async (userObj, jwtToken, refreshToken = '', sessionExpiresAt = 0) => {
    // User-switch guard (web login.js): wipe local data when a DIFFERENT user
    // logs in, so nobody sees another account's cached sheets.
    const saved = await getSession();
    const prevId = getAccountKey(saved?.user);
    const newId = getAccountKey(userObj);
    if (!newId) {
      Alert.alert('Login error', 'The server did not return a stable account identity.');
      return;
    }
    const cachedOwner = await getLocalCacheOwner();
    const hasLocalReplica = !cachedOwner && !saved?.token;
    if ((cachedOwner && cachedOwner !== String(newId)) ||
        (hasLocalReplica && newId) ||
        (saved && saved.token && prevId && prevId !== newId)) {
      // A local replica is account-scoped. Preserve it across logout/login for
      // the same user, but never expose one user's cached records to another.
      const cleared = await clearLocalReplica();
      if (!cleared) {
        Alert.alert('Local data error', 'Could not safely reset data for this account. Please try again.');
        return;
      }
    }
    if (!(await setLocalCacheOwner(newId))) {
      Alert.alert('Local data error', 'Could not secure local cache ownership. Please try again.');
      return;
    }
    // Access token is valid for 8 hours; the refresh token is bounded by the
    // server-provided absolute session expiry. Persist credentials before
    // committing in-memory auth state so a storage failure cannot create a
    // UI-only login that disappears on restart.
    const persisted = await saveSession(
      userObj,
      jwtToken,
      Date.now() + 8 * 60 * 60 * 1000,
      refreshToken,
      Number(sessionExpiresAt || 0),
    );
    if (!persisted) {
      Alert.alert('Login error', 'Could not save the session securely. Please try again.');
      return;
    }
    setUser(userObj);
    setToken(jwtToken);
    tokenRef.current = jwtToken;
    refreshTokenRef.current = refreshToken;
    sessionExpiresAtRef.current = Number(sessionExpiresAt || 0);
    // Render the durable replica immediately, then let the live sync reconcile
    // it in the background. This is the fast relogin/offline behavior.
    await reloadLocalState();
    startSyncAndSSE(jwtToken);
  };

  const handleLogout = async () => {
    if (sseRef.current) sseRef.current.stop();
    // Drop any pending coalesced reload — a debounced reload firing after logout
    // would flash empty state (web has no equivalent post-logout refresh).
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = null;
    }
    // Web parity: notify server the session is done (best effort)
    if (tokenRef.current) {
      fetch(`${API_BASE}/api/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenRef.current}` }
      }).catch(() => {});
    }
    setUser(null);
    setToken('');
    tokenRef.current = '';
    refreshTokenRef.current = '';
    sessionExpiresAtRef.current = 0;
    setOrders([]);
    setTrackResult(null);
    setNotifications([]);
    setUnreadCount(0);
    setNotifModalVisible(false);
    setSyncStatus('idle');
    await removeSession();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setSyncStatus('streaming');
    syncInProgressRef.current = true;
    try {
      await fullSync(token);
    } finally {
      syncInProgressRef.current = false;
    }
    await reloadLocalState();
    setRefreshing(false);
    setSyncStatus('live');
    loadNotifications(true); // web refresh parity — re-pull the notification list
  };

  const handleTrack = async () => {
    const raw = trackRef.trim();
    if (!raw || raw.length < 4) {
      Alert.alert("Invalid Input", "Please enter at least 4 characters.");
      return;
    }
    const query = raw.replace(/[^a-zA-Z0-9\-\/]/g, '');
    const isRef = /^\d{14}$/.test(query);
    const param = isRef ? `ref=${encodeURIComponent(query)}` : `awb=${encodeURIComponent(query)}`;

    setTrackingLoading(true);
    setTrackResult(null);

    try {
      // 1. Try movements endpoint: GET /api/movements?ref=... or awb=...
      let res = await fetch(`${API_BASE}/api/movements?${param}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // 2. Try live tracking endpoint if movements returns 404
      if (!res.ok && res.status === 404) {
        res = await fetch(`${API_BASE}/api/track/live?${param}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }

      if (res.ok) {
        const json = await res.json();
        if (json && (json.shipment || json.data || json.movements || json.status === 'success')) {
          setTrackResult(json);
          setTrackingLoading(false);
          return;
        }
      }

      // 3. Fallback: Search local offline storage (AsyncStorage sheets)
      const qUpper = query.toUpperCase();
      const localOrder = orders.find(o => 
        (o.REFERENCE || '').toUpperCase() === qUpper ||
        (o.AWB_NUMBER || '').toUpperCase() === qUpper ||
        (o.id || '').toUpperCase() === qUpper
      );

      const localShipment = shipmentsMap[localOrder?.REFERENCE || query] || {};

      if (localOrder || localShipment.reference) {
        const synthesizedResult = {
          shipment: {
            reference: localOrder?.REFERENCE || localShipment.reference || query,
            awb: localOrder?.AWB_NUMBER || localShipment.awb || 'Pending',
            origin: localOrder?.ORIGIN_CITY || 'DEHRADUN',
            destination: localOrder?.DEST_CITY || 'DEST',
            booked_date: localOrder?.ORDER_DATE || 'Recent',
            weight: localOrder?.WEIGHT || 0.5,
            pieces: localOrder?.PIECS || 1,
            state: localShipment.state || localOrder?.STATE || 'BOOKED',
            carrier_name: localOrder?.CARRIER || 'JetLine',
          },
          movements: [
            {
              activity: `Order ${localOrder?.STATE || 'Booked'} successfully`,
              location: localOrder?.ORIGIN_CITY || 'DEHRADUN',
              date: localOrder?.ORDER_DATE || 'Recent',
              time: ''
            }
          ]
        };
        setTrackResult(synthesizedResult);
      } else {
        Alert.alert("Shipment Not Found", `No shipment found for "${query}".`);
      }
    } catch (e) {
      Alert.alert("Network Error", "Could not fetch tracking: " + e.message);
    } finally {
      setTrackingLoading(false);
    }
  };

  // Web parity (core/book-order.js): payload is built entirely by BookOrderScreen;
  // App only POSTs/PUTs it, then waits for the SSE/delta sync to land the order
  // in local storage before declaring success (web waitForRefInOrders).
  const waitForRefInOrders = async (ref, timeoutMs = 15000) => {
    if (!ref) return false;
    const start = Date.now();
    let poll = 0;
    while (Date.now() - start < timeoutMs) {
      try {
        const rawOrders = await getSheet('ORDERS');
        const list = Array.isArray(rawOrders) ? rawOrders : Object.values(rawOrders || {});
        if (list.some(o => String(o.REFERENCE) === String(ref))) {
          // The delta may already be in SQLite while React state is still stale.
          // Reload immediately so Orders/Dashboard reflect the confirmed booking.
          await reloadLocalState();
          return true;
        }
      } catch (_) {}

      // Web parity: catch up from the event cursor while waiting. Await the pull
      // (rather than fire-and-forget) so the next check sees the merged record.
      // putSheetNewer makes this safe alongside an active SSE/full sync.
      poll += 1;
      if (poll % 2 === 1 && tokenRef.current) {
        const since = (await getLastEventStamp()) || (await getLastSyncTime());
        if (since) {
          // pullDeltaSince has its own retry backoff. Do not let those retries
          // extend the booking confirmation wait beyond its deadline; continue
          // the bounded poll and let the normal SSE/safety-net retry in parallel.
          const remaining = Math.max(1, timeoutMs - (Date.now() - start));
          const controller = new AbortController();
          const abortTimer = setTimeout(() => controller.abort(), remaining);
          try {
            // retryCount=5 means one bounded request here; the regular
            // foreground/background catch-up path retains its normal retries.
            await pullDeltaSince(tokenRef.current, since, 5, controller.signal).catch(() => {});
          } finally {
            clearTimeout(abortTimer);
          }
          if (Date.now() - start < timeoutMs) await reloadLocalState().catch(() => {});
        }
      }
      await new Promise(r => setTimeout(r, 500));
    }
    // Keep the visible list current even when confirmation timed out; the
    // caller will show the web-style pending state instead of false success.
    await reloadLocalState().catch(() => {});
    return false;
  };

  const handleEditOrder = (order) => {
    setEditOrder(order);
    setActiveTab('book');
  };

  const handleBookOrder = async (payload) => {
    const order = payload.order || payload;
    const isEdit = !!order.REFERENCE;
    setBookingLoading(true);
    try {
      const res = await fetch(`${API_BASE}${isEdit ? '/api/editOrder' : '/api/bookOrder'}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        let detail = '';
        try {
          const errJson = await res.json();
          detail = errJson.message || errJson.detail || '';
        } catch (_) {}
        return { ok: false, message: detail || `Request failed (${res.status})` };
      }
      let json = null;
      try {
        json = await res.json();
      } catch (_) {
        return { ok: false, message: 'Invalid server response (not JSON)' };
      }
      if (json.status === 'error') {
        return { ok: false, message: json.message || json.detail || 'Booking failed' };
      }
      const reference = json.reference || json.data?.REFERENCE || json.order?.REFERENCE || order.REFERENCE || order.AWB_NUMBER || null;
      // Match the web: HTTP success starts a short local-replica confirmation
      // wait. This prevents a false "booked" state when the POST succeeded but
      // SSE/delta has not yet delivered the ORDERS row to this device.
      const confirmed = reference
        ? await waitForRefInOrders(reference, 15000)
        : false;
      return { ok: true, reference, confirmed };
    } catch (e) {
      return { ok: false, message: e.message || 'Booking API request failed' };
    } finally {
      setBookingLoading(false);
    }
  };

  const handleContactCreated = (record) => {
    // Keep the B2B2C lookup map in sync after Add Contact (web book-order-add-contact.js)
    setB2b2cMap(prev => {
      const next = { ...prev };
      const k = record?.UID || record?.CODE || record?.NAME;
      if (k) next[k] = record;
      return next;
    });
  };

  if (!user) {
    return (
      <View style={styles.webBody}>
        <StatusBar style="dark" />
        <Header user={user} onLogin={() => {}} />
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
        <Footer />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Header
        user={user}
        onSearch={() => setActiveTab('track')}
        onRefresh={onRefresh}
        onNotif={() => setNotifModalVisible(true)}
        onLogout={handleLogout}
        unreadCount={unreadCount}
        syncStatus={syncStatus}
        refreshing={refreshing}
      />

      <NotificationsPanel
        visible={notifModalVisible}
        onClose={() => setNotifModalVisible(false)}
        notifications={notifications}
        onMarkRead={markNotifRead}
        onMarkAllRead={markAllNotifsRead}
        onDismiss={clearNotif}
        onClearAll={clearAllNotifs}
        canDismissCritical={(ROLE_LEVELS[user?.ROLE] || 0) >= (ROLE_LEVELS.ADMIN || 90)}
      />

      <View style={styles.mainContent}>
        {activeTab === 'dashboard' && (
          <DashboardScreen orders={orders} shipmentsMap={shipmentsMap} refreshing={refreshing} onRefresh={onRefresh} onNavigate={setActiveTab} />
        )}
        {activeTab === 'orders' && (
          <OrdersScreen
            orders={orders}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            refreshing={refreshing}
            onRefresh={onRefresh}
            b2b2cMap={b2b2cMap}
            carriersMap={carriersMap}
            modesMap={modesMap}
            branchesMap={branchesMap}
            productsMap={productsMap}
            multiboxMap={multiboxMap}
            uploadsMap={uploadsMap}
            shipmentsMap={shipmentsMap}
            token={token}
            apiBase={API_BASE}
            onEditOrder={handleEditOrder}
          />
        )}
        {activeTab === 'book' && (
          <BookOrderScreen
            bookForm={bookForm}
            setBookForm={setBookForm}
            onBookOrder={handleBookOrder}
            bookingLoading={bookingLoading}
            b2b2cMap={b2b2cMap}
            b2bList={b2bList}
            carriersMap={carriersMap}
            modesMap={modesMap}
            ratesMap={ratesMap}
            branchesMap={branchesMap}
            token={token}
            apiBase={API_BASE}
            onContactCreated={handleContactCreated}
            editOrder={editOrder}
            onEditDone={() => setEditOrder(null)}
          />
        )}
        {activeTab === 'track' && (
          <TrackingScreen token={token} apiBase={API_BASE} orders={orders} shipmentsMap={shipmentsMap} />
        )}
      </View>

      {/* Bottom Navigation Bar */}
      <BottomMenuSheet activeTab={activeTab} onNavigate={setActiveTab} />
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Montserrat_900Black,
    Montserrat_800ExtraBold,
    Montserrat_700Bold,
    Montserrat_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Comfortaa_400Regular,
    Comfortaa_500Medium,
    Comfortaa_600SemiBold,
    Comfortaa_700Bold,
  });

  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  webBody: { flex: 1, backgroundColor: '#f8fafc' },
  mainContent: { flex: 1 },
  tabBar: { flexDirection: 'row', backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingVertical: 6 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  tabActive: { borderTopWidth: 2, borderTopColor: COLORS.primary },
  tabIcon: { fontSize: 18 },
  tabLabel: { color: '#64748b', fontSize: 10, marginTop: 2 },
  tabLabelActive: { color: COLORS.primary, fontWeight: '700' },
});
