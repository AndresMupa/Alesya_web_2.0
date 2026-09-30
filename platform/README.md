# Alesya X Tech — plataforma

Sitio público, tienda, CRM y centro de operaciones de Alesya. Next.js 16 (App Router) desplegado en Vercel, con base de datos libSQL/Turso vía Drizzle y pagos con Wompi. La arquitectura general está en [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

## Desarrollo local

Requiere Node.js `>=22.13.0`.

```sh
npm ci
npm run db:migrate                          # crea .local/alesya.db con las migraciones
npm run admin:setup -- tu-correo@dominio.co # solo la primera vez; la contraseña queda en .local/admin-access.txt
npm run dev                                 # http://127.0.0.1:5173
```

Sin `TURSO_DATABASE_URL` la app usa el archivo local `.local/alesya.db`. En Vercel es obligatorio un Turso persistente: `db/index.ts` se niega a arrancar con un archivo local.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Base de datos persistente (producción). |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET` | Acceso al panel `/admin`. Se generan con `npm run admin:setup`. |
| `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET` | Firma del checkout. Sin ellas el pedido se registra pero no se abre el cobro. |
| `WOMPI_EVENTS_SECRET` | Verificación de la firma del webhook `/api/webhooks/wompi`. |
| `ALESYA_DATA_DIR` | Carpeta privada para SQLite en cPanel; por defecto `~/alesya-data`. |
| `TRUSTED_PROXY_IP_HEADER` | Cabecera de IP saneada por el proxy. En cPanel: `x-forwarded-for`. |

Todas son secretos: configúralas en Vercel y en `.env.local`, nunca en el repositorio.

En cPanel, el arranque seguro crea/aplica las migraciones antes de iniciar Next.js y
guarda SQLite fuera del directorio público. El proxy debe sobrescribir
`x-forwarded-for`; si la cabecera configurada falta o no contiene una IP válida, los
endpoints con escritura y el acceso administrativo fallan de forma segura.

## Flujo de pedido y pago

1. `/checkout` crea el pedido (`payment_pending`), su ítem y un pago `pending`, y redirige al checkout de Wompi con firma de integridad.
2. Wompi llama a `/api/webhooks/wompi`. Solo ese evento firmado cambia el estado del pago:
   - `APPROVED` → pedido `paid` y se descuenta inventario (evento `sale`), si el monto y la moneda coinciden; si no, queda `payment_review`.
   - `DECLINED` / `ERROR` → `payment_declined` / `payment_error`.
   - `VOIDED` de un pago aprobado → `payment_voided` y se repone el inventario.
   - Los eventos repetidos o fuera de orden se ignoran; un pago aprobado no retrocede.
3. `/checkout/resultado` muestra el estado real del pedido; la redirección del navegador nunca confirma un pago.
4. Desde `/admin` el equipo avanza la preparación: `paid → preparing → shipped → delivered`, o cancela pedidos sin pagar.

Solo los productos creados en el panel (tabla `products`) llevan inventario. Los cuatro productos destacados de `lib/catalog.ts` se venden sin control de stock.

## Panel de operaciones

`/admin` muestra ventas del mes, oportunidades, pedidos por preparar y stock bajo con datos reales, además de:

- **CRM:** etapa (`new`, `contacted`, `proposal`, `won`, `lost`) y responsable de cada contacto.
- **Pedidos:** transiciones permitidas en `lib/statuses.ts`.
- **Productos e inventario:** alta de productos y ajustes de stock, cada uno registrado en `inventory_events`.

## Comandos

- `npm run dev`: servidor de desarrollo.
- `npm run build` / `npm start`: compilación y servidor de producción local.
- `npm run lint`: ESLint.
- `npm run db:generate`: genera una migración después de cambiar `db/schema.ts`.
- `npm run db:migrate`: aplica las migraciones pendientes (usa `TURSO_DATABASE_URL` si está definida).
