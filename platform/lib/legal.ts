import { site } from "@/lib/site";

/**
 * Páginas legales del sitio. Usan las mismas direcciones que tenía WordPress para conservar su posicionamiento.
 * El texto sigue la Ley 1581 de 2012 y el Decreto 1377 de 2013 (datos personales) y la Ley 1480 de 2011
 * (Estatuto del Consumidor). Antes de publicar cambios conviene que los revise el área legal o contable.
 */
export type LegalBlock = { heading?: string; paragraphs?: string[]; items?: string[] };
export type LegalPage = { slug: string; title: string; short: string; description: string; updated: string; blocks: LegalBlock[] };

const address = `${site.address.street}, ${site.address.city}, ${site.address.region}, ${site.address.countryName}`;
const contact = `el correo ${site.email}, el WhatsApp ${site.phone} o por escrito en ${address}`;

const privacy: LegalPage = {
  slug: "politica-de-privacidad",
  title: "Política de tratamiento de datos personales",
  short: "Privacidad y datos personales",
  description: "Cómo Alesya Ediciones recoge, usa y protege los datos personales de quienes visitan el sitio, compran en la tienda o solicitan un diagnóstico para su colegio.",
  updated: "4 de octubre de 2026",
  blocks: [
    { paragraphs: [`Esta política explica cómo ${site.legalName} ("Alesya Ediciones" o "Alesya X-Tech") trata los datos personales que recibe a través de este sitio web, la tienda en línea, WhatsApp y el correo, en cumplimiento de la Ley 1581 de 2012, el Decreto 1377 de 2013 y las demás normas colombianas de protección de datos.`] },
    { heading: "1. Responsable del tratamiento", items: [`Razón social: ${site.legalName}.`, `Domicilio y dirección: ${address}.`, `Correo: ${site.email}.`, `Teléfono y WhatsApp: ${site.phone}.`] },
    { heading: "2. Qué datos recogemos", items: [
      "Formulario de diagnóstico para colegios: nombre, institución, correo, celular (opcional), el mensaje que escribas y la campaña o red social desde la que llegaste.",
      "Compras en la tienda: nombre, correo, celular, documento de identidad (opcional), ciudad y dirección de entrega, notas del pedido, productos comprados y el estado del pago.",
      "Pagos: los datos de tarjetas, cuentas y PSE los recibe y procesa directamente Wompi (Bancolombia). Alesya no recibe ni guarda números de tarjeta ni claves bancarias; solo conoce el resultado del pago.",
      "Cotizaciones y relación comercial con instituciones: datos de contacto institucional (colegio, cargo, teléfono y correo de la institución) y el historial de conversaciones con el equipo comercial.",
      "Datos técnicos: dirección IP y datos básicos de la solicitud, usados solo para la seguridad del sitio y para limitar abusos de los formularios.",
    ] },
    { heading: "3. Para qué usamos los datos", items: [
      "Responder solicitudes, preparar diagnósticos, propuestas y cotizaciones para instituciones.",
      "Procesar pedidos, confirmar pagos, coordinar envíos y entregas, atender cambios, devoluciones y garantías.",
      "Enviarte correos o mensajes sobre tu pedido o tu solicitud (confirmaciones, instrucciones de pago, envío y entrega).",
      "Contactar a colegios e instituciones educativas para ofrecer programas de robótica, dotación y formación docente.",
      "Enviar novedades y ofertas, solo cuando nos hayas autorizado. Puedes pedir que no te escribamos más en cualquier momento.",
      "Cumplir obligaciones legales, contables y tributarias, y proteger la seguridad del sitio.",
    ] },
    { heading: "4. Autorización", paragraphs: ["Al enviar el formulario de diagnóstico o finalizar una compra marcas una casilla con la que autorizas el tratamiento de tus datos para las finalidades de esta política. Guardamos registro de la solicitud o del pedido como prueba de esa autorización. No es obligatorio responder preguntas sobre datos sensibles ni sobre niñas, niños y adolescentes; este sitio no los solicita."] },
    { heading: "5. Con quién compartimos los datos", paragraphs: ["No vendemos ni cedemos tus datos. Los compartimos solo con proveedores que los tratan por cuenta nuestra y con medidas de seguridad: el proveedor de alojamiento del sitio y del correo, Wompi para los pagos en línea y las transportadoras que entregan los pedidos (nombre, dirección y teléfono de entrega). También los entregaremos a una autoridad cuando una ley o una orden judicial lo exija."] },
    { heading: "6. Cookies y almacenamiento en el navegador", paragraphs: ["El sitio no usa cookies de publicidad ni de seguimiento de terceros. El carrito de compras se guarda en el almacenamiento de tu propio navegador para que no pierdas los productos al recargar la página; puedes borrarlo vaciando el carrito o los datos del sitio. El panel administrativo usa una cookie de sesión solo para el personal de Alesya."] },
    { heading: "7. Tus derechos", paragraphs: ["Como titular de los datos puedes:"], items: [
      "Conocer, actualizar y rectificar tus datos.",
      "Pedir prueba de la autorización que nos diste.",
      "Saber qué uso le hemos dado a tus datos.",
      "Revocar la autorización o pedir que suprimamos tus datos, cuando no exista un deber legal o contractual de conservarlos.",
      "Acceder gratis a tus datos.",
      "Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) después de haber hecho tu consulta o reclamo ante nosotros.",
    ] },
    { heading: "8. Cómo hacer consultas y reclamos", paragraphs: [
      `Escríbenos a ${contact}. Indica tu nombre, tu documento, lo que pides y un dato de contacto para responderte. El equipo comercial de Alesya Ediciones atiende estas solicitudes.`,
      "Las consultas se responden en un máximo de diez (10) días hábiles, prorrogables por cinco (5) días hábiles más avisándote el motivo. Los reclamos (corrección, actualización, supresión o incumplimiento) se responden en un máximo de quince (15) días hábiles, prorrogables por ocho (8) días hábiles más. Si el reclamo está incompleto te pediremos lo que falte dentro de los cinco (5) días siguientes.",
    ] },
    { heading: "9. Fotografías de actividades", paragraphs: [`Algunas fotos del sitio muestran actividades en colegios. Si apareces (o tu hija o hijo aparece) en una de ellas y quieres que la retiremos, escríbenos a ${site.email} y la quitaremos.`] },
    { heading: "10. Seguridad y conservación", paragraphs: ["Guardamos los datos en servidores con acceso restringido, conexión cifrada (HTTPS) y copias de seguridad. Los conservamos mientras dure la relación comercial y el tiempo que exijan las normas contables, tributarias y de protección al consumidor; después los suprimimos."] },
    { heading: "11. Vigencia y cambios", paragraphs: ["Esta política rige desde su publicación en el sitio. Si cambia de forma sustancial publicaremos la nueva versión en esta misma página con su fecha."] },
  ],
};

const returns: LegalPage = {
  slug: "politica-de-reembolsos-y-devoluciones",
  title: "Cambios, devoluciones, retracto y garantías",
  short: "Cambios y devoluciones",
  description: "Cómo pedir un cambio, una devolución, el retracto de una compra en línea o la garantía de un producto comprado en la tienda Alesya.",
  updated: "4 de octubre de 2026",
  blocks: [
    { paragraphs: ["Queremos que tus kits, libros y materiales lleguen bien y te sirvan. Estas reglas aplican a las compras hechas en este sitio, por WhatsApp o directamente con el equipo comercial, sin perjuicio de los derechos que te da la Ley 1480 de 2011 (Estatuto del Consumidor)."] },
    { heading: "1. Derecho de retracto (compras en línea)", paragraphs: [
      "Si compraste en línea o a distancia puedes retractarte dentro de los cinco (5) días hábiles siguientes a la entrega del producto, sin dar explicaciones. El producto debe devolverse sin uso, completo y en las mismas condiciones en que lo recibiste. Los costos de transporte de la devolución corren por tu cuenta.",
      "Te devolvemos el dinero pagado dentro de los treinta (30) días calendario siguientes al ejercicio del retracto. El retracto no aplica a productos fabricados o personalizados a tu medida ni a los demás casos que excluye el artículo 47 de la Ley 1480.",
    ] },
    { heading: "2. Devoluciones por otras razones (hasta 30 días)", items: [
      "Puedes pedir la devolución dentro de los 30 días calendario siguientes a la entrega.",
      "El producto debe estar sin usar, completo y en su empaque original, con el comprobante de compra o la referencia del pedido (ALESYA-…).",
      "Los libros, módulos y kits con signos evidentes de uso, piezas faltantes o daños que no se deban a un error nuestro pueden recibir un reembolso parcial.",
      "Los productos personalizados y el software descargable no se devuelven, salvo que tengan un defecto.",
    ] },
    { heading: "3. Garantía", paragraphs: ["Todos los productos tienen la garantía legal de calidad, idoneidad y seguridad. Si un producto llega defectuoso, dañado o diferente a lo que pediste, lo reparamos, lo cambiamos por uno igual o te devolvemos el dinero, y asumimos el envío. El término de la garantía es el que indica la ficha del producto o el fabricante. Los productos usados se venden en el estado descrito en su ficha."] },
    { heading: "4. Reversión del pago", paragraphs: ["Si pagaste con un medio electrónico (tarjeta, PSE u otro) puedes pedir la reversión del pago dentro de los cinco (5) días hábiles siguientes a la fecha en que supiste de un fraude, de una operación no solicitada, o a la entrega de un producto que no llegó, llegó defectuoso o no corresponde a lo pedido. Debes avisarnos a nosotros y a la entidad que emitió tu medio de pago, y devolver el producto si lo recibiste."] },
    { heading: "5. Cómo hacer la solicitud", items: [
      `Escríbenos a ${site.email} o al WhatsApp ${site.phone} con la referencia del pedido, el producto, el motivo y fotos si hay un daño.`,
      `Te confirmamos si procede y cómo enviarlo. Las devoluciones se reciben en ${address}. No envíes el producto al fabricante.`,
      "Cuando recibimos e inspeccionamos el producto te avisamos por correo si el reembolso fue aprobado.",
    ] },
    { heading: "6. Reembolsos", paragraphs: [
      "El reembolso se hace por el mismo medio de pago: a la tarjeta o cuenta usada en Wompi, o por transferencia si pagaste así. Según tu banco puede tardar algunos días en verse reflejado. El costo del envío original no se reembolsa, salvo que el producto haya llegado defectuoso o equivocado.",
      `Si no ves tu reembolso, revisa primero con tu banco o la entidad de tu tarjeta y luego escríbenos a ${site.email}.`,
    ] },
  ],
};

const terms: LegalPage = {
  slug: "aviso-legal",
  title: "Aviso legal y condiciones de uso",
  short: "Aviso legal",
  description: "Condiciones de uso del sitio y de la tienda en línea de Alesya Ediciones y Alesya X-Tech: titularidad, compras, precios, propiedad intelectual y jurisdicción.",
  updated: "4 de octubre de 2026",
  blocks: [
    { paragraphs: [`Este sitio web y su tienda en línea son de ${site.legalName}, con domicilio en ${address}, correo ${site.email} y teléfono ${site.phone}. Al navegar por el sitio o comprar en él aceptas estas condiciones, la Política de tratamiento de datos personales y la Política de cambios, devoluciones, retracto y garantías.`] },
    { heading: "1. Uso del sitio", paragraphs: ["El acceso es libre y gratuito y no requiere registro. Debes usar el sitio de buena fe y conforme a la ley. Está prohibido usarlo para dañar, sobrecargar o inutilizar sus servidores o sistemas, o para afectar a Alesya Ediciones o a terceros."] },
    { heading: "2. Compras en la tienda", items: [
      "Los precios se muestran en pesos colombianos (COP) y pueden cambiar sin previo aviso; el precio que aplica es el del momento de hacer el pedido.",
      "El pedido queda confirmado cuando se aprueba el pago. Los pagos en línea los procesa Wompi; también aceptamos transferencia y Nequi confirmados por el equipo.",
      "La disponibilidad se actualiza en el sitio. Si un producto se agota después de tu pago te ofrecemos esperar la reposición, cambiarlo por otro o la devolución del dinero.",
      "El envío se coordina después del pago, según la ciudad de entrega. Puedes consultar el estado de tu pedido en la sección Rastrear pedido.",
    ] },
    { heading: "3. Propiedad intelectual", paragraphs: ["Los textos, fotografías, videos, logos, diseños, contenidos educativos y el código del sitio son de Alesya Ediciones o de sus titulares y están protegidos por las normas de derechos de autor y propiedad industrial. No se pueden copiar, distribuir, modificar ni usar con fines comerciales sin autorización escrita. Las marcas de terceros (por ejemplo LEGO o Arduino) pertenecen a sus dueños y se mencionan solo para describir los productos."] },
    { heading: "4. Responsabilidad", paragraphs: ["Procuramos que la información del sitio sea correcta y esté actualizada, pero puede contener errores o cambiar. Los enlaces a otros sitios se ofrecen como referencia y no somos responsables de su contenido. Si encuentras un error o un enlace inadecuado, avísanos y lo corregiremos."] },
    { heading: "5. Peticiones, quejas y reclamos", paragraphs: [`Puedes enviarnos peticiones, quejas, reclamos o sugerencias a ${site.email} o al WhatsApp ${site.phone}. Te responderemos en los plazos que fija la ley.`] },
    { heading: "6. Ley aplicable", paragraphs: ["Estas condiciones se rigen por las leyes de la República de Colombia. Cualquier controversia se resolverá ante los jueces competentes de Colombia, sin perjuicio de los derechos que te da el Estatuto del Consumidor."] },
  ],
};

export const legalPages = [privacy, returns, terms];
export const getLegalPage = (slug: string) => legalPages.find((page) => page.slug === slug);
