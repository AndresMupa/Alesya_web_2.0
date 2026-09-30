# Alesya X Tech — arnés de plataforma

## Objetivo

La plataforma integra la experiencia pública, la operación comercial y el comercio electrónico sobre un mismo modelo de negocio. El código ejecutable vive en `platform/`; los originales audiovisuales permanecen en `Recursos/`.

## Módulos

- **Experiencia pública:** portada, tienda (catálogo, ficha de producto, carrito, checkout) y biblioteca de proyectos.
- **Contenido educativo:** rutas, proyectos, libros, descargas y tecnologías (LEGO EV3, LEGO WeDo, Arduino, impresión 3D y bricolaje).
- **CRM y máquina de ventas:** contactos e instituciones, historial de gestiones, embudo por etapas, agenda de seguimientos, cola de prospección e importación/exportación CSV.
- **Comercio:** catálogo administrable, carrito, pedidos con trazabilidad, inventario por eventos y fotos de producto.
- **Pagos:** adaptador Wompi (Nequi, Botón Bancolombia, PSE, tarjetas) y pagos manuales confirmados por el equipo (transferencia, Nequi directo, efectivo, datáfono). Las claves se guardan exclusivamente como secretos del entorno.
- **Operaciones:** panel `/admin` con una ruta por módulo: Resumen, Máquina de ventas, CRM, Pedidos, Productos e inventario, Integraciones.

## Organización del código (`platform/`)

| Capa | CRM | Comercio | Pagos |
| --- | --- | --- | --- |
| Dominio (`lib/`) | `crm/constants.ts` (etapas, canales, actividades) y `crm/leads.ts` (consultas, gestiones, embudo, agenda, CSV) | `commerce/constants.ts`, `catalog.ts` (tienda y carrito), `products.ts`, `orders.ts`, `inventory.ts`, `cart-store.ts` (carrito del navegador) | `payments/wompi.ts` (firma, webhook, transacciones) |
| API | `app/api/admin/crm/*` | `app/api/admin/commerce/*`, `app/api/store/cart`, `app/api/checkout` | `app/api/webhooks/wompi` |
| Interfaz | `components/admin/crm/*`, `app/admin/(panel)/ventas`, `…/crm` | `components/admin/commerce/*`, `components/store/*`, `app/catalogo`, `app/carrito`, `app/checkout` | — |

Compartido: `lib/format.ts` (moneda, fechas en Bogotá, WhatsApp), `lib/csv.ts`, `lib/http.ts` (errores de dominio y respuestas), `lib/storage.ts` (carpeta de datos y fotos subidas), `lib/admin-auth.ts`, `lib/rate-limit.ts`. Las constantes de cada módulo no importan código de servidor, así que sirven igual en el panel y en las APIs.

## Modelo de datos

La primera migración crea `leads`, `products`, `orders`, `order_items`, `payments`, `inventory_events` y `content_items`; la `0004` añade `lead_activities` (historial del CRM) y `order_events` (trazabilidad del pedido), el valor estimado y motivo de pérdida de las oportunidades, y las banderas `featured`/`backorder` de los productos. Los pagos en línea solo se cierran con el webhook firmado del proveedor, que además valida monto y moneda y es idempotente; la redirección del navegador es informativa. Un pago manual solo lo registra el equipo desde el panel y deja reemplazados (`superseded`) los cobros de Wompi pendientes; si Wompi aprueba después un cobro de un pedido ya pagado o cancelado, queda en revisión. Cada venta aprobada descuenta inventario y cada anulación lo repone, siempre con un evento en `inventory_events`.

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
8. Definir roles del panel y separar el acceso administrativo antes de hacer pública la web.
