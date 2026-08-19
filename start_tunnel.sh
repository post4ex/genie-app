#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  ⚡ GENIE_REACT — One-Command Metro + Localtunnel + QR Launcher
# ─────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export EXPO_NO_TELEMETRY=1
export EXPO_TOKEN="FaffilCCvzYoP4e7QvClpWpPI7HbxcWgo0PFwkmk"
export NODE_OPTIONS="--max-old-space-size=2048"

# 1. Clean dangling tunnel/metro processes on 8081 if needed
pkill -f "localtunnel.*8081" 2>/dev/null || true

# 2. Check if Metro is already running on port 8081, start if not
if ! lsof -i:8081 &>/dev/null && ! fuser 8081/tcp &>/dev/null; then
    echo "⚡ Starting Metro server on port 8081..."
    npx expo start --host lan --clear --port 8081 &
    sleep 5
fi

# 3. Create Localtunnel and capture output
echo "🌐 Spawning Localtunnel for Port 8081..."
LT_LOG="/tmp/localtunnel_8081.log"
rm -f "$LT_LOG"
npx --yes localtunnel --port 8081 > "$LT_LOG" 2>&1 &
LT_PID=$!

# Wait for tunnel URL
echo -n "⏳ Waiting for tunnel URL..."
for i in {1..15}; do
    if grep -q "your url is:" "$LT_LOG" 2>/dev/null; then
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

LT_URL=$(grep -o 'https://[^ ]*' "$LT_LOG" | head -n1)

if [ -z "$LT_URL" ]; then
    echo "❌ Failed to obtain Localtunnel URL. Log content:"
    cat "$LT_LOG"
    exit 1
fi

EXPS_URL=$(echo "$LT_URL" | sed 's#https://#exps://#')

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "   🌐 GENIE_REACT — Localtunnel Direct Mode"
echo "═══════════════════════════════════════════════════════════"
echo "  ✓ HTTPS URL   : $LT_URL"
echo "  ✓ Expo URI    : $EXPS_URL"
echo "  ✓ Action      : Scan the QR code below in Expo Go"
echo "═══════════════════════════════════════════════════════════"
echo ""

node -e "require('qrcode-terminal').generate('$EXPS_URL', {small: true})"

wait $LT_PID
