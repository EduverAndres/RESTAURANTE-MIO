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

step "2b. Dirección pública del sitio (NEXT_PUBLIC_SITE_URL)"
# Next.js copia NEXT_PUBLIC_SITE_URL dentro del build: redirecciones, QR de
# las mesas, URLs de pago y enlaces de correo salen de aquí. Si la instancia
# cambió de IP pública y esta variable no, todo manda a la IP vieja.
# Precedencia de Next en producción: entorno del shell, .env.production.local,
# .env.local, .env.production, .env.
site_url="${NEXT_PUBLIC_SITE_URL:-}"
site_file=""
if [ -n "$site_url" ]; then
  site_file="(entorno del shell)"
else
  for file in .env.production.local .env.local .env.production .env; do
    [ -f "$file" ] || continue
    line=$(grep -E '^NEXT_PUBLIC_SITE_URL=' "$file" | tail -n 1 | tr -d '\r' || true)
    if [ -n "$line" ]; then
      site_url="${line#NEXT_PUBLIC_SITE_URL=}"
      site_url="${site_url%\"}"; site_url="${site_url#\"}"
      site_url="${site_url%\'}"; site_url="${site_url#\'}"
      site_file="$file"
      break
    fi
  done
fi
if [ -z "$site_url" ]; then
  echo "ERROR: no hay NEXT_PUBLIC_SITE_URL en el entorno ni en los .env."
  echo "Agrégala a .env.local, por ejemplo: NEXT_PUBLIC_SITE_URL=http://<IP-o-dominio>"
  exit 1
fi
echo "NEXT_PUBLIC_SITE_URL=${site_url}  (de ${site_file})"

# IP pública de esta máquina: metadatos de la instancia (IMDSv2) y, si no
# responden, el servicio de AWS que devuelve la IP de quien pregunta.
imds_token=$(curl -s -m 2 -X PUT http://169.254.169.254/latest/api/token \
  -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' || true)
public_ip=$(curl -s -m 2 -H "X-aws-ec2-metadata-token: ${imds_token}" \
  http://169.254.169.254/latest/meta-data/public-ipv4 || true)
if ! [[ "$public_ip" =~ ^[0-9]+(\.[0-9]+){3}$ ]]; then
  public_ip=$(curl -s -m 4 https://checkip.amazonaws.com | tr -d '[:space:]' || true)
fi
[[ "$public_ip" =~ ^[0-9]+(\.[0-9]+){3}$ ]] || public_ip=""
echo "IP pública de esta instancia: ${public_ip:-desconocida}"

site_scheme="${site_url%%://*}"
site_host="${site_url#*://}"; site_host="${site_host%%/*}"; site_host="${site_host%%:*}"
if [ -n "$public_ip" ] && [[ "$site_host" =~ ^[0-9]+(\.[0-9]+){3}$ ]] \
  && [ "$site_host" != "$public_ip" ]; then
  echo "AVISO: el sitio apunta a ${site_host}, pero esta instancia es ${public_ip}."
  echo "Los usuarios terminarían en una IP que no es esta máquina."
  if [ "$site_file" != "(entorno del shell)" ] \
    && ask "¿Cambio NEXT_PUBLIC_SITE_URL a ${site_scheme}://${public_ip} en ${site_file} (con respaldo)?"; then
    cp "$site_file" "$site_file.bak.$(date +%s)"
    sed -i "s#^NEXT_PUBLIC_SITE_URL=.*#NEXT_PUBLIC_SITE_URL=${site_scheme}://${public_ip}#" "$site_file"
    echo "Actualizado: $(grep -E '^NEXT_PUBLIC_SITE_URL=' "$site_file")"
    echo "Recuerda poner la misma dirección en Supabase (Authentication → URL Configuration)."
  else
    ask "¿Sigo compilando con ${site_url} de todas formas?" || exit 1
  fi
elif [ -n "$public_ip" ] && ! [[ "$site_host" =~ ^[0-9]+(\.[0-9]+){3}$ ]]; then
  resolved=$(getent hosts "$site_host" | awk '{print $1}' | head -n 1 || true)
  if [ -n "$resolved" ] && [ "$resolved" != "$public_ip" ]; then
    echo "AVISO: ${site_host} resuelve a ${resolved}, no a ${public_ip}. Revisa el DNS."
  fi
fi

# La app solo atiende en esta dirección: quien entre por otra (la IP, un
# nombre de prueba) es redirigido a ella. Si todavía es la IP o el nombre
# temporal de sslip.io y ya hay dominio, este es el momento de cambiarla.
if [[ "$site_host" =~ ^[0-9]+(\.[0-9]+){3}$ || "$site_host" == *.sslip.io ]] \
  && [ "$site_file" != "(entorno del shell)" ]; then
  echo "AVISO: ${site_host} es una dirección provisional, no un dominio propio."
  read -r -p "Si ya tienes dominio, escríbelo (ej. cerquita.duckdns.org) o Enter para seguir: " new_domain \
    || new_domain=""
  new_domain="${new_domain#http://}"; new_domain="${new_domain#https://}"
  new_domain="${new_domain%%/*}"; new_domain=$(echo "$new_domain" | tr -d '[:space:]' | tr 'A-Z' 'a-z')
  if [ -n "$new_domain" ]; then
    if ! [[ "$new_domain" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]; then
      echo "ERROR: '${new_domain}' no parece un dominio."
      exit 1
    fi
    resolved=$(getent hosts "$new_domain" | awk '{print $1}' | head -n 1 || true)
    if [ -n "$public_ip" ] && [ "$resolved" != "$public_ip" ]; then
      echo "AVISO: ${new_domain} resuelve a '${resolved:-nada}', no a ${public_ip}."
      ask "¿Lo uso de todas formas?" || exit 1
    fi
    cp "$site_file" "$site_file.bak.$(date +%s)"
    sed -i "s#^NEXT_PUBLIC_SITE_URL=.*#NEXT_PUBLIC_SITE_URL=${site_scheme}://${new_domain}#" "$site_file"
    if grep -q '^NEXT_PUBLIC_ROOT_DOMAIN=' "$site_file"; then
      sed -i "s#^NEXT_PUBLIC_ROOT_DOMAIN=.*#NEXT_PUBLIC_ROOT_DOMAIN=${new_domain}#" "$site_file"
    else
      echo "NEXT_PUBLIC_ROOT_DOMAIN=${new_domain}" >> "$site_file"
    fi
    site_url="${site_scheme}://${new_domain}"
    site_host="$new_domain"
    echo "Actualizado (con respaldo): $(grep -E '^NEXT_PUBLIC_(SITE_URL|ROOT_DOMAIN)=' "$site_file" | tr '\n' ' ')"
    echo "Después del despliegue, cambia también:"
    echo "  - Supabase → Authentication → URL Configuration: Site URL ${site_url}"
    echo "    y en Redirect URLs agrega ${site_url}/**"
    echo "  - Wompi → URL de eventos: ${site_url}/api/webhooks/wompi"
  fi
fi

# Wompi no abre su checkout si la dirección de regreso es una IP o localhost:
# su firewall (CloudFront) responde "403 Request blocked" antes de mirar el
# pedido, y la app oculta Wompi en ese caso (lib/payments/wompi/status.ts).
wompi_key=$(grep -hE '^WOMPI_PUBLIC_KEY=.+' .env.production.local .env.local .env.production .env 2>/dev/null | head -n 1 || true)
if [ -n "$wompi_key" ] \
  && { [[ "$site_host" =~ ^[0-9]+(\.[0-9]+){3}$ ]] || [ "$site_host" = "localhost" ]; }; then
  echo "AVISO: Wompi bloquea los pagos mientras el sitio se publique como ${site_host}."
  echo "Su firewall rechaza direcciones con IP: el checkout mostraría un 403 de CloudFront,"
  echo "así que la app no ofrecerá Wompi. La solución definitiva es un dominio (docs/HTTPS.md)."
  ip_for_name="${public_ip:-$site_host}"
  if [[ "$ip_for_name" =~ ^[0-9]+(\.[0-9]+){3}$ ]] && [ "$site_file" != "(entorno del shell)" ]; then
    sslip_url="${site_scheme}://${ip_for_name//./-}.sslip.io"
    echo "Para probar ya, sin dominio: ${sslip_url} apunta a esta misma IP y Wompi lo acepta."
    if ask "¿Cambio NEXT_PUBLIC_SITE_URL a ${sslip_url} en ${site_file} (con respaldo)?"; then
      cp "$site_file" "$site_file.bak.$(date +%s)"
      sed -i "s#^NEXT_PUBLIC_SITE_URL=.*#NEXT_PUBLIC_SITE_URL=${sslip_url}#" "$site_file"
      echo "Actualizado: $(grep -E '^NEXT_PUBLIC_SITE_URL=' "$site_file")"
      echo "Después del despliegue:"
      echo "  - Entra a la app por ${sslip_url} (no por la IP) e inicia sesión de nuevo."
      echo "  - Supabase → Authentication → URL Configuration → Redirect URLs: agrega ${sslip_url}/**"
    fi
  fi
fi

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
