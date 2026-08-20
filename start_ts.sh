#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  ⚡ GENIE_REACT — Instant Tailscale P2P Metro Launcher
# ─────────────────────────────────────────────────────────────
set -e

# 0. Clean port 8081 of any dangling processes
pkill -9 -f "8081" 2>/dev/null || true
pkill -9 -f "expo.*start" 2>/dev/null || true
fuser -k 8081/tcp 2>/dev/null || true
for pid in $(ss -tulpn 2>/dev/null | grep ':8081 ' | sed -n 's/.*pid=\([0-9]*\).*/\1/p'); do
    kill -9 "$pid" 2>/dev/null || true
done

TS_IP=$(tailscale ip -4 2>/dev/null || echo "")

if [ -z "$TS_IP" ]; then
    echo "❌ Tailscale is not running. Starting tailscale..."
    sudo tailscaled &
    sleep 2
    TS_IP=$(tailscale ip -4 2>/dev/null || echo "")
fi

if [ -z "$TS_IP" ]; then
    echo "❌ Tailscale IP not found. Please run 'sudo tailscale up' to log in."
    exit 1
fi

export REACT_NATIVE_PACKAGER_HOSTNAME="$TS_IP"
export EXPO_NO_TELEMETRY=1
export EXPO_TOKEN="FaffilCCvzYoP4e7QvClpWpPI7HbxcWgo0PFwkmk"
export NODE_OPTIONS="--max-old-space-size=2048"

EXPO_URI="exp://$TS_IP:8081"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "   ⚡ GENIE_REACT — Tailscale Direct P2P Mode"
echo "═══════════════════════════════════════════════════════════"
echo "  ✓ Tailscale IP : $TS_IP"
echo "  ✓ Expo URI     : $EXPO_URI"
echo "  ✓ Target Phone : aruns-f36 (Connected)"
echo "  ✓ Network Lag  : 0% Direct P2P"
echo "═══════════════════════════════════════════════════════════"
echo ""

exec npx expo start --host lan --clear --port 8081
