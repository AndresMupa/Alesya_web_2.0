import { BookOpen, Bot, Cpu, PackageOpen, Printer, Wrench, type LucideIcon } from "lucide-react";

/** Rutas de aprendizaje de la portada (contenido educativo, independiente del catálogo). */
export const learningPaths = [
  { title: "Circuitos que cuentan historias", detail: "Electrónica + creatividad", level: "Inicial" },
  { title: "Robot seguidor de línea", detail: "Arduino + sensores", level: "Intermedio" },
  { title: "Mecanismos en movimiento", detail: "LEGO WeDo", level: "Inicial" },
  { title: "Diseña una ayuda técnica", detail: "Impresión 3D + diseño", level: "Avanzado" },
];

export type Tone = "cyan" | "yellow" | "coral" | "violet" | "mint";

/** Presentación de cada categoría en la tienda: icono de respaldo cuando no hay foto, color y texto. */
const categories: Record<string, { icon: LucideIcon; tone: Tone; detail: string }> = {
  "Robótica": { icon: Bot, tone: "yellow", detail: "Kits LEGO EV3, WeDo, Talebot y retos de programación." },
  "Electrónica": { icon: Cpu, tone: "cyan", detail: "Arduino, sensores, actuadores y componentes." },
  "Impresión 3D": { icon: Printer, tone: "violet", detail: "Impresión 3D, diseño y prototipado." },
  "Bricolaje": { icon: Wrench, tone: "coral", detail: "Materiales y guías para construir con las manos." },
  "Libros": { icon: BookOpen, tone: "mint", detail: "Rutas pedagógicas y guías docentes." },
};

export const categoryMeta = (category: string) => categories[category] ?? { icon: PackageOpen, tone: "cyan" as Tone, detail: "Productos Alesya para aprender haciendo." };
