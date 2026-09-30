# Estado del despliegue de Alesya en cPanel

Última actualización: 24 de septiembre de 2026, zona horaria `America/Bogota`.

## Objetivo

Publicar la nueva plataforma Next.js de Alesya directamente en Colombia Hosting/cPanel, usando el dominio `alesyaediciones.com`, y retirar WordPress únicamente después de validar la plataforma nueva. Vercel no será el alojamiento final.

## Estado actual

- WordPress continúa funcionando en `https://www.alesyaediciones.com` y todavía no debe modificarse.
- Se creó el subdominio de pruebas `nueva.alesyaediciones.com`.
- El directorio del subdominio es `/home/alesyaed/nueva.alesyaediciones.com`.
- Se creó una aplicación Node.js en cPanel con:
  - Node.js `22.23.2`.
  - Modo `Production`.
  - Raíz de aplicación: `/home/alesyaed/alesya-platform`.
  - URL: `nueva.alesyaediciones.com`.
  - Archivo de inicio: `server.js`.
- La aplicación debe permanecer detenida hasta cargar y verificar el paquete definitivo.

## Paquete que ya está en cPanel

El archivo `alesya-cpanel-2026-09-23.tar.gz` ya fue cargado en `/home/alesyaed/alesya-platform`, pero **no debe extraerse ni ejecutarse**.

Motivo: fue construido en macOS ARM y contiene módulos nativos `darwin-arm64`, incompatibles con el servidor Linux de cPanel.

SHA-256 del paquete rechazado:

```text
59634551bf873aabd6d8cab28744b974458d15c35f6ed713d71cd325d69a2fd8
```

El archivo ZIP anterior también fue rechazado por el antivirus de cPanel con una detección genérica de JavaScript. No se intentó evadir esa protección; se cambió al formato `tar.gz`.

## Auditoría de seguridad realizada

Se completó una auditoría rápida del código y del primer paquete. El informe completo está en:

```text
/Users/andresmunoz/.codex/state/plugins/codex-security/scans/platform/unversioned_20260924T045748Z__fy65_x6/report.md
```

Resultado:

- Dos hallazgos de severidad media:
  1. Los formularios públicos de leads y checkout podían crear registros persistentes sin límite de solicitudes.
  2. En cPanel, cinco intentos fallidos podían bloquear globalmente el acceso administrativo durante quince minutos.
- Un hallazgo de severidad baja:
  - El script de preview para Vercel pasaba secretos en los argumentos del proceso.
- No se encontraron secretos, archivos `.env`, credenciales administrativas ni rutas de extracción peligrosas en el primer `tar.gz`.
- La firma del checkout Wompi, la validación del webhook, el monto, la moneda y las transiciones de pago/inventario no presentaron una vulnerabilidad confirmada.

## Correcciones aplicadas al código

- Se añadió una tabla persistente `rate_limits` y una migración nueva:
  - `drizzle/0001_regular_boomerang.sql`.
- Se añadió un limitador compartido y persistente en `lib/rate-limit.ts`.
- Se protegieron:
  - `POST /api/leads`.
  - `POST /api/checkout`.
  - `POST /api/admin/login`.
- Ya no se usa la clave global `local` para limitar el inicio de sesión.
- En producción, una cabecera de IP ausente o inválida provoca un fallo seguro en lugar de compartir el contador entre todos los usuarios.
- Se añadieron cabeceras HTTP portables desde `next.config.ts`:
  - `X-Content-Type-Options: nosniff`.
  - `X-Frame-Options: DENY`.
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Permissions-Policy` para bloquear cámara, micrófono y geolocalización.
- `scripts/deploy-demo.sh` dejó de incluir los valores secretos en la línea de comandos.
- Se añadió `scripts/cpanel-bootstrap.mjs` para:
  - Crear una base SQLite privada y persistente fuera del directorio público.
  - Aplicar las migraciones antes de iniciar Next.js.
  - Arrancar el servidor standalone.
- En producción cPanel, la base local predeterminada será `~/alesya-data/alesya.db`, salvo que se configure Turso.

## Verificaciones completadas

- `npm run lint`: aprobado, con cinco advertencias preexistentes sobre uso de `<img>`; cero errores.
- `npm run build`: aprobado.
- Migraciones sobre una base SQLite temporal: aprobadas.
- Prueba real del límite de leads:
  - Solicitudes 1–5 desde una IP: `201`.
  - Solicitud 6: `429`.
  - Otra IP continuó funcionando: `201`.
  - Cabecera IP inválida: `503` y ningún registro de negocio nuevo.
- Prueba real del límite de login:
  - Intentos 1–5 desde una IP: `401`.
  - Intento 6: `429`.
  - Otra IP no quedó bloqueada: `401`.
- Las cuatro cabeceras HTTP nuevas aparecen en las respuestas.
- La prueba del script de preview confirmó que ningún valor secreto aparece en `argv`.
- La revisión independiente previa a las correcciones confirmó los tres hallazgos y la estrategia de solución.
- La segunda revisión independiente del parche no pudo ejecutarse por agotamiento temporal de la cuota de la herramienta; se sustituyó por una revisión local de bypasses, cabeceras, migración y comportamiento entre clientes.
- `npm audit --omit=dev`: cero vulnerabilidades conocidas en las 218 dependencias de producción.

## Paquete Linux definitivo

Se construyó dentro de Docker para `linux/amd64`. El primer candidato se conservó solo como evidencia y no debe subirse. El archivo aprobado para staging es:

```text
outputs/alesya-cpanel-linux-x64-final-2026-09-24.tar.gz
SHA-256: 2c58ebfe47bdd965a5639598150783f648b1790cbe2f6b471406df3eb672d506
```

Validación final del archivo exacto:

- No contiene `.demo`, bases `.db`, `.env`, `.local`, credenciales administrativas, Git ni otros outputs.
- Las ocho credenciales configuradas localmente se buscaron por coincidencia exacta: cero coincidencias.
- No contiene rutas absolutas ni recorridos `../`.
- No contiene módulos macOS o Windows.
- Los módulos nativos inspeccionados son ELF Linux x86-64 para `libsql` y `sharp`.
- Arrancó correctamente en un contenedor Linux `amd64` con Node.js 22.
- El bootstrap creó la base, aplicó migraciones e inició Next.js.
- La portada respondió `200`, las cabeceras de seguridad aparecieron y el limitador devolvió `429` en la sexta solicitud.

El paquete está **aprobado para cargar y probar en el subdominio**, no todavía para reemplazar WordPress ni el dominio principal.

## Variables necesarias en cPanel

Los nombres que habrá que configurar en la sección de variables de entorno de la aplicación Node.js son:

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

Los valores secretos no deben escribirse en este documento ni guardarse dentro del paquete.

Antes de activar pagos reales se debe configurar en Wompi:

```text
https://nueva.alesyaediciones.com/api/webhooks/wompi
```

Después del cambio definitivo de dominio, la URL será:

```text
https://www.alesyaediciones.com/api/webhooks/wompi
```

## Próximos pasos

1. Cargar `alesya-cpanel-linux-x64-final-2026-09-24.tar.gz` en `/home/alesyaed/alesya-platform` sin borrar todavía el archivo antiguo.
2. Verificar que cPanel muestre una carga completa y extraer únicamente el archivo final en esa misma carpeta, permitiendo que sustituya el `server.js` provisional creado por cPanel.
3. Configurar las variables de entorno sin revelar sus valores en capturas.
4. Reiniciar la aplicación Node.js y validar `nueva.alesyaediciones.com` de extremo a extremo.
5. Confirmar en el hosting que `x-forwarded-for` llega como una IP válida y saneada; si no, ajustar la cabecera confiable antes de abrir formularios al público.
6. Probar catálogo, leads, administración, checkout, webhook, pedido e inventario.
7. Solo después de aprobar todo, planificar el reemplazo de WordPress en el dominio principal y conservar un respaldo recuperable.

## Regla operativa inmediata

Durante el despliegue de staging:

- No extraer `alesya-cpanel-2026-09-23.tar.gz`.
- Extraer exclusivamente `alesya-cpanel-linux-x64-final-2026-09-24.tar.gz`.
- No iniciar la aplicación Node.js hasta configurar todas las variables de entorno.
- No modificar ni eliminar WordPress.
- No publicar capturas que muestren secretos de Wompi o del administrador.
