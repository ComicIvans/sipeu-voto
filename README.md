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

Para probar el correo en local, `docker compose up -d mailpit` levanta [Mailpit](https://mailpit.axllent.org/) (SMTP en `localhost:1025`, bandeja web en `http://localhost:8025`); el `.env.example` ya apunta ahí.

Requisitos: Node.js 24+, `pnpm`, Docker y Docker Compose.

## Pruebas

| Comando           | Qué hace                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `pnpm test`       | Unitarias (Vitest): reglas de resultado y empates, parser CSV.                                       |
| `pnpm test:smoke` | Extremo a extremo contra un servidor en marcha (`BASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`): autorización, voto concurrente, cierre, bloqueo de condiciones, empates, suspensión, contraseñas. Crea y borra sus propios datos, incluso si falla una comprobación. Con `DATABASE_URL` y servidor local añade dos pruebas que fuerzan una concurrencia imposible de reproducir solo con peticiones. |

Ejecuta el smoke también contra el build de producción antes de desplegar:

```sh
pnpm build
set -a; . ./.env; set +a          # el build no lee .env por sí mismo (en Docker lo inyecta Compose)
NUXT_SITE_URL=http://localhost:3100 PORT=3100 node .output/server/index.mjs &
BASE_URL=http://localhost:3100 pnpm test:smoke
```

`NUXT_SITE_URL` debe coincidir con el origen desde el que se llama: better-auth rechaza (403) los inicios de sesión desde otros orígenes.

## Variables de entorno

Solo `NUXT_SITE_URL` lleva el prefijo `NUXT_`: es la única que entra en `runtimeConfig` de Nuxt (y así se puede sobrescribir en tiempo de ejecución). El resto se leen directamente con `process.env` en el servidor, en `drizzle-kit` y en `ops/migrate.mjs`, que corren fuera de Nuxt, por lo que no deben llevar prefijo.

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

## Reglas de las votaciones

- **Participantes** deben tener comisión y grupo parlamentario; los administradores pueden no tenerlos (entonces solo gestionan). Solo vota quien tiene comisión y no está suspendido.
- **Ámbito**: comisión concreta o Pleno (todas las comisiones). Puede haber varias votaciones abiertas a la vez.
- **Estados**: pendiente (nunca abierta), abierta, finalizada. Reabrir conserva los votos; "Borrar votos" (solo cerrada) vuelve a pendiente; "Duplicar" crea una copia pendiente para repetirla con otras condiciones.
- **Cambio de voto**: desactivado por defecto; se decide por votación y no puede cambiarse una vez abierta.
- **Recuento en directo**: activado por defecto. Si se desactiva, el público solo ve la participación hasta el cierre; los administradores lo ven siempre.
- **Condiciones bloqueadas**: en cuanto hay un voto emitido no se pueden cambiar ámbito, opciones (etiqueta, "puede ganar", altas y bajas), cambio de voto ni reglas de resultado; sí el nombre, la descripción, los colores, el orden y el recuento en directo. **Mientras está abierta** no se toca ninguna opción, tampoco colores ni orden, y no se puede ocultar la votación: ciérrala, cámbiala y vuelve a abrirla, o usa "Duplicar".
- **Cada voto guarda el grupo y la comisión** que tenía la persona al votar; si después se corrige su ficha, los resultados cerrados no cambian.
- **Censo** = personas con derecho a voto ahora + personas que ya votaron. Así la participación nunca supera el 100 % tras una suspensión o un traslado. Se recalcula al leer, así que en una votación cerrada el denominador cambia si después das de alta o suspendes a alguien de esa comisión; los votos y el recuento no cambian nunca.
- **Eliminar usuarios**: no se permite si ya han votado (usa la suspensión). **Eliminar comisiones y grupos**: solo si no tienen miembros y no aparecen en ningún voto emitido, porque cada voto guarda la adscripción con la que se emitió y borrarla reescribiría resultados ya cerrados.
- **Resultado**:
  - Sin mayoría mínima ni máximo: gana la opción más votada entre las que "pueden ganar"; si varias empatan no gana ninguna y se marcan como **Empate**.
  - Con mayoría mínima *N*: ganan todas las opciones con ≥ *N* votos (o ninguna). Eso no es un empate: la regla espera varias ganadoras.
  - Con máximo de *M* ganadoras: ganan las *M* más votadas. Si hay empate justo en el corte, las que están por encima ganan y solo las empatadas quedan pendientes. Las ganadoras y las empatadas se muestran y se exportan por separado; una opción empatada nunca aparece como ganadora.
  - "Puede ganar" desactivado (abstención por defecto): sus votos cuentan en total y participación, pero la opción nunca gana.
  - Ejemplos: A favor 12 / En contra 9 / Abstención 20 → gana A favor. A favor 10 / En contra 10 → empate, sin ganadora. Mínimo 10 con 8/5 → sin ganadora. Alfa 9 / Beta 7 / Gamma 7 con máximo 2 → gana Alfa y quedan Beta y Gamma empatadas por la plaza que falta.

## Imágenes

Los grupos parlamentarios pueden tener **logo** y las comisiones **portada**. El Pleno tiene portada propia aunque no sea una comisión. Todo se gestiona desde administración, en la fila de cada grupo o comisión, y **se aplica al instante**: no hay que guardar el formulario después.

- **Dónde se ven**: la portada, en la tarjeta de la página de inicio y como cabecera de la página de la comisión. El logo, junto al grupo en los resultados por grupo parlamentario. Las insignias compactas siguen siendo color y siglas, sin logo.
- **Sin imagen**: se usa el icono de siempre. Si el archivo falla al cargarse, se ve el icono igual, no una imagen rota.
- **Formatos**: jpg, png, webp, avif y heic, decidido por el contenido real del archivo, no por su extensión. Máximo 8 MB. SVG no se admite. De una imagen animada solo se guarda el primer fotograma.
- **Logos**: mínimo 64 px de lado, no se recortan ni se amplían, y se conserva la transparencia. Súbelos con fondo transparente: se pintan sobre blanco, así que un logo blanco no se vería.
- **Portadas**: mínimo 800 × 450 px y se recortan a 16:9 hacia la zona con más detalle, de modo que el encuadre final puede no ser el de la vista previa.
- Todo se reescribe a WebP, lo que descarta los bytes originales y los metadatos. Los archivos viven junto a las fotos de perfil, así que entran en las copias de seguridad sin hacer nada más.

## Copias de seguridad

```sh
ops/backup.sh                      # ./backups/<fecha>/db.sql.gz + avatars.tar.gz
ops/restore.sh ./backups/<fecha>   # sustituye base de datos e imágenes por la copia
```

Haz copia antes del evento y antes de cualquier operación destructiva (borrar votos, eliminar votaciones). Ver [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Importación de usuarios por CSV

Descarga la plantilla desde *Usuarios → Importar CSV*. Columnas: `nombre, apellidos, email, comision, grupo, rol`.

- `comision` y `grupo` se resuelven por nombre o siglas (`LIBE`, `APE`…); pueden dejarse vacíos.
- `rol` vacío o `participante` = participante (comisión y grupo obligatorios); `admin` = administración. Cualquier otro valor es error.
- Se valida todo el archivo antes de crear nada (máximo 500 filas, 1 MB); si hay errores se listan con su número de línea y no se importa ningún usuario.
- Las cuentas se crean todas en una transacción. Después se envían los correos (si el interruptor está activo) y se informa por fila: enviado, o contraseña a copiar a mano si el envío falló.

## Despliegue

Build local, push a GHCR y `docker compose` en el VPS con `deploy.sh`. Ver [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Créditos

Desarrollado por [Iván Salido Cobo](https://www.linkedin.com/in/ivansalidocobo/) · [GitHub](https://github.com/ComicIvans/).
