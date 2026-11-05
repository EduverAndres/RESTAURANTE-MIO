#!/usr/bin/env bash
# Despliega la app en la instancia de Lightsail, paso a paso.
#
# Uso, desde la carpeta del repo en el servidor:
#   bash scripts/deploy-lightsail.sh
#   SERVICE=tienda PORT=3000 bash scripts/deploy-lightsail.sh
#
# Qué hace, en orden: actualiza la rama actual, pone el nombre de la marca,
# se asegura de que haya memoria para compilar (Next.js necesita ~2,5 GB y
# una instancia pequeña tiene 1-2 GB), instala dependencias, ofrece aplicar
# migraciones, compila, arma la carpeta standalone, reinicia el servicio y
# comprueba /api/health. Pregunta antes de todo lo que cambia la máquina o
# la base de datos.
set -euo pipefail
cd "$(dirname "$0")/.."

SERVICE="${SERVICE:-tienda}"
PORT="${PORT:-3000}"

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ask() {
  local reply
  read -r -p "$1 [s/N] " reply
  [[ "$reply" =~ ^[sSyY]$ ]]
}

step "1. Código"
echo "Rama: $(git branch --show-current) · commit $(git rev-parse --short HEAD)"
if ! git diff --quiet; then
  echo "Hay cambios locales en archivos del repo:"
  git status --short
  ask "¿Sigo de todas formas (se conservan)?" || exit 1
fi
git pull --ff-only
echo "Ahora en: $(git log --oneline -1)"

step "2. Nombre de la marca"
for file in .env.local .env.production; do
  [ -f "$file" ] || continue
  if grep -q '^NEXT_PUBLIC_APP_NAME=Tienda' "$file"; then
    cp "$file" "$file.bak.$(date +%s)"
    sed -i 's/^NEXT_PUBLIC_APP_NAME=Tienda\r\?$/NEXT_PUBLIC_APP_NAME=Cerquita/' "$file"
    echo "$file: Tienda → Cerquita (con copia de respaldo)"
  fi
done
grep -h '^NEXT_PUBLIC_APP_NAME=' .env.local .env.production 2>/dev/null || echo "Sin NEXT_PUBLIC_APP_NAME: se usa Cerquita"

step "3. Memoria para compilar"
mem_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
swap_mb=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
echo "RAM: ${mem_mb} MB · swap: ${swap_mb} MB"
if (( mem_mb + swap_mb < 3500 )); then
  echo "Next.js necesita unos 2,5 GB para compilar y aquí hay menos."
  if ask "¿Creo y activo 2 GB de swap en /swapfile-build?"; then
    if [ ! -f /swapfile-build ]; then
      sudo fallocate -l 2G /swapfile-build
      sudo chmod 600 /swapfile-build
      sudo mkswap /swapfile-build > /dev/null
    fi
    sudo swapon /swapfile-build 2> /dev/null || true
    swap_mb=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
    echo "Swap ahora: ${swap_mb} MB (se desactiva al reiniciar la máquina)"
  fi
fi
heap=$(( (mem_mb + swap_mb) * 3 / 4 ))
(( heap > 3072 )) && heap=3072
(( heap < 1024 )) && heap=1024
export NODE_OPTIONS="--max-old-space-size=${heap}"
echo "NODE_OPTIONS=${NODE_OPTIONS}"

step "4. Dependencias"
npm ci

step "5. Migraciones"
if ask "¿Reviso y aplico las migraciones pendientes (npm run db:push)?"; then
  npm run db:push
fi

step "6. Compilando (puede tardar varios minutos)"
npm run build
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

# `next build` copies only .env and .env.production into the standalone
# folder, and server.js loads its environment from there. Without the local
# files the store renders (NEXT_PUBLIC_* are baked in at build time) but
# every order fails: the server secrets are missing at runtime.
for file in .env.local .env.production.local; do
  if [ -f "$file" ]; then
    cp "$file" .next/standalone/
    chmod 600 ".next/standalone/$file"
    echo "Copiado $file a .next/standalone/"
  fi
done
if ! grep -qsE '^(SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY)=.+' \
  .next/standalone/.env .next/standalone/.env.production \
  .next/standalone/.env.local .next/standalone/.env.production.local; then
  echo "AVISO: ningún .env tiene SUPABASE_SECRET_KEY ni SUPABASE_SERVICE_ROLE_KEY."
  echo "Sin una de ellas no se pueden crear pedidos. Si el servicio las recibe"
  echo "por pm2 o systemd, ignora este aviso."
fi

step "7. Reiniciando ${SERVICE}"
if command -v pm2 > /dev/null && pm2 describe "$SERVICE" > /dev/null 2>&1; then
  pm2 restart "$SERVICE" --update-env
elif systemctl list-unit-files --type=service 2> /dev/null | grep -q "^${SERVICE}\.service"; then
  sudo systemctl restart "$SERVICE"
else
  echo "No encontré un servicio llamado '${SERVICE}'. Estos son los que hay:"
  command -v pm2 > /dev/null && pm2 list || true
  systemctl list-units --type=service --state=running 2> /dev/null \
    | grep -i -E 'node|next|tienda|cerquita' || true
  echo "Vuelve a correr con SERVICE=<nombre> o reinícialo a mano."
  exit 1
fi

step "8. Verificando"
code=000
for _ in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/api/health" || true)
  if [ "$code" = "200" ]; then
    echo "Listo: la app responde 200 en /api/health."
    exit 0
  fi
  sleep 3
done
echo "La app no respondió 200 en /api/health (último código: ${code})."
echo "Revisa los registros: pm2 logs ${SERVICE} --lines 100   o   journalctl -u ${SERVICE} -n 100"
exit 1
