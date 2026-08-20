#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  ⚡ GENIE_REACT — Instant SSH Tunnel + QR Code Launcher
# ─────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export EXPO_NO_TELEMETRY=1
export EXPO_TOKEN="FaffilCCvzYoP4e7QvClpWpPI7HbxcWgo0PFwkmk"
export NODE_OPTIONS="--max-old-space-size=2048"

# 1. Clean port 8081 of any dangling processes
pkill -9 -f "8081" 2>/dev/null || true
pkill -9 -f "expo.*start" 2>/dev/null || true
fuser -k 8081/tcp 2>/dev/null || true

# 2. Check if Metro is running on port 8081, start if not
if ! lsof -i:8081 &>/dev/null && ! fuser 8081/tcp &>/dev/null; then
    echo "⚡ Starting Metro server on port 8081..."
    npx expo start --host lan --clear --port 8081 &
    sleep 4
fi

# 3. Create SSH Tunnel (Pinggy) and capture output
echo "🔐 Spawning Instant SSH Tunnel for Port 8081..."
SSH_LOG="/tmp/ssh_pinggy_8081.log"
rm -f "$SSH_LOG"
ssh -p 443 -o StrictHostKeyChecking=no -R0:localhost:8081 a.pinggy.io > "$SSH_LOG" 2>&1 &
SSH_PID=$!

# Wait for tunnel URL
echo -n "⏳ Establishing SSH tunnel..."
for i in {1..12}; do
    SSH_URL=$(grep -o 'https://[^ ]*pinggy-free\.link' "$SSH_LOG" 2>/dev/null | head -n1)
    if [ -n "$SSH_URL" ]; then
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

if [ -z "$SSH_URL" ]; then
    echo "❌ Failed to obtain SSH Tunnel URL. Log output:"
    cat "$SSH_LOG"
    exit 1
fi

EXPS_URL=$(echo "$SSH_URL" | sed 's#https://#exps://#')

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "   ⚡ GENIE_REACT — Instant Native SSH Tunnel"
echo "═══════════════════════════════════════════════════════════"
echo "  ✓ HTTPS URL   : $SSH_URL"
echo "  ✓ Expo URI    : $EXPS_URL"
echo "  ✓ Security    : 100% Native Encrypted SSH"
echo "  ✓ Action      : Scan the QR code below in Expo Go"
echo "═══════════════════════════════════════════════════════════"
echo ""

node -e "require('qrcode-terminal').generate('$EXPS_URL', {small: true})"

wait $SSH_PID
