#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

INTERNAL_IP="100.115.92.26"
ARC_IP="100.115.92.2:5555"

echo "Connecting to Chromebook internal Android ($ARC_IP)..."
adb connect "$ARC_IP" 2>/dev/null || true
adb -s "$ARC_IP" reverse tcp:8081 tcp:8081 2>/dev/null || true

export REACT_NATIVE_PACKAGER_HOSTNAME="$INTERNAL_IP"
export EXPO_NO_TELEMETRY=1
export EXPO_TOKEN="FaffilCCvzYoP4e7QvClpWpPI7HbxcWgo0PFwkmk"
export NODE_OPTIONS="--max-old-space-size=2048"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "   ⚡ GENIE_REACT — Native Chromebook On-Screen Mode"
echo "═══════════════════════════════════════════════════════════"
echo "  ✓ Internal Target      : $INTERNAL_IP:8081"
echo "  ✓ Android Device       : corsola (Built-in)"
echo "  ✓ Launching in Expo Go : exp://$INTERNAL_IP:8081"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Auto launch in background after server comes up
(
  sleep 4
  echo "Opening project in Chromebook Expo Go..."
  adb -s "$ARC_IP" shell am start -a android.intent.action.VIEW -d "exp://$INTERNAL_IP:8081" host.exp.exponent 2>/dev/null || true
) &

exec npx expo start --host lan --clear
