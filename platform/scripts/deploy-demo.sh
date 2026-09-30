#!/usr/bin/env bash
# Despliega un preview con datos ficticios. Los secretos deben existir previamente
# en el entorno Preview de Vercel; nunca se pasan como argumentos del proceso.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
: "${ADMIN_EMAIL:?Falta ADMIN_EMAIL en .env.local}"
wompi=()
for key in WOMPI_PUBLIC_KEY WOMPI_INTEGRITY_SECRET WOMPI_EVENTS_SECRET; do
  if [ -n "${!key:-}" ]; then wompi+=(-e "$key"); fi
done
npx -y vercel@latest deploy --yes --target=preview "${wompi[@]+"${wompi[@]}"}" \
  -b DEMO_DATABASE=1 -e DEMO_DATABASE=1 \
  -e ADMIN_EMAIL -e ADMIN_PASSWORD_HASH -e ADMIN_SESSION_SECRET
