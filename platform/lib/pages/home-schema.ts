import { z } from "zod";
import { learningPaths } from "@/lib/content";

/**
 * Documento de la portada: una lista ordenada de secciones que el equipo edita desde /admin/portada.
 * Es seguro para cliente y servidor (el editor lo usa para validar y crear bloques; la API para guardar).
 * Nada se guarda como HTML: los títulos con acento van en dos campos (`title` + `accent`) y los párrafos
 * se cortan por saltos de línea al mostrarlos.
 */

/** Enlace permitido: ruta interna, ancla, https, correo o teléfono. Vacío = sin enlace. */
export const hrefSchema = z.string().trim().max(500).regex(/^(\/(?!\/).*|#.*|https?:\/\/.+|mailto:.+|tel:.+)?$/, "Enlace no válido");
/** Imagen o video: ruta servida por el sitio (/media/…, /uploads/…) o https. Vacío = sin archivo. */
export const mediaSchema = z.string().trim().max(500).regex(/^(\/(?!\/)\S*|https:\/\/\S+)?$/, "Ruta de archivo no válida");
const short = (max: number) => z.string().trim().max(max);
const long = (max: number) => z.string().max(max);
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);
const colorSchema = z.string().trim().regex(/^(#[0-9a-fA-F]{6})?$/, "Color hexadecimal (#rrggbb)");
const iconSchema = z.string().trim().max(40);
const base = { id: idSchema, enabled: z.boolean() };

export const heroSlideSchema = z.object({ id: idSchema, name: short(40), label: short(90), title: short(120), accent: short(120), description: long(400), video: mediaSchema, image: mediaSchema, color: colorSchema, primaryLabel: short(60), primaryHref: hrefSchema, secondaryLabel: short(60), secondaryHref: hrefSchema });
export const heroSchema = z.object({ ...base, type: z.literal("hero"), captionTop: short(60), captionBottom: short(90), poster: mediaSchema, slides: z.array(heroSlideSchema).max(8) });
export const bandSchema = z.object({ ...base, type: z.literal("band"), phrases: z.array(short(90)).max(6) });
export const categoriesSchema = z.object({ ...base, type: z.literal("categories"), eyebrow: short(90), title: short(120), accent: short(120), intro: long(400), items: z.array(z.object({ id: idSchema, icon: iconSchema, title: short(60), copy: long(200), color: colorSchema, href: hrefSchema })).max(12) });
export const storySchema = z.object({ ...base, type: z.literal("story"), eyebrow: short(90), kicker: short(30), title: short(160), text: long(600), video: mediaSchema, image: mediaSchema, meta: z.array(z.object({ id: idSchema, label: short(30), value: short(60) })).max(4), linkLabel: short(60), linkHref: hrefSchema });
export const pathsSchema = z.object({ ...base, type: z.literal("paths"), eyebrow: short(90), title: short(120), linkLabel: short(60), linkHref: hrefSchema, items: z.array(z.object({ id: idSchema, title: short(90), detail: short(90), level: short(30), href: hrefSchema })).max(12) });
export const storeSchema = z.object({ ...base, type: z.literal("store"), eyebrow: short(90), title: short(120), intro: long(400), buttonLabel: short(60), buttonHref: hrefSchema, emptyText: long(300), limit: z.number().int().min(1).max(8) });
export const clientsSchema = z.object({ ...base, type: z.literal("clients"), eyebrow: short(90), title: short(160), intro: long(400), audiences: z.array(z.object({ id: idSchema, icon: iconSchema, title: short(60), text: short(120) })).max(8), logosTitle: short(90), logos: z.array(z.object({ id: idSchema, image: mediaSchema, name: short(120) })).max(24), photos: z.array(z.object({ id: idSchema, image: mediaSchema, alt: short(160), caption: short(160) })).max(4) });
export const institutionalSchema = z.object({ ...base, type: z.literal("institutional"), eyebrow: short(90), title: short(120), accent: short(120), intro: long(500), bullets: z.array(z.object({ id: idSchema, icon: iconSchema, text: short(90) })).max(6), video: mediaSchema, image: mediaSchema, showForm: z.boolean() });
export const bannerSchema = z.object({ ...base, type: z.literal("banner"), eyebrow: short(90), title: short(160), accent: short(120), text: long(600), image: mediaSchema, video: mediaSchema, buttonLabel: short(60), buttonHref: hrefSchema, theme: z.enum(["dark", "light", "lime"]), layout: z.enum(["media-right", "media-left", "cover"]) });
export const sliderSchema = z.object({ ...base, type: z.literal("slider"), eyebrow: short(90), title: short(120), intro: long(400), autoplay: z.boolean(), slides: z.array(z.object({ id: idSchema, image: mediaSchema, title: short(120), text: long(300), href: hrefSchema })).max(12) });
export const textSchema = z.object({ ...base, type: z.literal("text"), eyebrow: short(90), title: short(160), accent: short(120), body: long(4000), buttonLabel: short(60), buttonHref: hrefSchema, align: z.enum(["left", "center"]) });
export const gallerySchema = z.object({ ...base, type: z.literal("gallery"), eyebrow: short(90), title: short(120), columns: z.union([z.literal(2), z.literal(3), z.literal(4)]), items: z.array(z.object({ id: idSchema, image: mediaSchema, caption: short(160) })).max(12) });

export const sectionSchema = z.discriminatedUnion("type", [heroSchema, bandSchema, categoriesSchema, storySchema, pathsSchema, storeSchema, clientsSchema, institutionalSchema, bannerSchema, sliderSchema, textSchema, gallerySchema]);
export const homeDocumentSchema = z.object({ version: z.literal(1), sections: z.array(sectionSchema).max(40) });

export type HomeSection = z.infer<typeof sectionSchema>;
export type HomeSectionType = HomeSection["type"];
export type SectionOf<T extends HomeSectionType> = Extract<HomeSection, { type: T }>;
export type HomeDocument = z.infer<typeof homeDocumentSchema>;
export type HeroSlide = z.infer<typeof heroSlideSchema>;

/** Qué es cada bloque, para el editor. Los únicos existen una sola vez (se pueden ocultar pero no borrar). */
export const blockCatalog: Record<HomeSectionType, { label: string; description: string; unique: boolean }> = {
  hero: { label: "Portada principal", description: "Video o imagen a pantalla completa con varias diapositivas (mundos) y dos botones.", unique: true },
  band: { label: "Franja de frases", description: "Cinta de color con frases cortas; la última va en negrita.", unique: false },
  categories: { label: "Categorías", description: "Tarjetas con icono, título y texto que llevan a proyectos o a la tienda.", unique: true },
  story: { label: "Proyecto destacado", description: "Video o foto a un lado y texto con datos (edad, duración, nivel).", unique: false },
  paths: { label: "Rutas de aprendizaje", description: "Lista numerada de rutas con su nivel.", unique: true },
  store: { label: "Tienda", description: "Productos destacados del catálogo (se marcan en Productos e inventario).", unique: true },
  clients: { label: "Clientes y comunidad", description: "Tipos de cliente, logos de colegios y fotos.", unique: true },
  institutional: { label: "Colegios y formulario", description: "Propuesta para instituciones con video y el formulario de diagnóstico.", unique: true },
  banner: { label: "Banner", description: "Imagen o video con título, texto y botón. Sirve para campañas y anuncios.", unique: false },
  slider: { label: "Carrusel de imágenes", description: "Diapositivas con foto, título, texto y enlace; pasa solo o con flechas.", unique: false },
  text: { label: "Texto", description: "Título y párrafos, con botón opcional.", unique: false },
  gallery: { label: "Galería", description: "Cuadrícula de fotos con pie de foto.", unique: false },
};
export const blockTypes = Object.keys(blockCatalog) as HomeSectionType[];

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "").slice(0, 10) : Math.random().toString(36).slice(2, 12));

export const signalColors = [
  { value: "#d7ff43", label: "Lima" }, { value: "#34d8ff", label: "Cian" }, { value: "#69e2ff", label: "Celeste" }, { value: "#ffd54a", label: "Amarillo" },
  { value: "#ff755f", label: "Coral" }, { value: "#a889ff", label: "Violeta" }, { value: "#c2a6ff", label: "Lila" }, { value: "#7de8c1", label: "Menta" },
];

const categoryLink = (category: string) => `/proyectos?categoria=${encodeURIComponent(category)}`;

/** La portada tal como se diseñó: es lo que ve el público mientras no se publique nada y lo que restaura «Diseño original». */
export function defaultHomeDocument(): HomeDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero", type: "hero", enabled: true, captionTop: "ALESYA X-TECH", captionBottom: "El mundo es tu laboratorio", poster: "/media/clientes-robotica-ev3.jpeg",
        slides: [
          { id: "hero-robotica", name: "Robótica", label: "Construye. Programa. Dale vida.", title: "La próxima gran idea", accent: "empieza contigo.", description: "Un robot que se mueve. Una pregunta que despierta. Descubre lo que puedes crear cuando aprendes haciendo.", video: "/media/robotica-aula.mp4", image: "", color: "#d7ff43", primaryLabel: "Empieza a explorar", primaryHref: categoryLink("LEGO EV3"), secondaryLabel: "Encuentra tu kit", secondaryHref: "/catalogo" },
          { id: "hero-electronica", name: "Electrónica", label: "Conecta tu curiosidad.", title: "Pequeños circuitos.", accent: "Grandes posibilidades.", description: "Sensores, luces y código: experimenta con Arduino y transforma una idea en algo que responde al mundo.", video: "/media/electronica.mp4", image: "", color: "#69e2ff", primaryLabel: "Empieza a explorar", primaryHref: categoryLink("Arduino"), secondaryLabel: "Encuentra tu kit", secondaryHref: "/catalogo" },
          { id: "hero-3d", name: "Diseño 3D", label: "De tu imaginación a tus manos.", title: "Si puedes imaginarlo,", accent: "puedes construirlo.", description: "Explora el diseño y la impresión 3D. Aprende a dar forma a tus ideas, una capa a la vez.", video: "/media/impresion-3d.mp4", image: "", color: "#c2a6ff", primaryLabel: "Empieza a explorar", primaryHref: categoryLink("Impresión 3D"), secondaryLabel: "Encuentra tu kit", secondaryHref: "/catalogo" },
        ],
      },
      { id: "band", type: "band", enabled: true, phrases: ["Para mentes curiosas.", "Para manos inquietas.", "Para quienes crean el futuro."] },
      {
        id: "categories", type: "categories", enabled: true, eyebrow: "Encuentra tu próxima aventura", title: "¿Qué quieres", accent: "crear hoy?", intro: "Empieza con una curiosidad. Encuentra el proyecto, aprende a tu ritmo y descubre hasta dónde puedes llegar.",
        items: [
          { id: "cat-ev3", icon: "bot", title: "LEGO EV3", copy: "Retos de construcción, sensores, motores y programación por bloques.", color: "#ffd54a", href: categoryLink("LEGO EV3") },
          { id: "cat-wedo", icon: "boxes", title: "LEGO WeDo", copy: "Primeros pasos en mecanismos y pensamiento computacional para primaria.", color: "#34d8ff", href: categoryLink("LEGO WeDo") },
          { id: "cat-arduino", icon: "circuit", title: "Arduino", copy: "Electrónica aplicada con microcontroladores, sensores y proyectos reales.", color: "#d7ff43", href: categoryLink("Arduino") },
          { id: "cat-bricolaje", icon: "wrench", title: "Bricolaje", copy: "Construye objetos útiles mientras aprendes diseño, medida y fabricación.", color: "#ff755f", href: categoryLink("Bricolaje") },
          { id: "cat-3d", icon: "printer", title: "Impresión 3D", copy: "Modelado, prototipado y piezas que conectan las ideas con el mundo físico.", color: "#a889ff", href: categoryLink("Impresión 3D") },
        ],
      },
      {
        id: "story", type: "story", enabled: true, eyebrow: "Proyecto destacado", kicker: "01 / 04", title: "Programa un robot que entiende su entorno.", text: "Del primer mecanismo al desafío autónomo: una ruta EV3 con guías docentes, actividades de aula y piezas listas para construir.", video: "/media/lego-ev3.mp4", image: "",
        meta: [{ id: "story-edad", label: "Edad", value: "10–16 años" }, { id: "story-duracion", label: "Duración", value: "6 sesiones" }, { id: "story-nivel", label: "Nivel", value: "Intermedio" }], linkLabel: "Ver ruta completa", linkHref: "/proyectos",
      },
      { id: "paths", type: "paths", enabled: true, eyebrow: "Rutas de aprendizaje", title: "De la curiosidad a la creación.", linkLabel: "Ver todas las rutas", linkHref: "/proyectos", items: learningPaths.map((path, index) => ({ id: `path-${index + 1}`, title: path.title, detail: path.detail, level: path.level, href: "/proyectos" })) },
      { id: "store", type: "store", enabled: true, eyebrow: "Tienda educativa", title: "Todo para empezar a construir.", intro: "Productos seleccionados por su valor pedagógico, no solo por sus especificaciones.", buttonLabel: "Ver catálogo completo", buttonHref: "/catalogo", emptyText: "Estamos preparando el catálogo en línea. Escríbenos y te ayudamos a elegir.", limit: 4 },
      {
        id: "clients", type: "clients", enabled: true, eyebrow: "Nuestros clientes", title: "La tecnología cobra sentido cuando llega a una comunidad.", intro: "En el aula, en casa o en comunidad. Acompañamos a quienes descubren, enseñan y comparten una nueva forma de aprender.",
        audiences: [
          { id: "aud-colegios", icon: "school", title: "Colegios y academias", text: "Programas, laboratorios y dotación." },
          { id: "aud-docentes", icon: "graduation", title: "Docentes y formadores", text: "Rutas, libros y acompañamiento." },
          { id: "aud-familias", icon: "users", title: "Familias y estudiantes", text: "Kits y proyectos para aprender haciendo." },
          { id: "aud-fundaciones", icon: "sparkles", title: "Fundaciones y aliados", text: "Proyectos de impacto y cobertura." },
        ],
        logosTitle: "Colegios que confían en Alesya",
        logos: [
          { id: "logo-lideres", image: "/media/clientes/lideres-del-manana.png", name: "Gimnasio Líderes del Mañana" },
          { id: "logo-finlandes", image: "/media/clientes/colegio-finlandes.png", name: "Colegio Finlandés Juan Pablo II" },
          { id: "logo-meryland", image: "/media/clientes/meryland.png", name: "Nuevo Gimnasio Campestre Meryland Bilingüe" },
          { id: "logo-anunciacion", image: "/media/clientes/la-anunciacion.png", name: "Instituto La Anunciación" },
          { id: "logo-mayor-andino", image: "/media/clientes/mayor-andino.jpg", name: "Colegio Mayor Andino" },
          { id: "logo-alcibiades", image: "/media/clientes/alcibiades-florez.jpg", name: "Gimnasio Alcibíades Flórez" },
          { id: "logo-ninos-felices", image: "/media/clientes/ninos-felices.png", name: "Colegio Niños Felices" },
          { id: "logo-gs", image: "/media/clientes/gs.jpg", name: "Institución aliada" },
        ],
        photos: [
          { id: "photo-ev3", image: "/media/clientes-robotica-ev3.jpeg", alt: "Estudiantes presentando proyectos de robótica educativa", caption: "Robótica que se demuestra, se comparte y se celebra." },
          { id: "photo-wedo", image: "/media/clientes-lego-wedo.jpeg", alt: "Estudiante construyendo un proyecto con LEGO WeDo", caption: "Aprendizaje activo desde los primeros mecanismos." },
        ],
      },
      {
        id: "institutional", type: "institutional", enabled: true, eyebrow: "Para colegios y organizaciones", title: "No entregamos cajas.", accent: "Construimos capacidad.", intro: "Diseñamos programas de robótica y cultura maker con diagnóstico, dotación, formación docente, contenidos y seguimiento.",
        bullets: [{ id: "inst-1", icon: "shield", text: "Implementación acompañada" }, { id: "inst-2", icon: "graduation", text: "Formación para docentes" }, { id: "inst-3", icon: "sparkles", text: "Proyectos adaptados al contexto" }],
        video: "/media/impresion-3d.mp4", image: "", showForm: true,
      },
    ],
  };
}

/** Bloque nuevo con contenido de ejemplo, listo para editar. Los únicos vuelven con su diseño original. */
export function createSection(type: HomeSectionType): HomeSection {
  const original = defaultHomeDocument().sections.find((section) => section.type === type);
  if (original) return { ...original, id: newId() };
  const id = newId();
  switch (type) {
    case "band": return { id, type, enabled: true, phrases: ["Nueva frase.", "Otra idea.", "Lo que quieras destacar."] };
    case "story": return { id, type, enabled: true, eyebrow: "Proyecto destacado", kicker: "", title: "Título del proyecto.", text: "Cuenta en dos líneas qué se construye y qué se aprende.", video: "", image: "", meta: [{ id: newId(), label: "Edad", value: "10+" }, { id: newId(), label: "Duración", value: "4 sesiones" }, { id: newId(), label: "Nivel", value: "Inicial" }], linkLabel: "Ver ruta completa", linkHref: "/proyectos" };
    case "banner": return { id, type, enabled: true, eyebrow: "Novedad", title: "Un título que invite", accent: "a la acción.", text: "Texto breve del anuncio o la campaña.", image: "", video: "", buttonLabel: "Conocer más", buttonHref: "/catalogo", theme: "dark", layout: "media-right" };
    case "slider": return { id, type, enabled: true, eyebrow: "Galería", title: "Momentos que inspiran", intro: "", autoplay: true, slides: [{ id: newId(), image: "/media/clientes-robotica-ev3.jpeg", title: "Primera diapositiva", text: "", href: "" }, { id: newId(), image: "/media/clientes-lego-wedo.jpeg", title: "Segunda diapositiva", text: "", href: "" }] };
    case "text": return { id, type, enabled: true, eyebrow: "", title: "Título de la sección", accent: "", body: "Escribe aquí uno o varios párrafos. Cada salto de línea es un párrafo nuevo.", buttonLabel: "", buttonHref: "", align: "left" };
    case "gallery": return { id, type, enabled: true, eyebrow: "Galería", title: "En el aula", columns: 3, items: [{ id: newId(), image: "/media/clientes-robotica-ev3.jpeg", caption: "" }, { id: newId(), image: "/media/clientes-lego-wedo.jpeg", caption: "" }] };
  }
  throw new Error(`Bloque desconocido: ${type}`);
}

/** Resumen de una sección para la lista del editor. */
export function describeSection(section: HomeSection) {
  switch (section.type) {
    case "hero": return `${section.slides.length} diapositiva${section.slides.length === 1 ? "" : "s"}`;
    case "band": return section.phrases.filter(Boolean).join(" · ");
    case "categories": return `${section.title} ${section.accent}`.trim() || `${section.items.length} tarjetas`;
    case "story": return section.title;
    case "paths": return `${section.items.length} rutas`;
    case "store": return `${section.limit} productos destacados`;
    case "clients": return `${section.logos.length} logos · ${section.photos.length} fotos`;
    case "institutional": return `${section.title} ${section.accent}`.trim();
    case "banner": return `${section.title} ${section.accent}`.trim();
    case "slider": return `${section.slides.length} diapositivas`;
    case "text": return section.title;
    case "gallery": return `${section.items.length} fotos`;
  }
}

/** Párrafos a partir de texto con saltos de línea (sin HTML). */
export const paragraphs = (value: string) => value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
