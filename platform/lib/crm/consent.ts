// Textos de autorización que ve quien deja sus datos, con su versión. Seguro para cliente y servidor.
//
// BORRADOR · PENDIENTE DE REVISIÓN POR UN ABOGADO. Estos textos y su mapeo a la Ley 1581 de 2012 (datos personales) y a la
// Ley 2300 de 2023 (comunicaciones comerciales) salen de resúmenes sin verificar contra el texto oficial. Nada de aquí es
// asesoría jurídica. Al aprobar o cambiar un texto: crea una versión nueva (no edites la anterior), porque `leads` guarda la
// versión que cada persona aceptó y esa prueba se pierde si el texto de una versión cambia.

/** Autorización de tratamiento de datos (obligatoria): cada formulario tiene su propio texto y versión. */
export const dataConsentTexts = {
  "datos-diagnostico-v1-borrador": "Autorizo el tratamiento de mis datos para recibir el diagnóstico y propuestas, según la Política de datos personales.",
  "datos-lista-espera-v1-borrador": "Autorizo el tratamiento de mis datos para que me avisen cuando este producto esté disponible, según la Política de datos personales.",
} as const;
export type DataConsentVersion = keyof typeof dataConsentTexts;
export const dataConsentVersions = Object.keys(dataConsentTexts) as [DataConsentVersion, ...DataConsentVersion[]];

/** Autorización de comunicaciones comerciales (opcional, casilla propia y sin marcar): novedades, guías y ofertas por correo y WhatsApp. */
export const marketingConsentTexts = {
  "marketing-v1-borrador": "Quiero recibir novedades, guías y ofertas de Alesya por correo y WhatsApp. Es opcional y no afecta tu solicitud; puedes darte de baja cuando quieras con el enlace de baja de cada correo o escribiéndonos.",
} as const;
export type MarketingConsentVersion = keyof typeof marketingConsentTexts;
export const marketingConsentVersions = Object.keys(marketingConsentTexts) as [MarketingConsentVersion, ...MarketingConsentVersion[]];
export const CURRENT_MARKETING_CONSENT: MarketingConsentVersion = "marketing-v1-borrador";

/** Canales de comunicación comercial autorizados: correo siempre que haya correo; WhatsApp solo si dejó celular. */
export const marketingChannels = (input: { email?: string | null; phone?: string | null }) => [input.email ? "email" : "", input.phone ? "whatsapp" : ""].filter(Boolean).join(",");
