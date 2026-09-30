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
- `npm run build`: compilación de producción en `.next/standalone`, con estáticos y `public/` copiados.
- `npm start`: aplica las migraciones pendientes y arranca el servidor standalone (requiere `npm run build`).
- `npm run admin:setup -- correo@dominio.co`: credenciales de `/admin` en `.env.local`. Con `--production` las escribe en `.local/admin-cpanel.txt` para cPanel (`--force` para sobrescribir).
- `npm run lint`: ESLint.
- `npm run db:generate`: genera una migración después de cambiar `db/schema.ts`.
- `npm run db:migrate`: aplica las migraciones pendientes (usa `TURSO_DATABASE_URL` si está definida).

## Captación de colegios desde redes

La página `/colegios` lleva a los directivos al diagnóstico institucional y reutiliza el formulario y el CRM existentes. El enlace de WhatsApp abre una conversación en el número comercial. Para registrar esa conversación en el CRM, el asesor usa **+ Registrar contacto** en `/admin#ventas` o comparte el enlace `/colegios?utm_source=whatsapp&utm_campaign=colegios_2026` para que el interesado complete el formulario. El clic hacia WhatsApp, por sí solo, no crea una oportunidad.

Usa enlaces con `utm_source` y `utm_campaign` al publicar o prospectar. Ejemplos:

- LinkedIn: `/colegios?utm_source=linkedin&utm_campaign=colegios_2026`
- Instagram: `/colegios?utm_source=instagram&utm_campaign=colegios_2026`
- Facebook: `/colegios?utm_source=facebook&utm_campaign=colegios_2026`
- WhatsApp: `/colegios?utm_source=whatsapp&utm_campaign=colegios_2026`

El formulario acepta las fuentes `website`, `linkedin`, `instagram`, `facebook` y `whatsapp`. La campaña admite hasta 40 caracteres alfanuméricos, guion o guion bajo. Ambos datos se guardan en `leads.source` y aparecen debajo de la institución en `/admin?vista=crm`. La captura de fuente ocurre al enviar el formulario, por lo que conserva el enlace de campaña al compartirlo.

## Admin comercial para colegios

En `/admin#ventas` el equipo puede buscar toda la base por institución, rectoría, municipio o código DANE; filtrar por etapa, prioridad, canal y seguimiento pendiente; asignar responsable, guardar notas y fechas de último contacto y próximo seguimiento. El panel muestra 40 registros por página. Las etapas son nuevo, contactado, reunión, propuesta, ganado y perdido.

La base `Base_Leads_Colegios_Alesya_2026.xlsx` se preparó e importó en la base SQLite local: **2.435 colegios únicos**. La importación utiliza el código DANE para evitar duplicados; una segunda ejecución insertó cero registros. La cobertura del archivo es Bogotá, Chía y Sabana Occidente, aunque la estrategia comercial puede ampliarse a toda Colombia. El Excel original permanece sin cambios.

Para repetir la carga en otra instalación local:

```sh
python scripts/prepare-school-leads.py Base_Leads_Colegios_Alesya_2026.xlsx .local/school-leads-2026.json
npm run db:migrate
node scripts/import-school-leads.mjs .local/school-leads-2026.json
```

El panel ofrece enlaces de campaña para LinkedIn, Instagram, Facebook y WhatsApp. Los formularios guardan el origen en `leads.source`. Publicar contenido, enviar mensajes y sincronizar conversaciones requiere configurar las cuentas de cada red; esos servicios aún no están conectados al panel. Un clic al enlace de WhatsApp no crea un lead: el asesor puede registrarlo manualmente desde **+ Registrar contacto** o pedir que la persona complete el formulario de colegios.
