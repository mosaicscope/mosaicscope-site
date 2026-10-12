#!/usr/bin/env bash
# Start the Mosaics' world locally. Needs Node.js (https://nodejs.org).
cd "$(dirname "$0")"
if ! command -v npm >/dev/null 2>&1; then echo "Please install Node.js from https://nodejs.org first."; exit 1; fi
[ -d node_modules ] || npm install
npm start
