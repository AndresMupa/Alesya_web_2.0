# Alesya X Tech — arnés de plataforma

## Objetivo

La plataforma integra la experiencia pública, la operación comercial y el comercio electrónico sobre un mismo modelo de negocio. El código ejecutable vive en `platform/`; los originales audiovisuales permanecen en `Recursos/`.

## Módulos

- **Experiencia pública:** portada, catálogo y biblioteca de proyectos.
- **Contenido educativo:** rutas, proyectos, libros, descargas y tecnologías (LEGO EV3, LEGO WeDo, Arduino, impresión 3D y bricolaje).
- **CRM:** formularios, contactos, instituciones, etapas y responsables.
- **Comercio:** productos, pedidos, inventario, clientes y trazabilidad.
- **Pagos:** adaptador Wompi para Nequi, Botón Bancolombia, PSE y tarjetas. Las claves se guardan exclusivamente como secretos del entorno.
- **Operaciones:** tablero único para ventas, oportunidades, pedidos, inventario, contenido y marketing.

## Modelo de datos

La primera migración crea `leads`, `products`, `orders`, `order_items`, `payments`, `inventory_events` y `content_items`. Los estados de pago solo se cierran con el webhook firmado del proveedor, que además valida monto y moneda y es idempotente; la redirección del navegador es informativa. Cada venta aprobada descuenta inventario y cada anulación lo repone, siempre con un evento en `inventory_events`.

## Escalabilidad

1. Catálogo y contenido comparten identificadores estables y rutas públicas.
2. Pedidos y pagos están separados para admitir reintentos, varios proveedores y conciliación.
3. Inventario usa eventos, lo que permite auditoría y futuras bodegas.
4. El contenido se separa del comercio para publicar proyectos sin convertirlos en productos.
5. La capa de pago está aislada: cambiar o añadir proveedor no exige reescribir la tienda.

## Puesta en producción

1. Crear la base de datos en Turso, configurar `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` en Vercel y ejecutar `npm run db:migrate` contra ella.
2. Configurar `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` y `ADMIN_SESSION_SECRET` en Vercel (generados con `npm run admin:setup`).
3. Crear y validar el comercio en Wompi.
4. Configurar `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET` y `WOMPI_EVENTS_SECRET` como secretos.
5. Registrar `/api/webhooks/wompi` como URL de eventos en sandbox y producción.
6. Ejecutar compras de prueba aprobadas, rechazadas y abandonadas.
7. Importar productos, clientes y pedidos vigentes de WooCommerce.
8. Definir roles del panel y separar el acceso administrativo antes de hacer pública la web.
