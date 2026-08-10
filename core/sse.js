import { API_BASE } from './config';

// Web parity (GENIE_WEB/core/sse-worker.js + layout.js _openSSEDirect):
// - exponential backoff 3s → 30s cap
// - 45s watchdog aborts dead connections and reconnects
// - cache: 'no-store' so proxies never buffer the stream
// - onReconnect → caller runs a pullDeltaSince catch-up (web _sseGapStart logic)
// - onFallback → React Native's fetch has NO streaming body, so we degrade
//   to periodic catch-up polling instead of throwing forever.
const DEFAULT_BACKOFF = 3000;
const MAX_BACKOFF = 30000;
const WATCHDOG_MS = 45000;

export class SSEListener {
  constructor(token, onEvent, onError, onReconnect = null, onFallback = null) {
    this.token = token;
    this.onEvent = onEvent;
    this.onError = onError;
    this.onReconnect = onReconnect;
    this.onFallback = onFallback;
    this.active = false;
    this.controller = null;
    this.backoff = DEFAULT_BACKOFF;
    this.watchdog = null;
    this.pollTimer = null;
  }

  start() {
    if (this.active || !this.token) return;
    this.active = true;
    this.connect();
  }

  stop() {
    this.active = false;
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
    clearTimeout(this.watchdog);
    this.watchdog = null;
    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  // Web parity — no data for 45s means the connection is dead: drop and retry.
  _resetWatchdog() {
    clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => {
      if (!this.active) return;
      this.controller?.abort();
      const delay = this.backoff;
      this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF);
      setTimeout(() => { if (this.active) this.connect(); }, delay);
    }, WATCHDOG_MS);
  }

  // Native fallback — periodic catch-up pulls (web 5-min safety-net equivalent).
  _fallbackPolling() {
    if (this.pollTimer) return;
    if (this.onFallback) this.onFallback();
    this.pollTimer = setInterval(() => {
      if (this.active && this.onFallback) this.onFallback();
    }, 30000);
  }

  async connect() {
    if (!this.active || !this.token) return;
    if (this.controller) this.controller.abort();
    this.controller = new AbortController();

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
      if (err.name === 'AbortError') return;
      if (this.onError) this.onError(err.message);
    }

    if (!this.active) return;
    clearTimeout(this.watchdog);
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF);
    setTimeout(() => {
      if (this.active) this.connect();
    }, delay);
  }
}
