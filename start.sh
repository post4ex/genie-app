#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Auto-detect the active outbound Wi-Fi/LAN IPv4 address
LAN_IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}')

if [ -z "$LAN_IP" ]; then
    LAN_IP="127.0.0.1"
fi

HOST_NAME="$(hostname).local"

echo ""
echo "══════════════════════════════════════════════"
echo "   GENIE_REACT — Auto-Configured LAN Mode"
echo "══════════════════════════════════════════════"
echo "  ✓ Detected Active Wi-Fi IP : $LAN_IP"
echo "  ✓ Local Hostname           : $HOST_NAME"
echo "  ✓ Mode                     : LAN (Auto-Bound)"
echo "══════════════════════════════════════════════"
echo ""

export REACT_NATIVE_PACKAGER_HOSTNAME="$LAN_IP"
export EXPO_NO_TELEMETRY=1
export EXPO_TOKEN="${EXPO_TOKEN:-VPbsEYyoWNC1p3V1LCnLRdZsxsAPgq8pQmYesQKL}"

exec npx expo start --host lan --clear "$@"
