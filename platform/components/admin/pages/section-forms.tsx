"use client";

import { createElement, type ReactNode, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { MediaField, MediaPreview, type MediaKind } from "@/components/admin/pages/media-field";
import { homeIcon, homeIcons } from "@/lib/pages/icons";
import { newId, signalColors, type HomeSection, type SectionOf } from "@/lib/pages/home-schema";

type Patch<T> = (patch: Partial<T>) => void;
const LINK_HINT = "Ruta del sitio (/catalogo, /proyectos, #clientes) o dirección https.";

// ── Campos ───────────────────────────────────────────────────────────────────

function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: ReactNode }) {
  return <label className={wide ? "adm-span-2" : undefined}>{label}{children}{hint && <small>{hint}</small>}</label>;
}
function TextField({ label, value, onChange, maxLength = 160, placeholder, hint, wide }: { label: string; value: string; onChange: (value: string) => void; maxLength?: number; placeholder?: string; hint?: string; wide?: boolean }) {
  return <Field label={label} hint={hint} wide={wide}><input value={value} onChange={(event) => onChange(event.target.value)} maxLength={maxLength} placeholder={placeholder} /></Field>;
}
function AreaField({ label, value, onChange, rows = 3, maxLength = 600, hint, wide = true }: { label: string; value: string; onChange: (value: string) => void; rows?: number; maxLength?: number; hint?: string; wide?: boolean }) {
  return <Field label={label} hint={hint} wide={wide}><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} maxLength={maxLength} /></Field>;
}
const LinkField = (props: { label: string; value: string; onChange: (value: string) => void; hint?: string }) => <TextField {...props} maxLength={500} placeholder="/catalogo" hint={props.hint ?? LINK_HINT} />;
function SelectField({ label, value, onChange, options, hint }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; hint?: string }) {
  return <Field label={label} hint={hint}><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>;
}
function CheckField({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (value: boolean) => void; hint?: string }) {
  return <div className="adm-checks adm-span-2"><label><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> {label}</label>{hint && <small className="adm-muted">{hint}</small>}</div>;
}
function IconField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  // Los iconos vienen de un mapa fijo (no se crean al renderizar), así que createElement es seguro aquí.
  return <Field label={label}><span className="adm-icon-pick">{createElement(homeIcon(value), { size: 18 })}<select value={homeIcons[value] ? value : "sparkles"} onChange={(event) => onChange(event.target.value)}>{Object.entries(homeIcons).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}</select></span></Field>;
}
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Field label={label}><span className="adm-color-field">
    <input type="color" value={value || "#d7ff43"} onChange={(event) => onChange(event.target.value)} aria-label={label} />
    <span className="adm-swatches">{signalColors.map((color) => <button type="button" key={color.value} title={color.label} aria-label={color.label} aria-pressed={value.toLowerCase() === color.value} style={{ background: color.value }} onClick={() => onChange(color.value)} />)}</span>
  </span></Field>;
}
const Media = (props: { label: string; kind: MediaKind; value: string; onChange: (value: string) => void; hint?: string }) => <div className="adm-span-2"><MediaField {...props} /></div>;

/** Lista de elementos (diapositivas, tarjetas, logos…): ordenar, abrir uno para editarlo, quitar y agregar. */
function ListEditor<T extends { id: string }>({ label, items, onChange, create, max, title, thumb, children }: { label: string; items: T[]; onChange: (items: T[]) => void; create: () => T; max: number; title: (item: T, index: number) => string; thumb?: (item: T) => { url: string; kind: MediaKind } | null; children: (item: T, patch: Patch<T>) => ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  const update = (index: number, patch: Partial<T>) => onChange(items.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  const move = (index: number, delta: number) => { const next = [...items]; const [item] = next.splice(index, 1); next.splice(index + delta, 0, item); onChange(next); };
  const remove = (index: number) => { if (window.confirm("¿Quitar este elemento?")) onChange(items.filter((_, position) => position !== index)); };
  const add = () => { const item = create(); onChange([...items, item]); setOpen(item.id); };
  return <div className="adm-list-editor adm-span-2">
    <div className="adm-list-head"><strong>{label}</strong><span className="adm-muted">{items.length} de {max}</span></div>
    {items.length > 0 && <ol className="adm-list">
      {items.map((item, index) => {
        const expanded = open === item.id;
        const preview = thumb?.(item);
        return <li key={item.id} className={expanded ? "is-open" : undefined}>
          <div className="adm-list-row">
            <button type="button" className="adm-list-title" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : item.id)}>
              {preview && <span className="adm-list-thumb"><MediaPreview url={preview.url} kind={preview.kind} /></span>}
              <span><small>{index + 1}</small>{title(item, index) || "Sin título"}</span><ChevronDown size={16} />
            </button>
            <span className="adm-list-tools">
              <button type="button" aria-label="Subir" disabled={index === 0} onClick={() => move(index, -1)}><ChevronUp size={15} /></button>
              <button type="button" aria-label="Bajar" disabled={index === items.length - 1} onClick={() => move(index, 1)}><ChevronDown size={15} /></button>
              <button type="button" aria-label="Quitar" className="is-danger" onClick={() => remove(index)}><Trash2 size={15} /></button>
            </span>
          </div>
          {expanded && <div className="adm-list-body adm-form-grid">{children(item, (patch) => update(index, patch))}</div>}
        </li>;
      })}
    </ol>}
    {items.length < max && <button type="button" className="refresh-button" onClick={add}><Plus size={14} /> Agregar</button>}
  </div>;
}

function PhrasesField({ label, items, onChange, max }: { label: string; items: string[]; onChange: (items: string[]) => void; max: number }) {
  return <div className="adm-list-editor adm-span-2">
    <div className="adm-list-head"><strong>{label}</strong><span className="adm-muted">{items.length} de {max}</span></div>
    <div className="adm-phrases">
      {items.map((phrase, index) => <div key={index}><input value={phrase} maxLength={90} onChange={(event) => onChange(items.map((item, position) => (position === index ? event.target.value : item)))} /><button type="button" className="adm-icon-button" aria-label="Quitar frase" onClick={() => onChange(items.filter((_, position) => position !== index))}><Trash2 size={15} /></button></div>)}
    </div>
    {items.length < max && <button type="button" className="refresh-button" onClick={() => onChange([...items, ""])}><Plus size={14} /> Agregar frase</button>}
  </div>;
}

const mediaThumb = (item: { video?: string; image: string }) => (item.video ? { url: item.video, kind: "video" as const } : item.image ? { url: item.image, kind: "image" as const } : null);

// ── Formularios por tipo de bloque ───────────────────────────────────────────

type FormProps<T extends HomeSection> = { section: T; set: Patch<T> };

/** Formulario de una sección. Cada cambio produce la sección completa actualizada. */
export function SectionForm({ section, onChange }: { section: HomeSection; onChange: (section: HomeSection) => void }) {
  const set = (patch: Partial<HomeSection>) => onChange({ ...section, ...patch } as HomeSection);
  switch (section.type) {
    case "hero": return <HeroForm section={section} set={set} />;
    case "band": return <div className="adm-form-grid"><PhrasesField label="Frases" items={section.phrases} onChange={(phrases) => set({ phrases })} max={6} /><p className="adm-hint adm-span-2">La última frase se muestra en negrita con un destello. En celulares solo se ve la última.</p></div>;
    case "categories": return <CategoriesForm section={section} set={set} />;
    case "story": return <StoryForm section={section} set={set} />;
    case "paths": return <PathsForm section={section} set={set} />;
    case "store": return <StoreForm section={section} set={set} />;
    case "clients": return <ClientsForm section={section} set={set} />;
    case "institutional": return <InstitutionalForm section={section} set={set} />;
    case "banner": return <BannerForm section={section} set={set} />;
    case "slider": return <SliderForm section={section} set={set} />;
    case "text": return <TextForm section={section} set={set} />;
    case "gallery": return <GalleryForm section={section} set={set} />;
  }
}

function HeroForm({ section, set }: FormProps<SectionOf<"hero">>) {
  return <div className="adm-form-grid">
    <TextField label="Texto de la esquina (línea 1)" value={section.captionTop} onChange={(captionTop) => set({ captionTop })} maxLength={60} />
    <TextField label="Texto de la esquina (línea 2)" value={section.captionBottom} onChange={(captionBottom) => set({ captionBottom })} maxLength={90} />
    <Media label="Imagen de espera" kind="image" value={section.poster} onChange={(poster) => set({ poster })} hint="Se ve mientras carga el video y cuando una diapositiva no tiene video ni imagen propia." />
    <ListEditor label="Diapositivas (mundos)" items={section.slides} onChange={(slides) => set({ slides })} max={8} title={(slide) => slide.name || slide.title} thumb={mediaThumb}
      create={() => ({ id: newId(), name: "Nuevo mundo", label: "", title: "Título de la diapositiva", accent: "", description: "", video: "", image: "", color: "#d7ff43", primaryLabel: "Empieza a explorar", primaryHref: "/proyectos", secondaryLabel: "Encuentra tu kit", secondaryHref: "/catalogo" })}>
      {(slide, patch) => <>
        <TextField label="Nombre (pestaña abajo)" value={slide.name} onChange={(name) => patch({ name })} maxLength={40} />
        <TextField label="Frase corta (sobre el título)" value={slide.label} onChange={(label) => patch({ label })} maxLength={90} />
        <TextField label="Título" value={slide.title} onChange={(title) => patch({ title })} maxLength={120} />
        <TextField label="Título, segunda línea (en color)" value={slide.accent} onChange={(accent) => patch({ accent })} maxLength={120} />
        <AreaField label="Descripción" value={slide.description} onChange={(description) => patch({ description })} maxLength={400} />
        <Media label="Video de fondo" kind="video" value={slide.video} onChange={(video) => patch({ video })} />
        <Media label="Imagen de fondo" kind="image" value={slide.image} onChange={(image) => patch({ image })} hint="Se usa si no hay video, y como imagen de espera del video." />
        <ColorField label="Color de acento" value={slide.color} onChange={(color) => patch({ color })} />
        <span />
        <TextField label="Botón principal" value={slide.primaryLabel} onChange={(primaryLabel) => patch({ primaryLabel })} maxLength={60} />
        <LinkField label="Enlace del botón principal" value={slide.primaryHref} onChange={(primaryHref) => patch({ primaryHref })} />
        <TextField label="Enlace secundario (texto)" value={slide.secondaryLabel} onChange={(secondaryLabel) => patch({ secondaryLabel })} maxLength={60} />
        <LinkField label="Enlace secundario (destino)" value={slide.secondaryHref} onChange={(secondaryHref) => patch({ secondaryHref })} />
      </>}
    </ListEditor>
  </div>;
}

function CategoriesForm({ section, set }: FormProps<SectionOf<"categories">>) {
  return <div className="adm-form-grid">
    <TextField label="Antetítulo" value={section.eyebrow} onChange={(eyebrow) => set({ eyebrow })} maxLength={90} />
    <span />
    <TextField label="Título" value={section.title} onChange={(title) => set({ title })} maxLength={120} />
    <TextField label="Título, segunda línea (en color)" value={section.accent} onChange={(accent) => set({ accent })} maxLength={120} />
    <AreaField label="Texto de apoyo" value={section.intro} onChange={(intro) => set({ intro })} maxLength={400} rows={2} />
    <ListEditor label="Tarjetas" items={section.items} onChange={(items) => set({ items })} max={12} title={(item) => item.title} create={() => ({ id: newId(), icon: "sparkles", title: "Nueva categoría", copy: "", color: "#d7ff43", href: "/proyectos" })}>
      {(item, patch) => <>
        <TextField label="Título" value={item.title} onChange={(title) => patch({ title })} maxLength={60} />
        <IconField label="Icono" value={item.icon} onChange={(icon) => patch({ icon })} />
        <AreaField label="Texto" value={item.copy} onChange={(copy) => patch({ copy })} maxLength={200} rows={2} />
        <ColorField label="Color al pasar el cursor" value={item.color} onChange={(color) => patch({ color })} />
        <LinkField label="Enlace" value={item.href} onChange={(href) => patch({ href })} />
      </>}
    </ListEditor>
  </div>;
}

function StoryForm({ section, set }: FormProps<SectionOf<"story">>) {
  return <div className="adm-form-grid">
    <TextField label="Antetítulo" value={section.eyebrow} onChange={(eyebrow) => set({ eyebrow })} maxLength={90} />
    <TextField label="Numeración (p. ej. 01 / 04)" value={section.kicker} onChange={(kicker) => set({ kicker })} maxLength={30} hint="Solo se ve en pantallas grandes. Déjalo vacío para ocultarlo." />
    <TextField label="Título" value={section.title} onChange={(title) => set({ title })} maxLength={160} wide />
    <AreaField label="Texto" value={section.text} onChange={(text) => set({ text })} maxLength={600} />
    <Media label="Video" kind="video" value={section.video} onChange={(video) => set({ video })} />
    <Media label="Imagen" kind="image" value={section.image} onChange={(image) => set({ image })} hint="Se usa si no hay video, y como imagen de espera del video." />
    <ListEditor label="Datos (edad, duración, nivel…)" items={section.meta} onChange={(meta) => set({ meta })} max={4} title={(item) => `${item.label}: ${item.value}`} create={() => ({ id: newId(), label: "Dato", value: "" })}>
      {(item, patch) => <><TextField label="Etiqueta" value={item.label} onChange={(label) => patch({ label })} maxLength={30} /><TextField label="Valor" value={item.value} onChange={(value) => patch({ value })} maxLength={60} /></>}
    </ListEditor>
    <TextField label="Texto del enlace" value={section.linkLabel} onChange={(linkLabel) => set({ linkLabel })} maxLength={60} />
    <LinkField label="Destino del enlace" value={section.linkHref} onChange={(linkHref) => set({ linkHref })} />
  </div>;
}

function PathsForm({ section, set }: FormProps<SectionOf<"paths">>) {
  return <div className="adm-form-grid">
    <TextField label="Antetítulo" value={section.eyebrow} onChange={(eyebrow) => set({ eyebrow })} maxLength={90} />
    <TextField label="Título" value={section.title} onChange={(title) => set({ title })} maxLength={120} />
    <TextField label="Texto del enlace" value={section.linkLabel} onChange={(linkLabel) => set({ linkLabel })} maxLength={60} />
    <LinkField label="Destino del enlace" value={section.linkHref} onChange={(linkHref) => set({ linkHref })} />
    <ListEditor label="Rutas" items={section.items} onChange={(items) => set({ items })} max={12} title={(item) => item.title} create={() => ({ id: newId(), title: "Nueva ruta", detail: "", level: "Inicial", href: "/proyectos" })}>
      {(item, patch) => <>
        <TextField label="Título" value={item.title} onChange={(title) => patch({ title })} maxLength={90} />
        <TextField label="Detalle (tecnologías)" value={item.detail} onChange={(detail) => patch({ detail })} maxLength={90} />
        <TextField label="Nivel" value={item.level} onChange={(level) => patch({ level })} maxLength={30} />
        <LinkField label="Enlace" value={item.href} onChange={(href) => patch({ href })} />
      </>}
    </ListEditor>
  </div>;
}

function StoreForm({ section, set }: FormProps<SectionOf<"store">>) {
  return <div className="adm-form-grid">
    <TextField label="Antetítulo" value={section.eyebrow} onChange={(eyebrow) => set({ eyebrow })} maxLength={90} />
    <TextField label="Título" value={section.title} onChange={(title) => set({ title })} maxLength={120} />
    <AreaField label="Texto de apoyo" value={section.intro} onChange={(intro) => set({ intro })} maxLength={400} rows={2} />
    <TextField label="Botón" value={section.buttonLabel} onChange={(buttonLabel) => set({ buttonLabel })} maxLength={60} />
    <LinkField label="Destino del botón" value={section.buttonHref} onChange={(buttonHref) => set({ buttonHref })} />
    <SelectField label="Cuántos productos mostrar" value={String(section.limit)} onChange={(value) => set({ limit: Number(value) })} options={[1, 2, 3, 4, 6, 8].map((value) => ({ value: String(value), label: `${value}` }))} />
    <AreaField label="Mensaje cuando no hay productos publicados" value={section.emptyText} onChange={(emptyText) => set({ emptyText })} maxLength={300} rows={2} />
    <p className="adm-hint adm-span-2">Los productos se eligen en <strong>Productos e inventario</strong> marcándolos como destacados; si faltan, se completan con los últimos publicados con foto.</p>
  </div>;
}

function ClientsForm({ section, set }: FormProps<SectionOf<"clients">>) {
  return <div className="adm-form-grid">
    <TextField label="Antetítulo" value={section.eyebrow} onChange={(eyebrow) => set({ eyebrow })} maxLength={90} />
    <span />
    <TextField label="Título" value={section.title} onChange={(title) => set({ title })} maxLength={160} wide />
    <AreaField label="Texto de apoyo" value={section.intro} onChange={(intro) => set({ intro })} maxLength={400} rows={2} />
    <ListEditor label="Tipos de cliente" items={section.audiences} onChange={(audiences) => set({ audiences })} max={8} title={(item) => item.title} create={() => ({ id: newId(), icon: "users", title: "Nuevo público", text: "" })}>
      {(item, patch) => <><TextField label="Título" value={item.title} onChange={(title) => patch({ title })} maxLength={60} /><IconField label="Icono" value={item.icon} onChange={(icon) => patch({ icon })} /><TextField label="Texto" value={item.text} onChange={(text) => patch({ text })} maxLength={120} wide /></>}
    </ListEditor>
    <TextField label="Título de los logos" value={section.logosTitle} onChange={(logosTitle) => set({ logosTitle })} maxLength={90} wide />
    <ListEditor label="Logos de colegios" items={section.logos} onChange={(logos) => set({ logos })} max={24} title={(item) => item.name} thumb={mediaThumb} create={() => ({ id: newId(), image: "", name: "Nuevo colegio" })}>
      {(item, patch) => <><TextField label="Nombre" value={item.name} onChange={(name) => patch({ name })} maxLength={120} wide /><Media label="Logo" kind="image" value={item.image} onChange={(image) => patch({ image })} hint="Cuadrado, idealmente PNG con fondo transparente." /></>}
    </ListEditor>
    <ListEditor label="Fotos (la primera es la grande)" items={section.photos} onChange={(photos) => set({ photos })} max={4} title={(item) => item.caption || item.alt} thumb={mediaThumb} create={() => ({ id: newId(), image: "", alt: "", caption: "" })}>
      {(item, patch) => <><Media label="Foto" kind="image" value={item.image} onChange={(image) => patch({ image })} /><TextField label="Pie de foto" value={item.caption} onChange={(caption) => patch({ caption })} maxLength={160} /><TextField label="Descripción para accesibilidad" value={item.alt} onChange={(alt) => patch({ alt })} maxLength={160} /></>}
    </ListEditor>
  </div>;
}

function InstitutionalForm({ section, set }: FormProps<SectionOf<"institutional">>) {
  return <div className="adm-form-grid">
    <TextField label="Antetítulo" value={section.eyebrow} onChange={(eyebrow) => set({ eyebrow })} maxLength={90} />
    <span />
    <TextField label="Título" value={section.title} onChange={(title) => set({ title })} maxLength={120} />
    <TextField label="Título, segunda línea (en color)" value={section.accent} onChange={(accent) => set({ accent })} maxLength={120} />
    <AreaField label="Texto" value={section.intro} onChange={(intro) => set({ intro })} maxLength={500} />
    <ListEditor label="Puntos clave" items={section.bullets} onChange={(bullets) => set({ bullets })} max={6} title={(item) => item.text} create={() => ({ id: newId(), icon: "sparkles", text: "Nuevo punto" })}>
      {(item, patch) => <><TextField label="Texto" value={item.text} onChange={(text) => patch({ text })} maxLength={90} /><IconField label="Icono" value={item.icon} onChange={(icon) => patch({ icon })} /></>}
    </ListEditor>
    <Media label="Video" kind="video" value={section.video} onChange={(video) => set({ video })} />
    <Media label="Imagen" kind="image" value={section.image} onChange={(image) => set({ image })} hint="Se usa si no hay video." />
    <CheckField label="Mostrar el formulario de diagnóstico" checked={section.showForm} onChange={(showForm) => set({ showForm })} hint="Los envíos entran al CRM como contactos nuevos." />
  </div>;
}

function BannerForm({ section, set }: FormProps<SectionOf<"banner">>) {
  return <div className="adm-form-grid">
    <TextField label="Antetítulo" value={section.eyebrow} onChange={(eyebrow) => set({ eyebrow })} maxLength={90} />
    <span />
    <TextField label="Título" value={section.title} onChange={(title) => set({ title })} maxLength={160} />
    <TextField label="Título, segunda línea (en color)" value={section.accent} onChange={(accent) => set({ accent })} maxLength={120} />
    <AreaField label="Texto" value={section.text} onChange={(text) => set({ text })} maxLength={600} />
    <Media label="Imagen" kind="image" value={section.image} onChange={(image) => set({ image })} />
    <Media label="Video (opcional, reemplaza la imagen)" kind="video" value={section.video} onChange={(video) => set({ video })} />
    <TextField label="Botón" value={section.buttonLabel} onChange={(buttonLabel) => set({ buttonLabel })} maxLength={60} />
    <LinkField label="Destino del botón" value={section.buttonHref} onChange={(buttonHref) => set({ buttonHref })} />
    <SelectField label="Estilo" value={section.theme} onChange={(theme) => set({ theme: theme as SectionOf<"banner">["theme"] })} options={[{ value: "dark", label: "Oscuro" }, { value: "light", label: "Claro" }, { value: "lime", label: "Lima (color de marca)" }]} />
    <SelectField label="Distribución" value={section.layout} onChange={(layout) => set({ layout: layout as SectionOf<"banner">["layout"] })} options={[{ value: "media-right", label: "Texto a la izquierda, imagen a la derecha" }, { value: "media-left", label: "Imagen a la izquierda, texto a la derecha" }, { value: "cover", label: "Imagen de fondo con texto encima" }]} />
  </div>;
}

function SliderForm({ section, set }: FormProps<SectionOf<"slider">>) {
  return <div className="adm-form-grid">
    <TextField label="Antetítulo" value={section.eyebrow} onChange={(eyebrow) => set({ eyebrow })} maxLength={90} />
    <TextField label="Título" value={section.title} onChange={(title) => set({ title })} maxLength={120} />
    <AreaField label="Texto de apoyo" value={section.intro} onChange={(intro) => set({ intro })} maxLength={400} rows={2} />
    <CheckField label="Pasar solo cada 6 segundos" checked={section.autoplay} onChange={(autoplay) => set({ autoplay })} hint="Se detiene al pasar el cursor y para quien tiene activada la reducción de movimiento." />
    <ListEditor label="Diapositivas" items={section.slides} onChange={(slides) => set({ slides })} max={12} title={(item) => item.title} thumb={mediaThumb} create={() => ({ id: newId(), image: "", title: "", text: "", href: "" })}>
      {(item, patch) => <>
        <Media label="Foto" kind="image" value={item.image} onChange={(image) => patch({ image })} hint="Horizontal, idealmente 1600 × 700 px." />
        <TextField label="Título" value={item.title} onChange={(title) => patch({ title })} maxLength={120} />
        <LinkField label="Enlace al hacer clic (opcional)" value={item.href} onChange={(href) => patch({ href })} />
        <AreaField label="Texto" value={item.text} onChange={(text) => patch({ text })} maxLength={300} rows={2} />
      </>}
    </ListEditor>
  </div>;
}

function TextForm({ section, set }: FormProps<SectionOf<"text">>) {
  return <div className="adm-form-grid">
    <TextField label="Antetítulo" value={section.eyebrow} onChange={(eyebrow) => set({ eyebrow })} maxLength={90} />
    <SelectField label="Alineación" value={section.align} onChange={(align) => set({ align: align as SectionOf<"text">["align"] })} options={[{ value: "left", label: "A la izquierda" }, { value: "center", label: "Centrado" }]} />
    <TextField label="Título" value={section.title} onChange={(title) => set({ title })} maxLength={160} />
    <TextField label="Título, segunda línea (en color)" value={section.accent} onChange={(accent) => set({ accent })} maxLength={120} />
    <AreaField label="Párrafos" value={section.body} onChange={(body) => set({ body })} rows={8} maxLength={4000} hint="Cada salto de línea empieza un párrafo nuevo." />
    <TextField label="Botón (opcional)" value={section.buttonLabel} onChange={(buttonLabel) => set({ buttonLabel })} maxLength={60} />
    <LinkField label="Destino del botón" value={section.buttonHref} onChange={(buttonHref) => set({ buttonHref })} />
  </div>;
}

function GalleryForm({ section, set }: FormProps<SectionOf<"gallery">>) {
  return <div className="adm-form-grid">
    <TextField label="Antetítulo" value={section.eyebrow} onChange={(eyebrow) => set({ eyebrow })} maxLength={90} />
    <TextField label="Título" value={section.title} onChange={(title) => set({ title })} maxLength={120} />
    <SelectField label="Columnas" value={String(section.columns)} onChange={(value) => set({ columns: Number(value) as SectionOf<"gallery">["columns"] })} options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }]} />
    <span />
    <ListEditor label="Fotos" items={section.items} onChange={(items) => set({ items })} max={12} title={(item) => item.caption || item.image.split("/").pop() || ""} thumb={mediaThumb} create={() => ({ id: newId(), image: "", caption: "" })}>
      {(item, patch) => <><Media label="Foto" kind="image" value={item.image} onChange={(image) => patch({ image })} /><TextField label="Pie de foto" value={item.caption} onChange={(caption) => patch({ caption })} maxLength={160} wide /></>}
    </ListEditor>
  </div>;
}
