#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/gan/current}"
ENV_FILE="${ENV_FILE:-/home/ubuntu/gan/shared/.env}"
PORT="${PORT:-3000}"

echo "[1/6] Checking app directory..."
test -d "$APP_DIR"
echo "[OK] $APP_DIR"

echo "[2/6] Checking env file..."
test -f "$ENV_FILE"
echo "[OK] $ENV_FILE"

echo "[3/6] Checking DATABASE_URL..."
DATABASE_URL_LINE="$(grep '^DATABASE_URL=' "$ENV_FILE" || true)"
if [[ -z "$DATABASE_URL_LINE" ]]; then
  echo "[ERROR] DATABASE_URL missing in $ENV_FILE"
  exit 1
fi
if [[ "$DATABASE_URL_LINE" != DATABASE_URL=mysql://* ]]; then
  echo "[ERROR] DATABASE_URL is not a mysql:// connection string"
  exit 1
fi
echo "[OK] DATABASE_URL looks valid"

echo "[4/6] Checking PM2 process..."
if ! pm2 status gan-app | grep -q "online"; then
  echo "[ERROR] PM2 process gan-app is not online"
  pm2 status gan-app || true
  exit 1
fi
echo "[OK] PM2 gan-app is online"

echo "[5/6] Checking health endpoint..."
if ! curl -sf "http://127.0.0.1:${PORT}/api/trpc/ping" >/tmp/gan-health.out; then
  echo "[ERROR] Health check failed"
  pm2 logs gan-app --lines 30 --nostream || true
  exit 1
fi
echo "[OK] Health endpoint responded"
cat /tmp/gan-health.out
echo

echo "[6/6] Checking MySQL connectivity..."
DATABASE_URL_VALUE="${DATABASE_URL_LINE#DATABASE_URL=}"
node -e "const u=new URL(process.argv[1]); console.log('[OK] mysql host=' + u.hostname + ' db=' + u.pathname.slice(1));" "$DATABASE_URL_VALUE"

echo
echo "Production verification passed."
