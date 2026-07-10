#!/usr/bin/env bash
# Fase D — Smoke post-deploy (API Django + SPA)
# Uso: API_BASE_URL=https://api.example.com ./scripts/smoke.sh

set -euo pipefail

API_BASE_URL="${API_BASE_URL:-${VITE_API_BASE_URL:-}}"
if [[ -z "$API_BASE_URL" ]]; then
  echo "ERROR: define API_BASE_URL o VITE_API_BASE_URL"
  exit 1
fi

echo "==> Smoke API base: $API_BASE_URL"

# TODO Fase D: ajustar paths reales del backend Django
echo "==> GET health/login (ajustar endpoint)"
curl -sf -o /dev/null -w "%{http_code}\n" "${API_BASE_URL}/auth/login/" || true

echo "==> 401 sin token (ajustar endpoint protegido)"
code=$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE_URL}/transactions/" || echo "000")
if [[ "$code" != "401" && "$code" != "403" ]]; then
  echo "WARN: esperaba 401/403 sin auth, obtuvo $code"
fi

echo "==> Smoke completado (revisar WARNs)"
