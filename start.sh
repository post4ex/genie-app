#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  ⚡ GENIE_REACT Launcher — Auto-Bridging for Chromebook & USB
# ─────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Clean port 8081 of any dangling processes
if command -v fuser &>/dev/null; then
    fuser -k 8081/tcp 2>/dev/null || true
fi
if command -v lsof &>/dev/null; then
    lsof -ti:8081 2>/dev/null | xargs -r kill -9 2>/dev/null || true
fi
pkill -f "metro.*8081" 2>/dev/null || true
pkill -f "expo.*start" 2>/dev/null || true

# 2. Always auto-reconnect to ChromeOS Android Subsystem (ARCVM / corsola)
echo "🔌 Detecting Android Devices & ChromeOS Subsystem..."
adb connect 100.115.92.2:5555 2>/dev/null || true

# 3. Retrieve all active devices (corsola internal Android + USB devices)
DEVICES=$(adb devices 2>/dev/null | awk 'NR>1 && $2=="device" {print $1}')

export EXPO_NO_TELEMETRY=1
export NODE_OPTIONS="--max-old-space-size=2048"

if [ -n "$DEVICES" ]; then
    echo "  ✓ Connected Android Device(s) detected:"
    for dev in $DEVICES; do
        DEV_NAME=$(adb -s "$dev" shell getprop ro.product.model 2>/dev/null | tr -d '\r\n' || echo "$dev")
        echo "    📱 $dev ($DEV_NAME)"
        adb -s "$dev" reverse tcp:8081 tcp:8081 2>/dev/null || true
        adb -s "$dev" reverse tcp:8082 tcp:8082 2>/dev/null || true
        adb -s "$dev" reverse tcp:19000 tcp:19000 2>/dev/null || true
    done

    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "   ⚡ GENIE_REACT — Direct Bridge Mode (ChromeOS & USB)"
    echo "═══════════════════════════════════════════════════════════"
    echo "  ✓ Device Bridge        : Active (adb reverse tcp:8081)"
    echo "  ✓ Target               : corsola / Android Subsystem"
    echo "  ✓ Network Overhead     : 0% (Localhost Direct)"
    echo "  ✓ Action               : Press 'a' to open on ChromeOS Android"
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    export REACT_NATIVE_PACKAGER_HOSTNAME="localhost"
    exec npx expo start --localhost --clear "$@"
else
    # Fallback to Wi-Fi mode if no ADB device found
    CHROMEBOOK_IP="${1:-}"
    if [ -z "$CHROMEBOOK_IP" ] && [ -f "$HOME/.chromebook_wifi_ip" ]; then
        CHROMEBOOK_IP=$(cat "$HOME/.chromebook_wifi_ip" | tr -d ' \r\n')
    fi
    if [ -z "$CHROMEBOOK_IP" ]; then
        CHROMEBOOK_IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}')
    fi

    export REACT_NATIVE_PACKAGER_HOSTNAME="$CHROMEBOOK_IP"

    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "   ⚡ GENIE_REACT — Wi-Fi LAN Mode"
    echo "═══════════════════════════════════════════════════════════"
    echo "  ✓ Host IP              : $CHROMEBOOK_IP"
    echo "  ✓ Port                 : 8081"
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    exec npx expo start --host lan --clear "$@"
fi
