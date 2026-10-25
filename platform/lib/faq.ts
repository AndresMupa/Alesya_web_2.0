import { site } from "@/lib/site";

export type Faq = { question: string; answer: string };

/**
 * Preguntas frecuentes públicas. Se usan en la página /preguntas-frecuentes y en su dato estructurado FAQPage, que los
 * buscadores y asistentes de IA leen para responder. Cada respuesta debe coincidir con lo que dicen las demás páginas.
 */
export const faqs: Faq[] = [
  {
    question: "¿Qué es Alesya X-Tech?",
    answer: `Alesya X-Tech es la marca de robótica educativa, electrónica, impresión 3D, bricolaje y libros de ${site.legalName}, con sede en ${site.address.city}, ${site.address.region} (Colombia). Vende kits para aprender haciendo y ofrece programas de robótica y cultura maker para colegios.`,
  },
  {
    question: "¿Qué productos venden?",
    answer: "Kits de LEGO EV3 y LEGO WeDo, placas Arduino con sensores y componentes electrónicos, materiales para impresión 3D, proyectos de bricolaje y libros con rutas pedagógicas y guías docentes.",
  },
  {
    question: "¿Hacen envíos a toda Colombia?",
    answer: "Sí. Hacemos envíos a toda Colombia y coordinamos la entrega cuando se confirma el pago del pedido.",
  },
  {
    question: "¿Cómo puedo pagar mi pedido?",
    answer: "Puedes pagar en línea con tarjeta, PSE, Nequi o Botón Bancolombia a través de la pasarela segura Wompi. También puedes pagar por transferencia bancaria o Nequi: escribe por WhatsApp con la referencia de tu pedido y el equipo te envía los datos de la cuenta.",
  },
  {
    question: "¿Para qué edades son los proyectos?",
    answer: "Los proyectos de la página de proyectos van desde los 7 años (LEGO WeDo) hasta los 12 años (impresión 3D). Cada proyecto indica su edad sugerida, duración y nivel.",
  },
  {
    question: "¿Ofrecen programas de robótica para colegios?",
    answer: "Sí. Diseñamos programas de robótica educativa y cultura maker para colegios que incluyen diagnóstico, dotación de kits, formación docente, contenidos para el aula y seguimiento. Están descritos en la página para colegios del sitio.",
  },
  {
    question: "¿Cómo pido una cotización para mi colegio?",
    answer: `Llena el formulario de diagnóstico de la página para colegios, o escribe por WhatsApp al ${site.phone} o al correo ${site.email}.`,
  },
  {
    question: "¿Cómo rastreo mi pedido?",
    answer: "Desde la página Rastrear pedido puedes consultar el estado de tu compra con la referencia que recibiste al hacer el pedido.",
  },
  {
    question: "¿Tienen política de devoluciones?",
    answer: "Sí. La política de reembolsos y devoluciones está publicada en el sitio y explica las condiciones para cambios y devoluciones.",
  },
  {
    question: "¿Cómo protegen mis datos personales?",
    answer: "Tratamos los datos personales según la Ley 1581 de 2012 y el Decreto 1377 de 2013. Los pagos los procesa directamente Wompi: Alesya no recibe ni guarda números de tarjeta ni claves bancarias. La política completa está publicada en el sitio.",
  },
  {
    question: "¿Dónde están ubicados?",
    answer: `Estamos en ${site.address.street}, ${site.address.city}, ${site.address.region}, ${site.address.countryName}.`,
  },
];
