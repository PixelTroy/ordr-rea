#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export DATABASE_URL="${DATABASE_URL:-postgresql://ordr:ordr@localhost:5432/ordr}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-dev-access-secret-change-me}"
export JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-dev-refresh-secret-change-me}"
export APP_URL="${APP_URL:-http://localhost:3000}"
export WEB_ORIGIN="${WEB_ORIGIN:-http://localhost:3000}"
export API_INTERNAL_URL="${API_INTERNAL_URL:-http://127.0.0.1:4000}"
export PORT="${PORT:-4000}"
pnpm --filter @ordr/shared build
pnpm --filter @ordr/api exec prisma migrate deploy
pnpm --filter @ordr/api dev &
API_PID=$!
pnpm --filter @ordr/web dev &
WEB_PID=$!
trap 'kill $API_PID $WEB_PID 2>/dev/null || true' EXIT
wait
