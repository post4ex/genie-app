// ============================================================================
// NAVIGATION-GUARD.JS — Per-page navigation blocker
// ============================================================================
// Blocks only on browser back button / close tab / refresh.
// Intentional navigation (link clicks, form submits, logout) auto-clears the
// dirty state so beforeunload never fires for user-initiated navigation.
//
// Usage:
//   NavigationGuard.enable(selector)  — watch all inputs inside a container
//   NavigationGuard.enable()          — manual markDirty/markClean control
//   NavigationGuard.disable()         — remove listeners, reset state
//   NavigationGuard.markDirty()       — mark as dirty
//   NavigationGuard.markClean()       — mark as clean (called on save/submit)
//   NavigationGuard.isDirty()         — check current state
// ============================================================================

(function() {
    'use strict';

    var _dirty = false;
    var _enabled = false;
    var _containers = [];

    // ── beforeunload — fires on back button, close tab, refresh ──────────────
    function _beforeUnload(e) {
        if (_dirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    }

    function _makeDirty() {
        _dirty = true;
    }

    function _makeClean() {
        _dirty = false;
    }

    // ── Auto-clean on link clicks ────────────────────────────────────────────
    // Capture-phase handler catches ALL <a href> clicks before beforeunload
    // fires, so menu / submenu / logout links navigate freely.
    function _onLinkClick(e) {
        var a = e.target.closest('a[href]');
        if (!a) return;
        var href = a.getAttribute('href') || '';
        // Skip hash-only / javascript: anchors — they don't navigate away
        if (href === '#' || href.startsWith('javascript:') || href.startsWith('#')) return;
        _dirty = false;
    }

    var NavigationGuard = {
        enable: function(selector) {
            if (_enabled) return;
            _enabled = true;
            _dirty = false;

            window.addEventListener('beforeunload', _beforeUnload);
            // Capture phase — fires before any bubble handler and before navigation
            document.addEventListener('click', _onLinkClick, true);
            // Form submission navigates away — clean before beforeunload
            document.addEventListener('submit', _makeClean, true);

            if (selector) {
                var selectors = Array.isArray(selector) ? selector : [selector];
                selectors.forEach(function(sel) {
                    var container = document.querySelector(sel);
                    if (container) {
                        _containers.push(container);
                        container.addEventListener('input', _makeDirty, true);
                        container.addEventListener('change', _makeDirty, true);
                    }
                });
            }
        },

        disable: function() {
            if (!_enabled) return;
            _enabled = false;
            _dirty = false;

            window.removeEventListener('beforeunload', _beforeUnload);
            document.removeEventListener('click', _onLinkClick, true);
            document.removeEventListener('submit', _makeClean, true);

            _containers.forEach(function(container) {
                container.removeEventListener('input', _makeDirty, true);
                container.removeEventListener('change', _makeDirty, true);
            });
            _containers = [];
        },

        markDirty: function() { _dirty = true; },
        markClean: function() { _dirty = false; },
        isDirty:   function() { return _dirty; },

        /** Call before any programmatic redirect (logout, etc.) */
        cleanBeforeNav: function() {
            _dirty = false;
        }
    };

    window.NavigationGuard = NavigationGuard;

    // ── Window-level aliases for pages that use the old pattern ────────────────
    window.markDirty = _makeDirty;
    window.markClean = _makeClean;
})();
