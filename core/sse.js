import { Platform } from 'react-native';
import { API_BASE } from './config';

// Native EventSource (react-native-sse) — pure-JS XHR-based, so Metro bundles
// it safely for every platform; only constructed on native devices. If the
// module is ever missing we degrade to catch-up polling.
let NativeEventSource = null;
if (Platform.OS !== 'web') {
  try {
    const mod = require('react-native-sse');
    NativeEventSource = (mod && mod.default) || mod;
  } catch (_) {
    NativeEventSource = null;
  }
}

// Web parity (GENIE_WEB/core/sse-worker.js + layout.js _openSSEDirect):
// - exponential backoff 3s → 30s cap
// - watchdog aborts dead connections and reconnects
// - cache: 'no-store' so proxies never buffer the stream (web fetch path)
// - onReconnect → caller runs a pullDeltaSince catch-up (web _sseGapStart logic)
// - onFallback → React Native's fetch has NO streaming body, so we degrade
//   to periodic catch-up polling instead of throwing forever.
//
// Native path (react-native-sse): real SSE streaming via XMLHttpRequest.
// The server sends `: keep-alive` comments every 60s, which the lib discards
// (no message event), so the native watchdog must be longer than that cadence
// or a healthy-but-quiet connection would be falsely killed. On the web path
// every byte (including keep-alives) resets the watchdog — so 45s is safe there.
const DEFAULT_BACKOFF = 3000;
const MAX_BACKOFF = 30000;
const WATCHDOG_MS = 45000;         // web fetch path — bytes reset it, incl. keep-alives
const WATCHDOG_NATIVE_MS = 70000;  // native — keep-alives are invisible to the lib

export class SSEListener {
  constructor(token, onEvent, onError, onReconnect = null, onFallback = null) {
    this.token = token;
    this.onEvent = onEvent;
    this.onError = onError;
    this.onReconnect = onReconnect;
    this.onFallback = onFallback;
    this.active = false;
    this.connected = false;
    this.controller = null;
    this.es = null; // react-native-sse instance (native path)
    this.backoff = DEFAULT_BACKOFF;
    this.watchdog = null;
    this.reconnectTimer = null;
    this.pollTimer = null;
    this.isNative = Platform.OS !== 'web';
  }

  start() {
    if (this.active || !this.token) return;
    this.active = true;
    this.connect();
  }

  stop() {
    this.active = false;
    this.connected = false;
    if (this.es) {
      try { this.es.removeAllEventListeners(); } catch (_) {}
      try { this.es.close(); } catch (_) {}
      this.es = null;
    }
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
    clearTimeout(this.watchdog);
    this.watchdog = null;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  // Web parity — no data for the window means the connection is dead: drop and retry.
  _resetWatchdog() {
    clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => {
      if (!this.active) return;
      this.connected = false;
      if (this.es) {
        try { this.es.close(); } catch (_) {}
        this.es = null;
      }
      if (this.controller) this.controller.abort();
      this._scheduleReconnect();
    }, this.isNative ? WATCHDOG_NATIVE_MS : WATCHDOG_MS);
  }

  _scheduleReconnect() {
    if (!this.active) return;
    clearTimeout(this.watchdog);
    this.watchdog = null;
    clearTimeout(this.reconnectTimer);
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.active) this.connect();
    }, delay);
  }

  // Native fallback — periodic catch-up pulls (web 5-min safety-net equivalent).
  _fallbackPolling() {
    if (this.pollTimer) return;
    this.connected = true; // polling is the active transport — treat as connected
    if (this.onFallback) this.onFallback();
    this.pollTimer = setInterval(() => {
      if (this.active && this.onFallback) this.onFallback();
    }, 30000);
  }

  // Native path — react-native-sse streaming. We own reconnection entirely
  // (pollingInterval: 0 disables the lib's reconnect loop), matching the web
  // sse-worker which manages its own backoff + watchdog.
  _connectNative() {
    if (!NativeEventSource) { this._fallbackPolling(); return; }

    let es;
    try {
      es = new NativeEventSource(`${API_BASE}/api/events`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.token}` },
        pollingInterval: 0,           // we own reconnection (backoff + watchdog)
        timeout: 0,                   // long-lived connection — no fixed expiry
        timeoutBeforeConnection: 0,   // connect immediately
        debug: false,
      });
    } catch (e) {
      if (this.onError) this.onError(e.message);
      this._scheduleReconnect();
      return;
    }
    this.es = es;

    es.addEventListener('open', () => {
      // Connected — reset backoff, arm watchdog, signal catch-up.
      this.backoff = DEFAULT_BACKOFF;
      this.connected = true;
      this._resetWatchdog();
      if (this.onReconnect) this.onReconnect();
    });

    es.addEventListener('message', (event) => {
      this._resetWatchdog();
      try {
        const payload = JSON.parse(event?.data);
        if (this.onEvent) this.onEvent(payload);
      } catch (_) {}
    });

    es.addEventListener('error', (event) => {
      this.connected = false;
      // 401/403 → session dead — logout (web sse-worker broadcasts logout).
      const status = Number(event?.xhrStatus ?? event?.status ?? event?.statusCode);
      if (status === 401 || status === 403) {
        this.stop();
        if (this.onError) this.onError('UNAUTHORIZED');
        return;
      }
      if (this.onError) this.onError(event?.message || 'SSE error');
      this._scheduleReconnect();
    });

    es.addEventListener('close', () => {
      this.connected = false;
    });
  }

  async connect() {
    if (!this.active || !this.token) return;
    if (this.es) { try { this.es.close(); } catch (_) {} this.es = null; }
    if (this.controller) this.controller.abort();
    if (!this.isNative) this.controller = new AbortController(); // native path uses react-native-sse (no signal)

    if (this.isNative) {
      this._connectNative();
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/events`, {
        headers: { 'Authorization': `Bearer ${this.token}` },
        signal: this.controller.signal,
        cache: 'no-store',
      });

      if (res.status === 401) {
        if (this.onError) this.onError('UNAUTHORIZED');
        this.stop();
        return;
      }

      if (!res.ok) throw new Error(`SSE Stream failed (${res.status})`);

      // React Native fetch has no streaming body — degrade to polling.
      if (!res.body || typeof res.body.getReader !== 'function') {
        this._fallbackPolling();
        return;
      }

      // Connected — reset backoff, arm watchdog, signal catch-up.
      this.backoff = DEFAULT_BACKOFF;
      this.connected = true;
      this._resetWatchdog();
      if (this.onReconnect) this.onReconnect();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (this.active) {
        const { done, value } = await reader.read();
        if (done) break;
        this._resetWatchdog();
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          try {
            const payload = JSON.parse(line.slice(5).trim());
            if (this.onEvent) this.onEvent(payload);
          } catch (err) {}
        }
      }
    } catch (err) {
      // AbortError = stop() or watchdog — the watchdog schedules its own retry.
      if (err.name === 'AbortError') { this.connected = false; return; }
      if (this.onError) this.onError(err.message);
    }

    if (!this.active) return;
    this.connected = false;
    this._scheduleReconnect();
  }
}
