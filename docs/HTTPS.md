# Dominio con HTTPS en Lightsail

Hoy Cerquita corre en `http://44.213.146.211`. Sin HTTPS los navegadores
**bloquean la geolocalización** (y también otras funciones como la cámara y
las notificaciones push en iOS), aunque el celular tenga GPS: el botón
"Usar mi ubicación" no puede funcionar. Esta guía deja la app en
`https://<tu-dominio>` sin romper los QR ya impresos.

> Esta guía no se ha ejecutado. Sigue los pasos en orden; cada uno tiene una
> comprobación antes de pasar al siguiente.

## 0. Antes de empezar

- **IP estática.** En Lightsail → *Networking*, confirma que `44.213.146.211`
  es una **Static IP** adjunta a la instancia. Si no lo es, créala y adjúntala
  primero: una IP dinámica cambia al reiniciar la instancia y el dominio
  quedaría apuntando a la nada (lo que ya pasó con `3.81.127.39`).
- **Firewall.** En la instancia → *Networking* → *IPv4 Firewall*, deben estar
  abiertos **HTTP (80)** y **HTTPS (443)**.

## 1. Comprar el dominio

Cualquier registrador sirve; lo que importa es poder editar su DNS.

| Opción | Ejemplo | Nota |
|---|---|---|
| `.co` / `.com.co` | registradores acreditados por .CO | Identidad local; `.com.co` suele ser más barato |
| `.com` | Cloudflare Registrar, Namecheap | Cloudflare vende a precio de costo |

Compra solo el dominio: no hace falta hosting, correo ni "SSL" del
registrador (el certificado es gratis, paso 4).

## 2. Configurar el DNS

En el panel DNS del registrador (o en una *DNS zone* de Lightsail, si
prefieres administrarlo ahí), crea:

| Tipo | Nombre | Valor | TTL |
|---|---|---|---|
| A | `@` | `44.213.146.211` | 300 |
| A | `www` | `44.213.146.211` | 300 |

Si usas Cloudflare, deja la nube en **gris (solo DNS)** mientras emites el
certificado; después puedes activarla si quieres.

**Comprobar** (desde tu equipo; puede tardar de minutos a unas horas):

```bash
nslookup <tu-dominio>
nslookup www.<tu-dominio>
```

Ambos deben responder `44.213.146.211`.

## 3. nginx con el dominio

En el servidor, edita el sitio de nginx (respalda primero):

```bash
sudo cp /etc/nginx/sites-enabled/default ~/nginx-default.bak.$(date +%s)
sudo nano /etc/nginx/sites-enabled/default
```

El bloque de la app debe quedar así (ajusta el puerto si no es 3000):

```nginx
server {
    listen 80;
    server_name <tu-dominio> www.<tu-dominio>;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# Los QR ya impresos apuntan a la IP: se redirigen al dominio con la misma
# ruta (/t/<tienda>/mesa/<token> sigue funcionando).
server {
    listen 80 default_server;
    server_name 44.213.146.211 _;
    return 301 https://<tu-dominio>$request_uri;
}
```

`X-Forwarded-For $remote_addr` (no `$proxy_add_x_forwarded_for`) importa: los
límites contra fuerza bruta usan esa IP.

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 4. Certificado gratuito (Let's Encrypt)

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <tu-dominio> -d www.<tu-dominio> --redirect
```

Certbot agrega el `listen 443 ssl`, el certificado y la redirección de HTTP a
HTTPS. Se renueva solo; compruébalo:

```bash
sudo certbot renew --dry-run
```

**Comprobar:** `https://<tu-dominio>` abre con candado.

## 5. Variables de la app y recompilar

Las `NEXT_PUBLIC_*` se fijan al compilar, así que hay que **recompilar**:

```bash
cd ~/RESTAURANTE-MIO
cp .env.local .env.local.bak.$(date +%s)
sed -i 's#^NEXT_PUBLIC_SITE_URL=.*#NEXT_PUBLIC_SITE_URL=https://<tu-dominio>#' .env.local
sed -i 's#^NEXT_PUBLIC_ROOT_DOMAIN=.*#NEXT_PUBLIC_ROOT_DOMAIN=<tu-dominio>#' .env.local
grep -E '^NEXT_PUBLIC_(SITE_URL|ROOT_DOMAIN|STORE_SUBDOMAINS)=' .env.local .env.production 2>/dev/null
```

Revisa que `.env.production` no tenga otro valor (si lo tiene, cámbialo igual)
y deja `NEXT_PUBLIC_STORE_SUBDOMAINS=false` salvo que también configures un
certificado comodín (`*.dominio`), que requiere validación por DNS.

```bash
bash scripts/deploy-lightsail.sh
```

El paso "2b. Dirección pública del sitio" verifica que el dominio resuelva a
la IP de la instancia.

## 6. Servicios externos

- **Supabase → Authentication → URL Configuration:** *Site URL*
  `https://<tu-dominio>`; en *Redirect URLs* agrega `https://<tu-dominio>/**`
  (deja la de la IP unos días mientras circulan correos viejos).
- **Google / Microsoft (si están activos):** agrega el dominio a los orígenes
  y URLs de retorno autorizados.
- **Mercado Pago / Wompi:** cambia la URL del webhook a
  `https://<tu-dominio>/api/webhooks/mercadopago` (o `/wompi`).
- **Brevo (opcional, recomendado):** autentica el dominio (SPF y DKIM) para
  que los correos no caigan en spam.

## 7. Comprobar que la geolocalización ya funciona

1. En el celular, abre `https://<tu-dominio>` → elige ubicación → **Usar mi
   ubicación**: el navegador debe **preguntar el permiso** y el mapa se centra
   en tu posición.
2. En un computador, en la consola del navegador:
   `window.isSecureContext` debe dar `true`.
3. En los logs del servidor deja de aparecer
   `geolocation.insecure_context` y no vuelve a aparecer
   `site_url.host_mismatch`.
4. Un QR viejo (`http://44.213.146.211/t/...`) redirige a
   `https://<tu-dominio>/t/...` y abre la mesa.

## Si algo sale mal

- Restaura nginx: `sudo cp ~/nginx-default.bak.<fecha> /etc/nginx/sites-enabled/default && sudo nginx -t && sudo systemctl reload nginx`
- Restaura las variables: `cp .env.local.bak.<fecha> .env.local` y vuelve a
  correr `bash scripts/deploy-lightsail.sh`.
- El certificado puede quedarse instalado; no afecta a la versión por IP.
