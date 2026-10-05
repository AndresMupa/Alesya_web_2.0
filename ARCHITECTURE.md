# Alesya X Tech — arnés de plataforma

## Objetivo

La plataforma integra la experiencia pública, la operación comercial y el comercio electrónico sobre un mismo modelo de negocio. El código ejecutable vive en `platform/`; los originales audiovisuales permanecen en `Recursos/`.

## Módulos

- **Experiencia pública:** portada, tienda (catálogo, ficha de producto, carrito, checkout) y biblioteca de proyectos.
- **Contenido educativo:** rutas, proyectos, libros, descargas y tecnologías (LEGO EV3, LEGO WeDo, Arduino, impresión 3D y bricolaje).
- **CRM y máquina de ventas:** contactos e instituciones, historial de gestiones, embudo por etapas, agenda de seguimientos, cola de prospección e importación/exportación CSV.
- **Comercio:** catálogo administrable, carrito, pedidos con trazabilidad, inventario por eventos y fotos de producto.
- **Pagos:** adaptador Wompi (Nequi, Botón Bancolombia, PSE, tarjetas) y pagos manuales confirmados por el equipo (transferencia, Nequi directo, efectivo, datáfono). Las claves se guardan exclusivamente como secretos del entorno.
- **Portada editable:** la página de inicio se compone de bloques guardados como un documento JSON (`lib/pages/home-schema.ts`: esquema, valores por defecto y catálogo de bloques). El panel edita un borrador, lo previsualiza y lo publica; cada publicación deja una versión recuperable. Imágenes y videos se suben a la carpeta privada de datos y se sirven desde `/uploads`.
- **SEO y dominio:** `lib/site.ts` define el dominio canónico (`PRODUCTION_URL`) y la identidad pública; `lib/seo.ts` arma los metadatos de cada página; `app/sitemap.ts`, `app/robots.ts` y `app/manifest.ts` los archivos para buscadores; `proxy.ts` unifica el dominio con `CANONICAL_REDIRECT=1`; `next.config.ts` redirige las direcciones del WordPress anterior. Las páginas legales viven en `lib/legal.ts`.
- **Operaciones:** panel `/admin` con una ruta por módulo: Resumen, Portada, Máquina de ventas, CRM, Pedidos, Productos e inventario, Configuración, Integraciones.

## Organización del código (`platform/`)

| Capa | CRM | Comercio | Pagos |
| --- | --- | --- | --- |
| Dominio (`lib/`) | `crm/constants.ts` (etapas, canales, actividades) y `crm/leads.ts` (consultas, gestiones, embudo, agenda, CSV) | `commerce/constants.ts`, `catalog.ts` (tienda y carrito), `products.ts`, `orders.ts`, `inventory.ts`, `cart-store.ts` (carrito del navegador) | `payments/wompi.ts` (firma, webhook, transacciones) |
| API | `app/api/admin/crm/*` | `app/api/admin/commerce/*`, `app/api/store/cart`, `app/api/checkout` | `app/api/webhooks/wompi` |
| Interfaz | `components/admin/crm/*`, `app/admin/(panel)/ventas`, `…/crm` | `components/admin/commerce/*`, `components/store/*`, `app/catalogo`, `app/carrito`, `app/checkout` | — |

Portada editable: dominio en `lib/pages/home-schema.ts` (documento, validación y diseño original, compartido con el navegador) y `lib/pages/home.ts` (borrador, publicación, versiones); medios en `lib/media.ts`; API en `app/api/admin/pages/home` y `app/api/admin/media`; interfaz en `components/home/*` (dibuja el documento en `app/page.tsx`) y `components/admin/pages/*` (editor en `app/admin/(panel)/portada`).

Compartido: `lib/format.ts` (moneda, fechas en Bogotá, WhatsApp), `lib/csv.ts`, `lib/http.ts` (errores de dominio y respuestas), `lib/storage.ts` (carpeta de datos y fotos subidas), `lib/admin-auth.ts`, `lib/rate-limit.ts`. Las constantes de cada módulo no importan código de servidor, así que sirven igual en el panel y en las APIs.

## Modelo de datos

La primera migración crea `leads`, `products`, `orders`, `order_items`, `payments`, `inventory_events` y `content_items`; la `0004` añade `lead_activities` (historial del CRM) y `order_events` (trazabilidad del pedido), el valor estimado y motivo de pérdida de las oportunidades, y las banderas `featured`/`backorder` de los productos; la `0007` añade `pages` (borrador y versión publicada de la portada como JSON) y `page_revisions` (historial de publicaciones). Los pagos en línea solo se cierran con el webhook firmado del proveedor, que además valida monto y moneda y es idempotente; la redirección del navegador es informativa. Un pago manual solo lo registra el equipo desde el panel y deja reemplazados (`superseded`) los cobros de Wompi pendientes; si Wompi aprueba después un cobro de un pedido ya pagado o cancelado, queda en revisión. Cada venta aprobada descuenta inventario y cada anulación lo repone, siempre con un evento en `inventory_events`.

## Escalabilidad

1. Catálogo y contenido comparten identificadores estables y rutas públicas.
2. Pedidos y pagos están separados para admitir reintentos, varios proveedores y conciliación.
3. Inventario usa eventos, lo que permite auditoría y futuras bodegas.
4. El contenido se separa del comercio para publicar proyectos sin convertirlos en productos.
5. La capa de pago está aislada: cambiar o añadir proveedor no exige reescribir la tienda.

## Puesta en producción

El alojamiento definitivo es cPanel; el procedimiento vigente está en [`platform/DEPLOYMENT_STATUS.md`](platform/DEPLOYMENT_STATUS.md). Pasos pendientes de negocio:

1. Cargar en producción el inventario y la base de colegios desde el panel (ver "Carga inicial de datos" en `DEPLOYMENT_STATUS.md`).
2. Configurar `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` y `ADMIN_SESSION_SECRET` (generados con `npm run admin:setup -- --production`).
3. Crear y validar el comercio en Wompi.
4. Configurar `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET` y `WOMPI_EVENTS_SECRET` como secretos.
5. Registrar `/api/webhooks/wompi` como URL de eventos en sandbox y producción.
6. Ejecutar compras de prueba aprobadas, rechazadas y abandonadas.
7. Importar productos, clientes y pedidos vigentes de WooCommerce.
8. Definir roles del panel. El enlace público "Administrar" ya se quitó: el equipo entra por `/admin`.
9. Revisar los textos legales y pasar al dominio principal (ver "Cambio al dominio principal" en `DEPLOYMENT_STATUS.md`).
