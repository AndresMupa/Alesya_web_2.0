import "server-only";
import { getDb } from "@/db";
import { settings } from "@/db/schema";

/** Configuración de la tienda editable desde /admin/configuracion. Lo que no se ha guardado usa el valor por defecto. */
export const settingDefaults = {
  "store.whatsapp": "573005937840",
  "store.payment_instructions": "Puedes pagar por transferencia bancaria o Nequi. Escríbenos por WhatsApp con la referencia de tu pedido y te enviamos los datos de la cuenta; al confirmar el pago preparamos el envío.",
  "store.shipping_default_cop": "0",
  "store.shipping_note": "Envíos a toda Colombia. Coordinamos la entrega al confirmar el pago.",
  "mail.notify_to": "comercial@alesyaediciones.com",
  "crm.daily_goal": "20",
  /** Remitentes que la captación por correo no convierte en leads: direcciones o dominios (proveedores, bancos…). */
  "crm.inbox_ignore": "",
} as const;

export type SettingKey = keyof typeof settingDefaults;
export type Settings = Record<SettingKey, string>;
export const settingKeys = Object.keys(settingDefaults) as SettingKey[];

export async function getSettings(): Promise<Settings> {
  const rows = await getDb().select().from(settings);
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return Object.fromEntries(settingKeys.map((key) => [key, stored[key] ?? settingDefaults[key]])) as Settings;
}

export async function saveSettings(patch: Partial<Settings>) {
  const db = getDb();
  const now = new Date();
  const entries = Object.entries(patch).filter(([key]) => settingKeys.includes(key as SettingKey)) as [SettingKey, string][];
  if (!entries.length) return;
  const [first, ...rest] = entries.map(([key, value]) => db.insert(settings).values({ key, value: value.trim(), updatedAt: now }).onConflictDoUpdate({ target: settings.key, set: { value: value.trim(), updatedAt: now } }));
  await db.batch([first, ...rest]);
}

/** Valores ya interpretados para la tienda. */
export async function storeConfig() {
  const values = await getSettings();
  const whatsapp = values["store.whatsapp"].replace(/\D/g, "");
  return {
    whatsappDigits: whatsapp.length === 10 ? `57${whatsapp}` : whatsapp,
    paymentInstructions: values["store.payment_instructions"],
    shippingDefaultInCents: Math.max(0, Math.round(Number(values["store.shipping_default_cop"]) || 0)) * 100,
    shippingNote: values["store.shipping_note"],
    notifyTo: values["mail.notify_to"],
  };
}
