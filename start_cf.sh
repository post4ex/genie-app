#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  ⚡ GENIE_REACT — Fast Cloudflare Metro + Tunnel + QR Launcher
# ─────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export EXPO_NO_TELEMETRY=1
export EXPO_TOKEN="FaffilCCvzYoP4e7QvClpWpPI7HbxcWgo0PFwkmk"
export NODE_OPTIONS="--max-old-space-size=2048"

# 1. Clean dangling tunnel/metro processes on 8081 if needed
pkill -f "cloudflared.*8081" 2>/dev/null || true

# 2. Check if Metro is running on port 8081, start if not
if ! lsof -i:8081 &>/dev/null && ! fuser 8081/tcp &>/dev/null; then
    echo "⚡ Starting Metro server on port 8081..."
    npx expo start --host lan --clear --port 8081 &
    sleep 4
fi

# 3. Create Cloudflare Tunnel and capture output
echo "🚀 Spawning Cloudflare Tunnel for Port 8081..."
CF_LOG="/tmp/cloudflared_8081.log"
rm -f "$CF_LOG"
npx --yes cloudflared tunnel --url http://127.0.0.1:8081 > "$CF_LOG" 2>&1 &
CF_PID=$!

# Wait for tunnel URL
echo -n "⏳ Requesting fast Cloudflare edge URL..."
for i in {1..12}; do
    CF_URL=$(grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' "$CF_LOG" 2>/dev/null | head -n1)
    if [ -n "$CF_URL" ]; then
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

if [ -z "$CF_URL" ]; then
    echo "❌ Failed to obtain Cloudflare Tunnel URL. Log output:"
    cat "$CF_LOG"
    exit 1
fi

EXPS_URL=$(echo "$CF_URL" | sed 's#https://#exps://#')

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "   ⚡ GENIE_REACT — Cloudflare High-Speed Direct Tunnel"
echo "═══════════════════════════════════════════════════════════"
echo "  ✓ HTTPS URL   : $CF_URL"
echo "  ✓ Expo URI    : $EXPS_URL"
echo "  ✓ Speed       : High-Speed Cloudflare Edge (2-sec load)"
echo "  ✓ Action      : Scan the QR code below in Expo Go"
echo "═══════════════════════════════════════════════════════════"
echo ""

node -e "require('qrcode-terminal').generate('$EXPS_URL', {small: true})"

wait $CF_PID
