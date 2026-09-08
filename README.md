# Votaciones SIPEU

Web interna de votaciones para la **Simulación del Parlamento Europeo en Canarias (SIPEU)**. Los participantes votan en las votaciones de su comisión (o del pleno) y cualquiera puede consultar el estado y los resultados en tiempo real: totales, desglose por grupo parlamentario y voto de cada persona.

Canal principal del evento: [@sipeucan](https://www.instagram.com/sipeucan/).

## Qué incluye

- **Vista pública** (sin iniciar sesión): comisiones, pleno, votaciones con su estado y resultados en directo vía SSE.
- **Resultados** en tres niveles: total, por grupo parlamentario y por persona (nombre, foto, grupo, voto). Voto no secreto.
- **Participantes**: inicio de sesión con correo y contraseña, votación en su comisión y en el pleno, cambio de contraseña, foto de perfil (solo cara), directorio de su comisión.
- **Administración**: usuarios (alta manual, importación CSV con plantilla, restablecer contraseñas con envío por correo, suspender, retirar fotos), comisiones, grupos parlamentarios y votaciones (opciones, abrir/cerrar, permitir cambio de voto, recuento en directo u oculto hasta el cierre, mayoría mínima, máximo de ganadoras).
- Modo oscuro, solo español, sin indexación (`noindex`).

## Stack

- Nuxt 4 + Nitro
- Nuxt UI v4 + Tailwind CSS 4
- PostgreSQL + Drizzle ORM
- `better-auth` (correo + contraseña, plugin `admin`)
- SSE (Server-Sent Events) en proceso para actualizaciones en tiempo real
- `nodemailer` para el envío de credenciales
- `sharp` para las fotos de perfil

## Desarrollo local

```sh
cp .env.example .env   # ajusta valores
pnpm install
docker compose up -d postgres adminer
pnpm db:migrate
pnpm dev
```

Al arrancar, si la base de datos está vacía, se crean automáticamente:

- Comisiones: LIBE, SEDE, ECON, INV.
- Grupos parlamentarios: APE, SD, FPE, RCE, UDL, EV, IFed, SEN.
- Un administrador con `ADMIN_EMAIL` / `ADMIN_PASSWORD` del `.env` (solo si no existe ningún admin).

Sin `SMTP_HOST` configurado, los correos no se envían: en desarrollo se imprimen en la consola del servidor y en el panel se muestra la contraseña generada para copiarla a mano.

Requisitos: Node.js 24+, `pnpm`, Docker y Docker Compose.

## Variables de entorno

| Variable                                                           | Descripción                                                            |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `NUXT_SITE_URL`                                                    | Origen público de la web (ej. `https://sipeu.wupp.dev`)                |
| `APP_SECRET`                                                       | Secreto de sesiones (`openssl rand -base64 32`)                        |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`                                    | Primer administrador, creado al arrancar si no hay ninguno             |
| `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME`                              | Nombre del primer administrador (opcional)                             |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` | Servidor de correo para enviar credenciales                            |
| `MAIL_FROM`                                                        | Remitente, ej. `"Votaciones SIPEU <sipeu@wupp.dev>"`                    |
| `DATABASE_URL`                                                     | Conexión a PostgreSQL                                                  |
| `APP_DATA_DIR`                                                     | Directorio persistente para fotos (`./data` en local, `/app/data` en Docker) |
| `TZ`                                                               | Zona horaria (`Atlantic/Canary`)                                       |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Postgres de Docker Compose                                             |
| `ADMINER_PORT`                                                     | Puerto de Adminer en local                                             |

## Scripts

| Script             | Descripción                                 |
| ------------------ | ------------------------------------------- |
| `pnpm dev`         | Servidor de desarrollo                      |
| `pnpm build`       | Build de producción                         |
| `pnpm lint:fix`    | Lint + fix automático                       |
| `pnpm typecheck`   | Verificación de tipos                       |
| `pnpm db:generate` | Genera migración tras cambiar el esquema    |
| `pnpm db:migrate`  | Aplica migraciones pendientes               |
| `pnpm db:studio`   | Abre Drizzle Studio                         |

## Importación de usuarios por CSV

Descarga la plantilla desde *Usuarios → Importar CSV*. Columnas: `nombre, apellidos, email, comision, grupo, rol`.

- `comision` y `grupo` se resuelven por nombre o siglas (`LIBE`, `APE`…); pueden dejarse vacíos.
- `rol` vacío = participante; `admin` = administración.
- Se valida todo el archivo antes de crear nada; si hay errores se listan por línea y no se importa ningún usuario.
- Se genera una contraseña aleatoria por usuario y, si el interruptor está activo, se envía por correo.

## Despliegue

Build local, push a GHCR y `docker compose` en el VPS con `deploy.sh`. Ver [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Créditos

Desarrollado por [Iván Salido Cobo](https://www.linkedin.com/in/ivansalidocobo/) · [GitHub](https://github.com/ComicIvans/).
