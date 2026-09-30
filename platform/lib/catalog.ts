import { Bot, Box, CircuitBoard, Cpu, PackageOpen, Printer, Wrench } from "lucide-react";

export const featuredProducts = [
  { slug: "kit-arduino-explorador", name: "Kit Arduino Explorador", type: "Kit de electrónica", description: "Placa, sensores, actuadores y guía para 12 proyectos progresivos.", price: "$289.000", priceInCents: 28900000, badge: "Más elegido", tone: "cyan", icon: CircuitBoard },
  { slug: "ruta-lego-ev3", name: "Ruta LEGO EV3", type: "Libro + recursos", description: "Secuencia pedagógica para construir, programar y evaluar 8 retos.", price: "$119.000", priceInCents: 11900000, badge: "Docentes", tone: "yellow", icon: Bot },
  { slug: "kit-mecanismos-wedo", name: "Kit Mecanismos WeDo", type: "Kit de aula", description: "Piezas complementarias y fichas para máquinas simples en primaria.", price: "$349.000", priceInCents: 34900000, badge: null, tone: "coral", icon: PackageOpen },
  { slug: "laboratorio-impresion-3d", name: "Laboratorio de impresión 3D", type: "Programa educativo", description: "Diseño, laminado y fabricación de un objeto funcional paso a paso.", price: "$179.000", priceInCents: 17900000, badge: "Nuevo", tone: "violet", icon: Printer },
] as const;

export const learningPaths = [
  { title: "Circuitos que cuentan historias", detail: "Electrónica + creatividad", level: "Inicial" },
  { title: "Robot seguidor de línea", detail: "Arduino + sensores", level: "Intermedio" },
  { title: "Mecanismos en movimiento", detail: "LEGO WeDo", level: "Inicial" },
  { title: "Diseña una ayuda técnica", detail: "Impresión 3D + diseño", level: "Avanzado" },
];

export const catalogGroups = [
  { title: "Robótica", icon: Bot, detail: "Kits LEGO EV3, WeDo y retos de programación." }, { title: "Electrónica", icon: Cpu, detail: "Arduino, sensores, actuadores y componentes." }, { title: "Fabricación", icon: Printer, detail: "Impresión 3D, diseño y prototipado." }, { title: "Bricolaje", icon: Wrench, detail: "Materiales y guías para construir con las manos." }, { title: "Libros", icon: Box, detail: "Rutas pedagógicas y guías docentes." },
];

export function getProduct(slug?: string | null) { return featuredProducts.find((product) => product.slug === slug) ?? featuredProducts[0]; }
