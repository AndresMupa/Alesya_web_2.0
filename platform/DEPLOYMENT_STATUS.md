# Estado del despliegue de Alesya en cPanel

Última actualización: 4 de octubre de 2026, zona horaria `America/Bogota`.

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

1. `npm run lint`, las pruebas del despliegue y `npm run build` (`.github/workflows/ci.yml`).
2. `npm run package:cpanel`: paquete Linux x86-64 construido en Docker, validado (sin secretos, bases de datos, `.env` ni binarios de otra arquitectura) y con smoke test.
3. **Autoprueba en el servidor:** sube, renombra, lee y borra una carpeta temporal para confirmar que la API se comporta como se espera, sin tocar la app.
4. Se sube un único `.tar.gz` con la API de cPanel (`Fileman::upload_files`) a `/home/alesyaed/alesya-platform.release-<commit>`, cPanel lo extrae (`Fileman::fileop extract`) y se verifica que su `BUILD_ID` sea el del build.
5. Se intercambian carpetas con dos renombrados: la versión anterior queda en `/home/alesyaed/alesya-platform.previous`. Si el segundo renombrado falla, se restaura la anterior en el acto.
6. `tmp/restart.txt` reinicia la aplicación; `bootstrap.mjs` aplica las migraciones pendientes al arrancar.
7. Chequeo de salud: el sitio debe servir un archivo estático que solo existe en el build nuevo. **Si falla, el workflow vuelve solo a la versión anterior** (la que falló queda en `alesya-platform.failed-<commit>` para revisarla).

Duración típica: unos 3 minutos. Si algo falla antes del intercambio de carpetas, producción no cambia.

La cuenta de cPanel no tiene acceso a shell y, desde el 4 de octubre de 2026, el hosting corta las conexiones SFTP que vienen de GitHub. Por eso todo el despliegue va por HTTPS con la API de cPanel (`.github/scripts/cpanel-deploy.mjs`), usando solo funciones disponibles desde cPanel 11.44. Cada paso se comprueba leyendo el estado real del servidor. El script se prueba en cada PR contra un cPanel simulado (`.github/scripts/cpanel-deploy.test.mjs`): éxito, firewall que bloquea, token inválido, renombrado con otra semántica, extracción incompleta, fallo al activar, borrado que no borra y vuelta atrás.

### Flujo de trabajo

La rama `main-rzbi9x` está protegida por el ruleset `produccion`: no admite push directo, force push ni borrado. Todo cambio entra por pull request y solo se puede fusionar cuando el check `Lint y build` pasa.

```sh
git switch -c nombre-del-cambio
git push -u origin nombre-del-cambio
gh pr create --fill --base main-rzbi9x
```

### Volver a la versión anterior

El workflow lo hace solo cuando el chequeo de salud falla. A mano, desde el Administrador de archivos de cPanel: renombrar `alesya-platform` a otro nombre, renombrar `alesya-platform.previous` a `alesya-platform` y pulsar **Restart** en "Setup Node.js App". Las migraciones ya aplicadas no se revierten.

### Configuración en GitHub

Entorno `production` (Settings → Environments), limitado a la rama `main-rzbi9x`:

| Nombre | Tipo | Uso |
| --- | --- | --- |
| `CPANEL_API_TOKEN` | Secret | Token de cPanel → Manage API Tokens (`github_deploy`). Obligatorio. |
| `CPANEL_SSH_USER` | Secret | Usuario de la cuenta de cPanel (`alesyaed`), para autenticar la API. Si se crea `CPANEL_USER`, se usa ese. |
| `CPANEL_APP_DIR` | Secret | `/home/alesyaed/alesya-platform`. |
| `CPANEL_API_URL` | Variable | `https://alesyaediciones.com:2083` (la IP no sirve: el certificado no coincide). |
| `PRODUCTION_URL` | Variable | `https://nueva.alesyaediciones.com`. |

Los secrets `CPANEL_SSH_HOST`, `CPANEL_SSH_PORT`, `CPANEL_SSH_KEY` y `CPANEL_SSH_KNOWN_HOSTS` ya no se usan desde que el despliegue va solo por la API. Cuando un despliegue por API haya funcionado se pueden borrar, junto con la clave SSH `github_deploy` en cPanel → Acceso a SSH (no confundir con el token de API del mismo nombre, que sí se usa).

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
PRODUCTION_URL=https://nueva.alesyaediciones.com
SMTP_HOST=mail.alesyaediciones.com
SMTP_PORT=465
SMTP_USER=comercial@alesyaediciones.com
SMTP_PASS
MAIL_FROM=Alesya X-Tech <comercial@alesyaediciones.com>
# Solo al pasar al dominio principal (ver "Cambio al dominio principal"):
# CANONICAL_REDIRECT=1
```

`PRODUCTION_URL` es el dominio canónico del sitio: de ahí salen los enlaces canónicos, el sitemap, `robots.txt`, los datos estructurados para Google, los enlaces de los correos y la URL de regreso de Wompi. `robots.txt` solo permite rastrear ese dominio; cualquier otro nombre que sirva la app pide no indexar. Con `CANONICAL_REDIRECT=1` toda visita por otro nombre (sin www, `nueva.`) se redirige de forma permanente a `PRODUCTION_URL` (no afecta `/api`).

### Resumen diario del CRM (cron)

Con `CRON_SECRET` definido (una cadena aleatoria de al menos 16 caracteres, p. ej. `openssl rand -hex 24`), en cPanel → **Trabajos de cron** crear uno diario (por ejemplo 7:00) con:

```sh
wget -q -O /dev/null "https://nueva.alesyaediciones.com/api/cron/daily?token=EL_SECRETO"
```

Envía al correo de avisos (`/admin/configuracion`) los seguimientos del día, entrantes sin atender, oportunidades sin siguiente acción y cotizaciones por vencer. Requiere el correo SMTP configurado; sin él responde con el resumen en JSON pero no envía nada.

Las variables `SMTP_*` y `MAIL_FROM` activan el correo transaccional (pedido recibido, pago confirmado, envío y avisos al equipo). Se obtienen en cPanel → **Cuentas de correo** → *Connect Devices* de la cuenta que enviará; sin ellas la tienda funciona igual pero no envía correos (Integraciones lo indica). Después de pegarlas, **Restart** y probar con **Configuración → Enviar correo de prueba**.

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

## Cambio al dominio principal (www.alesyaediciones.com)

El código ya está listo para servir el dominio principal: páginas legales con las mismas direcciones que WordPress, redirecciones permanentes de las demás direcciones de WordPress (`next.config.ts`), sitemap, `robots.txt`, datos estructurados y redirección opcional a un dominio único. Lo que falta son pasos de operación en cPanel, GitHub y Wompi.

### Antes del cambio

1. **Revisar los textos legales** (`/politica-de-privacidad`, `/politica-de-reembolsos-y-devoluciones`, `/aviso-legal`, contenido en `lib/legal.ts`) con quien lleve lo legal o contable: razón social, dirección y plazos.
2. **Contenido:** productos con precio y foto, base de colegios importada y la portada publicada desde `/admin/portada`.
3. **Pruebas de extremo a extremo** en `nueva.`: formulario de colegios, compra con Wompi (aprobada, rechazada y abandonada), pago manual, correo de prueba y rastreo de pedido.
4. Confirmar que `x-forwarded-for` llega como una IP válida y saneada (si no, los formularios fallan de forma segura).
5. Elegir una hora de poco tráfico. El cambio toma unos 30 minutos.

### El cambio

1. **Respaldo de WordPress:** cPanel → *Copia de seguridad* → descargar la copia de la carpeta de inicio y la de la base de datos MySQL de WordPress. Guardarlas fuera del servidor.
2. **Sacar WordPress de la raíz sin borrarlo:** crear la carpeta `/home/alesyaed/wordpress-antiguo` y mover allí todo el contenido de `public_html` (incluido `.htaccess`). Si se quiere seguir consultando, crear el subdominio `antiguo.alesyaediciones.com` apuntando a esa carpeta y, en WordPress, *Ajustes → Lectura → Disuadir a los motores de búsqueda*.
3. **Mover la app:** *Setup Node.js App* → editar la aplicación → *Application URL* = `alesyaediciones.com` (sin ruta). La raíz de la aplicación y `ALESYA_DATA_DIR` no cambian, así que la base de datos y las fotos subidas siguen igual.
4. **Variables de la app:** `PRODUCTION_URL=https://www.alesyaediciones.com` y `CANONICAL_REDIRECT=1`. Guardar y pulsar **Restart**.
5. **`nueva.` hacia el dominio principal:** cPanel → *Dominios → Redirecciones* → permanente (301) de `nueva.alesyaediciones.com` a `https://www.alesyaediciones.com/`, con la opción de redirigir con comodín para conservar la ruta.
6. **SSL:** cPanel → *SSL/TLS Status* → confirmar (o ejecutar AutoSSL) para `alesyaediciones.com` y `www.alesyaediciones.com`.
7. **GitHub:** variable `PRODUCTION_URL` del entorno `production` = `https://www.alesyaediciones.com` (la usa el chequeo de salud del despliegue).
8. **Wompi:** URL de eventos = `https://www.alesyaediciones.com/api/webhooks/wompi`, en sandbox y en producción.
9. **Cron del resumen diario:** cambiar la URL a `https://www.alesyaediciones.com/api/cron/daily?token=…`.

### Verificación

- `https://www.alesyaediciones.com` carga la tienda nueva; `https://alesyaediciones.com/colegios` y `https://nueva.alesyaediciones.com/colegios` redirigen a `https://www.alesyaediciones.com/colegios`.
- `/robots.txt` muestra `Allow: /` y `Sitemap: https://www.alesyaediciones.com/sitemap.xml`; `/sitemap.xml` lista páginas, categorías y productos con `www`.
- Direcciones viejas: `/shop/` → `/catalogo`, `/contacto/` → `/colegios#diagnostico`, `/product/robotica-educativa-modulo-2/` → `/catalogo` (todas en un salto, 308).
- Una compra de prueba vuelve a `www` después de Wompi y el correo de confirmación enlaza a `www`.
- **Google Search Console:** verificar la propiedad de dominio `alesyaediciones.com` (registro TXT en la zona DNS), enviar `https://www.alesyaediciones.com/sitemap.xml` e inspeccionar la portada. Como el dominio es el mismo no hace falta el "cambio de dirección". Actualizar también el sitio web en Google Business Profile y en las redes.

### Volver atrás

*Setup Node.js App* → *Application URL* de nuevo en `nueva.alesyaediciones.com`, devolver el contenido de `/home/alesyaed/wordpress-antiguo` a `public_html`, quitar la redirección de `nueva.`, restaurar `PRODUCTION_URL=https://nueva.alesyaediciones.com`, borrar `CANONICAL_REDIRECT` y **Restart**.

### Lo que no se migra de WordPress

Las cuentas de clientes y cursos (WooCommerce, LearnPress), los pedidos antiguos y las fotos en `/wp-content/uploads` no pasan al sitio nuevo; esas direcciones darán 404 (las de cuentas redirigen a `/pedido`). Las páginas de literatura, grados, módulos escolares, área de inglés y galería estaban vacías o eran plantilla y redirigen a la tienda (*Libros*) o a la portada. Los cuatro "Módulos de Robótica Educativa" de WordPress (95.000 COP) no existen en el catálogo nuevo: crearlos en `/admin/productos` si se siguen vendiendo.

## Próximos pasos

1. Completar "Antes del cambio" y ejecutar "Cambio al dominio principal".
2. Después del cambio, revisar en Search Console durante dos semanas la cobertura y los errores 404.

## Reglas operativas

- No eliminar WordPress: en el cambio de dominio se mueve a `/home/alesyaed/wordpress-antiguo` con su respaldo descargado.
- No publicar capturas que muestren secretos de Wompi o del administrador.
- No subir a mano paquetes a `alesya-platform`: todo cambio pasa por pull request y el despliegue automático.
