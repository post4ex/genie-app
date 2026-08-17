#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
#  GENIE App — Environment Setup Script
# ──────────────────────────────────────────────
#  Run this script anytime you need to:
#    ✓ Check and install system dependencies
#    ✓ Check core CLI tools (Node.js, npm, Git, Python 3)
#    ✓ Set up global npm tools (eas-cli, @expo/ngrok)
#    ✓ Install genie-app package dependencies (npm)
#    ✓ Clean build and npm caches
# ──────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${CYAN}   GENIE App — Environment Setup          ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo ""

# ──────────────────────────────────────────────
#  1. Check & Install System Packages (apt)
# ──────────────────────────────────────────────
log_info "Checking system packages (apt)..."
SYSTEM_DEPS=(
    "build-essential"
    "python3"
    "ca-certificates"
    "procps"
    "curl"
    "git"
    "zip"
    "unzip"
    "jq"
    "lsof"
    "psmisc"
)

MISSING_DEPS=()
for pkg in "${SYSTEM_DEPS[@]}"; do
    if dpkg -s "$pkg" &>/dev/null 2>&1; then
        log_ok "$pkg: Installed"
    else
        log_warn "$pkg: NOT installed"
        MISSING_DEPS+=("$pkg")
    fi
done

if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    echo ""
    log_info "Attempting to install missing system packages..."
    if sudo -n true &>/dev/null && sudo -n apt-get update -y && sudo -n apt-get install -y "${MISSING_DEPS[@]}"; then
        log_ok "System packages installed successfully."
    else
        log_warn "Could not install system packages automatically (sudo requires password)."
        echo "  If needed, run manually:"
        echo "    sudo apt-get update && sudo apt-get install -y ${MISSING_DEPS[*]}"
    fi
else
    log_ok "All core system packages are present."
fi

echo ""

# ──────────────────────────────────────────────
#  2. Check Core CLI Tools
# ──────────────────────────────────────────────
log_info "Checking core CLI tools..."

check_cmd() {
    local cmd=$1
    local name=$2
    if command -v "$cmd" &>/dev/null; then
        local version
        version=$("$cmd" --version 2>&1 || "$cmd" version 2>&1 || echo "installed")
        version="${version%%$'\n'*}"
        log_ok "$name: $version"
    else
        log_warn "$name is NOT installed"
    fi
    return 0
}

check_cmd node       "Node.js"
check_cmd npm        "npm"
check_cmd git        "Git"
check_cmd python3    "Python 3"

echo ""

# ──────────────────────────────────────────────
#  3. Install npm Globals
# ──────────────────────────────────────────────
log_info "Setting up npm global packages..."

install_npm_global() {
    local pkg=$1
    if npm list -g "$pkg" &>/dev/null 2>&1 || command -v "$pkg" &>/dev/null; then
        log_ok "$pkg: Already installed"
    else
        log_info "Installing $pkg globally..."
        if npm install -g "$pkg" || (sudo -n npm install -g "$pkg" 2>/dev/null); then
            log_ok "$pkg installed successfully"
        else
            log_warn "Failed to install $pkg globally (non-critical, continuing...)"
        fi
    fi
}

install_npm_global "eas-cli"
install_npm_global "@expo/ngrok"
install_npm_global "expo-cli"

echo ""

# ──────────────────────────────────────────────
#  4. Install genie-app Package Dependencies
# ──────────────────────────────────────────────
log_info "Installing genie-app dependencies..."
if [ -f "$SCRIPT_DIR/package.json" ]; then
    if (cd "$SCRIPT_DIR" && npm install); then
        log_ok "genie-app: npm dependencies installed successfully."
    else
        log_warn "genie-app: npm install returned warnings or non-zero status."
    fi
else
    log_error "package.json not found in $SCRIPT_DIR"
fi

echo ""

# ──────────────────────────────────────────────
#  5. Clean System & npm Caches
# ──────────────────────────────────────────────
log_info "Cleaning npm and build caches..."
npm cache clean --force &>/dev/null || true
rm -rf ~/.cache/* &>/dev/null || true
log_ok "System and npm caches cleaned."

echo ""

# ──────────────────────────────────────────────
#  Summary
# ──────────────────────────────────────────────
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  genie-app setup complete!${NC}"
echo ""
echo -e "  IMPORTANT: First navigate to the project folder:"
echo -e "    ${YELLOW}cd $SCRIPT_DIR${NC}"
echo ""
echo -e "  To start the genie-app development server:"
echo -e "    ${YELLOW}npm start${NC}  or  ${YELLOW}bash start.sh${NC}"
echo ""
echo -e "  To run Expo with tunnel mode:"
echo -e "    ${YELLOW}npm run start:tunnel${NC}"
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo ""
