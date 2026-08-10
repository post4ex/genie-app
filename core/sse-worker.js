// ============================================================================
// SSE-WORKER.JS — SharedWorker: one SSE connection per browser origin
// ============================================================================
// Owns the fetch + read loop. Broadcasts every event to ALL ports.
// Layout's document.hidden guard handles write filtering per tab.
// ============================================================================

const ports   = new Set();
let _url      = '';
let _token    = '';
let _abort    = null;
let _backoff  = 3000;
let _watchdog = null;
let _running  = false;

function _resetWatchdog() {
    clearTimeout(_watchdog);
    _watchdog = setTimeout(() => { _abort?.abort(); _open(); }, 45000);
}

function _broadcast(payload) {
    for (const port of ports) {
        try { port.postMessage(payload); } catch (_) {}
    }
}

async function _open() {
    if (!_token || !_url || _running) return;
    _running = true;

    if (_abort) _abort.abort();
    _abort = new AbortController();

    try {
        const res = await fetch(`${_url}/api/events`, {
            headers: { 'Authorization': `Bearer ${_token}` },
            signal: _abort.signal
        });

        if (res.status === 401) {
            _broadcast({ type: 'logout' });
            _running = false;
            return;
        }

        if (!res.ok || !res.body) throw new Error('SSE failed');

        _resetWatchdog();
        _backoff = 3000;

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const parts = buf.split('\n\n');
            buf = parts.pop();
            for (const part of parts) {
                const line = part.trim();
                if (!line.startsWith('data:')) continue;
                try {
                    const payload = JSON.parse(line.slice(5).trim());
                    if (payload.type === 'heartbeat') _backoff = 3000;
                    _resetWatchdog();
                    _broadcast(payload);
                } catch (_) {}
            }
        }
    } catch (e) {
        if (e.name === 'AbortError') { _running = false; return; }
    }

    clearTimeout(_watchdog);
    _running = false;
    const delay = _backoff;
    _backoff = Math.min(_backoff * 2, 30000);
    setTimeout(_open, delay);
}

onconnect = (e) => {
    const port = e.ports[0];
    ports.add(port);
    port.start();

    port.onmessage = (ev) => {
        const { type, token, url } = ev.data || {};
        if (type === 'init') {
            _token = token;
            _url   = url || self.location.origin;
            if (!_running) _open();
        }
        if (type === 'token') {
            _token = token;
            _abort?.abort();
            _running = false;
            _open();
        }
        if (type === 'logout') {
            _token = '';
            _abort?.abort();
            clearTimeout(_watchdog);
            _running = false;
        }
        if (type === 'close') {
            ports.delete(port);
            if (ports.size === 0) {
                _abort?.abort();
                clearTimeout(_watchdog);
                _running = false;
            }
        }
    };
};
