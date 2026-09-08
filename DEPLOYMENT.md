# Votaciones SIPEU — Despliegue

Despliegue recomendado: build local con `deploy.sh`, push a GHCR y actualización remota con `docker compose`.

Archivos de referencia:

- `deploy.sh`
- `docker-compose.production.example.yml`
- `deploy/nginx/sipeu-voto.production.example.conf`

## Requisitos

Local: Docker con Buildx, `git`, `ssh`, sesión abierta con `docker login ghcr.io`.

VPS: Docker Engine + Compose, NGINX, `certbot`.

## Variables locales para `deploy.sh`

```env
VPS_HOST=usuario@servidor
REMOTE_DIR=/opt/sipeu-voto
NUXT_SITE_URL=https://sipeu.wupp.dev
IMAGE_NAME=ghcr.io/comicivans/sipeu-voto
DOCKER_PLATFORM=linux/amd64
APPLY_MIGRATIONS_ON_DEPLOY=true
DEPLOY_IMAGE_RETENTION=2

# Solo si el compose remoto vive fuera de REMOTE_DIR
# COMPOSE_DIR=/ruta/al/compose-raiz
# Solo si los servicios no se llaman app / postgres / nginx
# COMPOSE_APP_SERVICE=app
# COMPOSE_POSTGRES_SERVICE=postgres
# COMPOSE_NGINX_SERVICE=nginx
```

`NUXT_SITE_URL` se inyecta en el build; si en local usas `localhost`, define `NUXT_DEPLOY_SITE_URL=https://sipeu.wupp.dev` y `deploy.sh` la usará solo para construir la imagen.

La imagen se referencia en Compose como `${SIPEU_VOTO_IMAGE:-…}`; `deploy.sh` exporta y persiste `SIPEU_VOTO_IMAGE` en el `.env` remoto para que un `docker compose up -d` posterior no vuelva a `:latest`.

## Preparación del VPS

```bash
mkdir -p /opt/sipeu-voto/data/avatars
sudo chown -R 1000:1000 /opt/sipeu-voto/data
scp docker-compose.production.example.yml usuario@servidor:/opt/sipeu-voto/docker-compose.yml
```

### `.env` de producción

```env
NUXT_SITE_URL=https://sipeu.wupp.dev
TZ=Atlantic/Canary
APP_SECRET=<openssl rand -base64 32>
ADMIN_EMAIL=organizacion@example.com
ADMIN_PASSWORD=<contraseña inicial>
ADMIN_FIRST_NAME=Organización
ADMIN_LAST_NAME=SIPEU

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=sipeu@wupp.dev
SMTP_PASSWORD=<contraseña smtp>
MAIL_FROM="Votaciones SIPEU <sipeu@wupp.dev>"

POSTGRES_USER=sipeu
POSTGRES_PASSWORD=<contraseña>
POSTGRES_DB=sipeu
DATABASE_URL=postgresql://sipeu:<contraseña>@postgres:5432/sipeu?schema=public

APP_PORT=3000
APP_DATA_DIR=./data
```

El primer administrador se crea al arrancar solo si no existe ninguno; después puedes cambiar su contraseña desde el perfil y borrar `ADMIN_PASSWORD` del `.env`.

### NGINX

Usa `deploy/nginx/sipeu-voto.production.example.conf` como base. Imprescindible:

- `X-Forwarded-For $remote_addr`
- `proxy_buffering off` y timeouts largos en `/api/sse/`
- bloquear `/health`
- `client_max_body_size 10m` (fotos de perfil)

```bash
sudo cp sipeu-voto.conf /etc/nginx/sites-available/sipeu-voto
sudo ln -sf /etc/nginx/sites-available/sipeu-voto /etc/nginx/sites-enabled/sipeu-voto
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d sipeu.wupp.dev
```

## Desplegar

```bash
bash ./deploy.sh
```

El script construye la imagen, la publica en GHCR, hace `docker compose pull` del servicio `app`, aplica migraciones, recrea el contenedor, recarga NGINX si es un servicio del mismo Compose y limpia imágenes antiguas.

## Verificar

```bash
docker compose ps
docker compose logs --tail 100 app
curl "http://127.0.0.1:${APP_PORT:-3000}/health"
```

En la web: login del administrador, importar un CSV de prueba, abrir una votación y comprobar que la vista pública se actualiza sin recargar (SSE).

## Errores frecuentes

- **Login falla**: `NUXT_SITE_URL` no coincide con el dominio real (better-auth rechaza el origen).
- **No llegan correos**: revisa `SMTP_*`; sin `SMTP_HOST` la app no envía y muestra las contraseñas en el panel.
- **Fotos desaparecen tras desplegar**: falta el bind mount de `./data` en `/app/data` o los permisos `1000:1000`.
- **La vista pública no se actualiza sola**: NGINX está haciendo buffering de `/api/sse/`.
