# Estado del despliegue de Alesya en cPanel

Última actualización: 30 de septiembre de 2026, zona horaria `America/Bogota`.

## Objetivo

Publicar la nueva plataforma Next.js de Alesya directamente en Colombia Hosting/cPanel, usando el dominio `alesyaediciones.com`, y retirar WordPress únicamente después de validar la plataforma nueva. Vercel no será el alojamiento final.

## Estado actual

- La plataforma está publicada y funcionando en `https://nueva.alesyaediciones.com`, con acceso a `/admin` verificado.
- WordPress continúa funcionando en `https://www.alesyaediciones.com` y todavía no debe modificarse.
- Aplicación Node.js en cPanel ("Setup Node.js App"):
  - Node.js `22.23.2`, modo `Production`.
  - Raíz de aplicación: `/home/alesyaed/alesya-platform`.
  - URL: `nueva.alesyaediciones.com`.
  - Archivo de inicio: `server.js`.
- Base SQLite persistente en `/home/alesyaed/alesya-data/alesya.db`, fuera de la raíz de la aplicación: los despliegues no la tocan.

## Despliegue automático

Cada merge a la rama `main-rzbi9x` se publica solo mediante GitHub Actions (`.github/workflows/deploy.yml`):

1. `npm run lint` y `npm run build` (`.github/workflows/ci.yml`).
2. `npm run package:cpanel`: paquete Linux x86-64 construido en Docker, validado (sin secretos, bases de datos, `.env` ni binarios de otra arquitectura) y con smoke test.
3. Se sube un único `.tar.gz` por SFTP y la API de cPanel (`Fileman::fileop extract`) lo extrae en `/home/alesyaed/alesya-platform.release-<commit>`.
4. Se intercambian carpetas: la versión anterior queda en `/home/alesyaed/alesya-platform.previous`.
5. `tmp/restart.txt` reinicia la aplicación; `bootstrap.mjs` aplica las migraciones pendientes al arrancar.
6. Chequeo de salud: el sitio debe servir un archivo estático que solo existe en el build nuevo.

Duración típica: unos 3 minutos. Si algo falla antes del intercambio de carpetas, producción no cambia.

La cuenta de cPanel no tiene acceso a shell; todo el despliegue usa SFTP (una sola conexión, el hosting rechaza sesiones simultáneas) y la API de cPanel. Sin el token de API, el workflow sube los archivos uno a uno (unos 10 minutos).

### Flujo de trabajo

La rama `main-rzbi9x` está protegida por el ruleset `produccion`: no admite push directo, force push ni borrado. Todo cambio entra por pull request y solo se puede fusionar cuando el check `Lint y build` pasa.

```sh
git switch -c nombre-del-cambio
git push -u origin nombre-del-cambio
gh pr create --fill --base main-rzbi9x
```

### Volver a la versión anterior

Desde el Administrador de archivos de cPanel: renombrar `alesya-platform` a otro nombre, renombrar `alesya-platform.previous` a `alesya-platform` y pulsar **Restart** en "Setup Node.js App". Las migraciones ya aplicadas no se revierten.

### Configuración en GitHub

Entorno `production` (Settings → Environments), limitado a la rama `main-rzbi9x`:

| Nombre | Tipo | Uso |
| --- | --- | --- |
| `CPANEL_SSH_HOST`, `CPANEL_SSH_PORT`, `CPANEL_SSH_USER` | Secret | Conexión SFTP. |
| `CPANEL_SSH_KEY` | Secret | Clave privada autorizada en cPanel → Acceso a SSH (`github_deploy`). |
| `CPANEL_SSH_KNOWN_HOSTS` | Secret | Claves públicas del servidor (`ssh-keyscan -p 22 195.250.27.40`). |
| `CPANEL_APP_DIR` | Secret | `/home/alesyaed/alesya-platform`. |
| `CPANEL_API_TOKEN` | Secret | Token de cPanel → Manage API Tokens (`github_deploy`). |
| `CPANEL_API_URL` | Variable | `https://alesyaediciones.com:2083` (la IP no sirve: el certificado no coincide). |
| `PRODUCTION_URL` | Variable | `https://nueva.alesyaediciones.com`. |

Al cargar desde Git Bash un valor que empieza por `/`, usar `MSYS_NO_PATHCONV=1 gh secret set …`; si no, Git Bash lo convierte en una ruta de Windows.

## Variables de la aplicación en cPanel

Se configuran en "Setup Node.js App" (no en GitHub ni en el paquete):

```text
NODE_ENV=production
TRUSTED_PROXY_IP_HEADER=x-forwarded-for
ALESYA_DATA_DIR=/home/alesyaed/alesya-data
ADMIN_EMAIL
ADMIN_PASSWORD_HASH
ADMIN_SESSION_SECRET
WOMPI_PUBLIC_KEY
WOMPI_INTEGRITY_SECRET
WOMPI_EVENTS_SECRET
```

Las credenciales de `/admin` se generan con `npm run admin:setup -- --production --force correo@dominio.co` (quedan en `.local/admin-cpanel.txt`); después de pegarlas hay que pulsar **Restart**. Los valores secretos no deben escribirse en este documento.

Antes de activar pagos reales se debe configurar en Wompi:

```text
https://nueva.alesyaediciones.com/api/webhooks/wompi
```

Después del cambio definitivo de dominio, la URL será:

```text
https://www.alesyaediciones.com/api/webhooks/wompi
```

## Auditoría de seguridad (24 de septiembre de 2026)

- Dos hallazgos de severidad media, corregidos:
  1. Los formularios públicos de leads y checkout podían crear registros persistentes sin límite de solicitudes.
  2. En cPanel, cinco intentos fallidos podían bloquear globalmente el acceso administrativo durante quince minutos.
- Un hallazgo de severidad baja, corregido: el script de preview para Vercel pasaba secretos en los argumentos del proceso.
- La firma del checkout Wompi, la validación del webhook, el monto, la moneda y las transiciones de pago/inventario no presentaron una vulnerabilidad confirmada.

Correcciones: tabla persistente `rate_limits` (migración `0001_regular_boomerang.sql`) y limitador compartido en `lib/rate-limit.ts` para `POST /api/leads`, `POST /api/checkout` y `POST /api/admin/login`; en producción, una cabecera de IP ausente o inválida falla de forma segura; cabeceras HTTP de seguridad desde `next.config.ts`.

## Carga inicial de datos en producción

La base de producción (`/home/alesyaed/alesya-data/alesya.db`) es independiente de la local: el inventario y la base de colegios no viajan con el despliegue. Sin shell en cPanel, se cargan desde el panel, una sola vez, después de desplegar la migración `0004`:

1. **Productos:** `/admin/productos` → **Importar CSV** → `inventario-alesya.csv` (raíz del repositorio). Crea los 65 productos con stock inicial, descripción y foto (`/media/productos/…`, incluidas en el despliegue). Responder *Cancelar* a la pregunta de conteo físico. Quedan en borrador hasta tener precio: asignarlo en la vista **Tabla · Sin precio** los publica.
2. **Colegios:** `/admin/crm` → **Importar CSV** → el archivo exportado de la base local (`platform/.local/produccion/colegios-2026.csv`, o **Exportar CSV** en el CRM local). Crea los 2.435 colegios; repetir la importación no duplica. Ese archivo tiene datos personales: no se sube al repositorio.

Probado en una instalación vacía con el servidor standalone: 65 productos (62 con foto) y 2.435 colegios; una segunda importación crea cero.

La migración `0004` también pasa a la tabla `products` los cuatro destacados que antes estaban fijos en el código (conservan su slug, se venden bajo pedido y se pueden despublicar desde el panel).

## Próximos pasos

1. Confirmar en el hosting que `x-forwarded-for` llega como una IP válida y saneada antes de abrir formularios al público.
2. Probar catálogo, leads, administración, checkout, webhook, pedido e inventario de extremo a extremo.
3. Solo después de aprobar todo, planificar el reemplazo de WordPress en el dominio principal y conservar un respaldo recuperable.

## Reglas operativas

- No modificar ni eliminar WordPress.
- No publicar capturas que muestren secretos de Wompi o del administrador.
- No subir a mano paquetes a `alesya-platform`: todo cambio pasa por pull request y el despliegue automático.
