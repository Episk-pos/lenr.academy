#!/usr/bin/env bash
set -e

# LENR Academy - Development Server Startup
# Usage: ./start.sh
#
# Windows users: run via WSL or Git Bash (https://gitforwindows.org)

cd "$(dirname "$0")"

# Colors (disabled when stdout is not a terminal)
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;36m'
  NC='\033[0m'
else
  RED='' GREEN='' YELLOW='' BLUE='' NC=''
fi

log()   { printf '%b%s%b\n' "$BLUE" "$1" "$NC"; }
ok()    { printf '%b%s%b\n' "$GREEN" "$1" "$NC"; }
warn()  { printf '%b%s%b\n' "$YELLOW" "$1" "$NC"; }
fail()  { printf '%b%s%b\n' "$RED" "$1" "$NC" >&2; exit 1; }

# Check Node.js
if ! command -v node &> /dev/null; then
  fail "Node.js is not installed. Install it from https://nodejs.org"
fi

# Check npm
if ! command -v npm &> /dev/null; then
  fail "npm is not installed. It should come with Node.js — see https://nodejs.org"
fi

NODE_VERSION=$(node -v)
log "Node $NODE_VERSION detected"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  warn "node_modules not found — running npm install (this also downloads the ~161MB database)..."
  npm install
elif [ ! -f "public/parkhomov.db" ]; then
  warn "Database not found — downloading..."
  npm run db:download
else
  ok "Dependencies and database ready"
fi

echo ""
ok "Starting LENR Academy dev server..."
echo ""
log "Once running, open: http://localhost:5173"
echo ""

exec npm run dev
