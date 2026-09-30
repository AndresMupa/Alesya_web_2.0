# Alesya X Tech — plataforma

Sitio público, tienda, CRM y centro de operaciones de Alesya. Next.js 16 (App Router) desplegado en cPanel (servidor standalone), con base de datos SQLite/libSQL vía Drizzle y pagos con Wompi. La arquitectura general está en [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

## Desarrollo local

Requiere Node.js `>=22.13.0`.

```sh
npm ci
npm run db:migrate                          # crea .local/alesya.db con las migraciones
npm run admin:setup -- tu-correo@dominio.co # solo la primera vez; la contraseña queda en .local/admin-access.txt
npm run dev                                 # http://127.0.0.1:5173
```

Sin `TURSO_DATABASE_URL` la app usa el archivo local `.local/alesya.db`. En Vercel es obligatorio un Turso persistente: `db/index.ts` se niega a arrancar con un archivo local.

Para probar la compilación de producción en local:

```sh
npm run build   # genera .next/standalone y copia .next/static y public/
npm start       # http://localhost:3000 (usa HOSTNAME y PORT para cambiarlo)
```

`npm start` carga `.env.local`, aplica las migraciones pendientes y arranca el servidor standalone; si falta la compilación, pide ejecutar `npm run build`. Sin `TURSO_DATABASE_URL` ni `ALESYA_DATA_DIR` usa la misma base `.local/alesya.db` del desarrollo; define `ALESYA_DATA_DIR` para usar otra carpeta (se crea si no existe).

Para cPanel, genera credenciales de administración propias sin tocar `.env.local`:

```sh
npm run admin:setup -- --production correo@dominio.co
```

El correo, la contraseña y las líneas `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` y `ADMIN_SESSION_SECRET` listas para pegar quedan en `.local/admin-cpanel.txt`; nada se imprime en la terminal. Si el archivo ya existe no se sobrescribe; añade `--force` para regenerarlo.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Base de datos persistente (producción). |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET` | Acceso al panel `/admin`. Se generan con `npm run admin:setup`. |
| `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET` | Firma del checkout. Sin ellas el pedido se registra pero no se abre el cobro. |
| `WOMPI_EVENTS_SECRET` | Verificación de la firma del webhook `/api/webhooks/wompi`. |
| `ALESYA_DATA_DIR` | Carpeta privada para SQLite en cPanel; por defecto `~/alesya-data` (con `npm start` en local, `.local`). |
| `TRUSTED_PROXY_IP_HEADER` | Cabecera de IP saneada por el proxy. En cPanel: `x-forwarded-for`. |

Todas son secretos: configúralas en Vercel y en `.env.local`, nunca en el repositorio.

En cPanel, el arranque seguro crea/aplica las migraciones antes de iniciar Next.js y
guarda SQLite fuera del directorio público. El proxy debe sobrescribir
`x-forwarded-for`; si la cabecera configurada falta o no contiene una IP válida, los
endpoints con escritura y el acceso administrativo fallan de forma segura.

## Flujo de pedido y pago

1. La tienda (`/catalogo`, `/catalogo/<slug>`) solo muestra productos **publicados y con precio**. El carrito vive en el navegador (`localStorage`) y guarda slugs y cantidades; `/api/store/cart` recalcula precio y disponibilidad en cada cambio.
2. `/checkout` crea el pedido (`payment_pending`), sus ítems, un pago `pending` y el evento `created`. Precio y stock salen de la base: si una línea supera el stock (y el producto no se vende bajo pedido) el pedido se rechaza con un mensaje para el cliente. Los enlaces antiguos `/checkout?producto=<slug>` agregan ese producto al carrito.
3. **Con Wompi configurado**, el cliente va al checkout firmado de Wompi y solo el webhook `/api/webhooks/wompi` cambia el estado del pago:
   - `APPROVED` → pedido `paid` y se descuenta inventario (evento `sale`), si el monto y la moneda coinciden; si no, queda `payment_review`.
   - `DECLINED` / `ERROR` → `payment_declined` / `payment_error`.
   - `VOIDED` de un pago aprobado → `payment_voided` y se repone el inventario.
   - Los eventos repetidos o fuera de orden se ignoran; un pago aprobado no retrocede. Un cobro aprobado de un pedido ya pagado a mano o cancelado queda en revisión.
4. **Sin Wompi**, el pedido queda registrado y la página de resultado ofrece WhatsApp para coordinar el pago. El equipo lo confirma en `/admin/pedidos` → **Registrar pago recibido** (transferencia, Nequi directo, efectivo o datáfono): el pedido pasa a `paid`, se descuenta inventario y el pago Wompi pendiente queda `superseded`.
5. `/checkout/resultado` muestra el estado real, los productos y el total (nunca datos de contacto).
6. En el panel el equipo avanza la preparación: `paid → preparing → shipped (con guía opcional) → delivered`, o cancela pedidos sin pagar. Cada paso queda en `order_events`.

El envío se coordina después del pago (`SHIPPING_IN_CENTS = 0` en `lib/commerce/orders.ts`).

## Panel de operaciones (`/admin`)

Cada módulo tiene su ruta; todas exigen sesión:

- **Resumen** (`/admin`): ventas del mes, embudo abierto, pedidos por preparar, productos sin precio o con stock bajo, seguimientos y actividad reciente.
- **Máquina de ventas** (`/admin/ventas`): métricas (embudo abierto, ganado en el mes, tasa de cierre, seguimientos vencidos, entrantes sin atender), agenda de seguimientos, cola de prospección de la base de colegios, tablero por etapas con arrastrar y soltar (al pasar a *Perdido* pide el motivo) y enlaces de campaña por red social.
- **CRM** (`/admin/crm`): toda la base con búsqueda (institución, persona, ciudad, teléfono, DANE) y filtros (etapa, prioridad, origen, responsable, seguimientos pendientes); alta manual; importar y exportar CSV. La **ficha del contacto** registra gestiones (llamada, WhatsApp, correo, reunión, visita, nota) con el próximo seguimiento; una gestión de contacto fija el último contacto y pasa un lead *Nuevo* a *Contactado*. Los cambios de etapa y responsable quedan en el historial, y se muestran los pedidos de la tienda hechos con el mismo correo.
- **Pedidos** (`/admin/pedidos`): bandejas por preparar, esperando pago, enviados, cerrados; ficha con productos, cliente, pagos, notas internas y trazabilidad.
- **Productos e inventario** (`/admin/productos`): tablero por categorías (arrastrar ordena la tienda) o tabla para poner precios rápido (al asignar el primer precio a un borrador se publica), acciones masivas, destacados de la portada, venta bajo pedido, fotos subidas desde el panel, ajustes de stock con motivo e historial, importar y exportar CSV.
- **Integraciones** (`/admin/integraciones`): estado de Wompi, base de datos, fotos y canales.

Las fotos que se suben desde el panel se guardan en `ALESYA_DATA_DIR/uploads` (fuera de la app, sobreviven a los despliegues) y se sirven en `/uploads/<uuid>.jpg|png|webp`; el formato se valida por su firma binaria.

### Importar y exportar CSV

- **Productos:** mismo formato que `../inventario-alesya.csv` (`cantidad, nombre, categoria, sku_ref, precio_cop`, más `imagen`, `estado`, `destacado`, `bajo_pedido`, `descripcion`/`notas` opcionales). Actualiza por SKU; en los existentes solo cambian las columnas presentes. El stock de los existentes solo cambia si se marca el archivo como conteo físico (queda un evento `stock_count`).
- **Contactos:** el mismo formato que exporta el panel, o columnas equivalentes (`colegio`, `email`, `municipio`, `dane`…). Se deduplica por código DANE y, sin código, por correo. Acepta coma o punto y coma (Excel en español).

## Comandos

- `npm run dev`: servidor de desarrollo.
- `npm run build`: compilación de producción en `.next/standalone`, con estáticos y `public/` copiados.
- `npm start`: aplica las migraciones pendientes y arranca el servidor standalone (requiere `npm run build`).
- `npm run admin:setup -- correo@dominio.co`: credenciales de `/admin` en `.env.local`. Con `--production` las escribe en `.local/admin-cpanel.txt` para cPanel (`--force` para sobrescribir).
- `npm run lint`: ESLint.
- `npm run db:generate`: genera una migración después de cambiar `db/schema.ts`.
- `npm run db:migrate`: aplica las migraciones pendientes (usa `TURSO_DATABASE_URL` si está definida).
- `npm run inventory:import`: carga `../inventario-alesya.csv` en la base local (en producción se usa **Productos → Importar CSV**).

Al generar una migración, comprueba que su `when` en `drizzle/meta/_journal.json` sea mayor que el de la anterior: el migrador de Drizzle omite las que tengan una fecha menor.

## Captación de colegios desde redes

La página `/colegios` lleva a los directivos al diagnóstico institucional y reutiliza el formulario y el CRM existentes. El enlace de WhatsApp abre una conversación en el número comercial. Para registrar esa conversación en el CRM, el asesor usa **+ Nuevo contacto** en `/admin/crm` o comparte el enlace `/colegios?utm_source=whatsapp&utm_campaign=colegios_2026` para que el interesado complete el formulario. El clic hacia WhatsApp, por sí solo, no crea una oportunidad.

Usa enlaces con `utm_source` y `utm_campaign` al publicar o prospectar. Ejemplos:

- LinkedIn: `/colegios?utm_source=linkedin&utm_campaign=colegios_2026`
- Instagram: `/colegios?utm_source=instagram&utm_campaign=colegios_2026`
- Facebook: `/colegios?utm_source=facebook&utm_campaign=colegios_2026`
- WhatsApp: `/colegios?utm_source=whatsapp&utm_campaign=colegios_2026`

El formulario acepta las fuentes `website`, `linkedin`, `instagram`, `facebook` y `whatsapp`. La campaña admite hasta 40 caracteres alfanuméricos, guion o guion bajo. Ambos datos se guardan en `leads.source` y aparecen en la ficha del contacto en `/admin/crm` (filtro *Origen*). Cada envío del formulario entra con prioridad alta y aparece en la columna *Nuevo* de la máquina de ventas. La captura de fuente ocurre al enviar el formulario, por lo que conserva el enlace de campaña al compartirlo.

## Base de colegios 2026

La base `Base_Leads_Colegios_Alesya_2026.xlsx` (**2.435 colegios únicos** de Bogotá, Chía y Sabana Occidente) está en la base SQLite local con origen `base_colegios_2026`; alimenta la cola de prospección de la máquina de ventas. La importación usa el código DANE para evitar duplicados. El Excel original permanece sin cambios y los datos personales no se versionan (el repositorio es público).

Para repetir la carga en otra instalación local:

```sh
python scripts/prepare-school-leads.py Base_Leads_Colegios_Alesya_2026.xlsx .local/school-leads-2026.json
npm run db:migrate
node scripts/import-school-leads.mjs .local/school-leads-2026.json
```

El panel ofrece enlaces de campaña para LinkedIn, Instagram, Facebook y WhatsApp. Los formularios guardan el origen en `leads.source`. Publicar contenido, enviar mensajes y sincronizar conversaciones requiere configurar las cuentas de cada red; esos servicios aún no están conectados al panel. Un clic al enlace de WhatsApp no crea un lead: el asesor puede registrarlo manualmente desde **+ Nuevo contacto** o pedir que la persona complete el formulario de colegios.
