"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Clapperboard, Copy, Eye, EyeOff, GalleryHorizontal, History, Images, LayoutGrid, ListOrdered, Loader2, Megaphone, Minus, MonitorPlay, Plus, Rocket, RotateCcw, School, ShoppingBag, Trash2, Type, Undo2, Users, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Drawer, PageHeader, useDebounced } from "@/components/admin/kit";
import { SectionForm } from "@/components/admin/pages/section-forms";
import { formatDateTime } from "@/lib/format";
import { blockCatalog, blockTypes, createSection, describeSection, newId, type HomeDocument, type HomeSection, type HomeSectionType } from "@/lib/pages/home-schema";

type Revision = { id: string; createdAt: string; createdBy: string | null };
type State = { draft: HomeDocument; published: HomeDocument | null; dirty: boolean; draftUpdatedAt: string | null; publishedAt: string | null; updatedBy: string | null; revisions: Revision[] };
type SaveState = { status: "idle" | "saving" | "saved" | "error"; message?: string };

const typeIcons: Record<HomeSectionType, LucideIcon> = { hero: MonitorPlay, band: Minus, categories: LayoutGrid, story: Clapperboard, paths: ListOrdered, store: ShoppingBag, clients: Users, institutional: School, banner: Megaphone, slider: GalleryHorizontal, text: Type, gallery: Images };

async function request<T>(method: "GET" | "PUT" | "POST", body?: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const response = await fetch("/api/admin/pages/home", { method, cache: "no-store", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({})) as T & { message?: string };
    return response.ok ? { ok: true, data } : { ok: false, message: data.message ?? "No se pudo completar la acción." };
  } catch { return { ok: false, message: "Sin conexión con el servidor. Intenta de nuevo." }; }
}

/** Copia de una sección con identificadores nuevos (también los de sus elementos), para duplicar bloques. */
function cloneSection(section: HomeSection): HomeSection {
  const copy = JSON.parse(JSON.stringify(section)) as Record<string, unknown>;
  copy.id = newId();
  for (const value of Object.values(copy)) if (Array.isArray(value)) for (const item of value) if (item && typeof item === "object" && "id" in item) (item as { id: string }).id = newId();
  return copy as unknown as HomeSection;
}

/**
 * Editor de la portada. El borrador se guarda solo poco después de cada cambio; «Publicar» lo
 * convierte en lo que ve el público y guarda una versión en el historial.
 */
export function HomeEditor() {
  const [state, setState] = useState<State | null>(null);
  const [loadError, setLoadError] = useState("");
  const [doc, setDoc] = useState<HomeDocument | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const [busy, setBusy] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  /** JSON del último borrador guardado: la ref la usa el guardado asíncrono y el estado, el render. */
  const [savedJson, setSavedJson] = useState("");
  const lastSaved = useRef("");
  const inflight = useRef<Promise<boolean> | null>(null);
  const markSaved = useCallback((body: string) => { lastSaved.current = body; setSavedJson(body); }, []);

  const apply = useCallback((next: State) => { setState(next); setDoc(next.draft); markSaved(JSON.stringify(next.draft)); setSave({ status: "idle" }); }, [markSaved]);

  useEffect(() => {
    let cancelled = false;
    void request<State>("GET").then((result) => { if (cancelled) return; if (result.ok) apply(result.data); else setLoadError(result.message); });
    return () => { cancelled = true; };
  }, [apply]);

  const json = useMemo(() => (doc ? JSON.stringify(doc) : ""), [doc]);
  const unsaved = json !== "" && json !== savedJson;
  const debounced = useDebounced(json, 1200);

  const persist = useCallback(async (body: string): Promise<boolean> => {
    if (inflight.current) await inflight.current;
    if (body === lastSaved.current) return true;
    const run = (async () => {
      setSave({ status: "saving" });
      const result = await request<{ draftUpdatedAt: string; dirty: boolean }>("PUT", { document: JSON.parse(body) });
      if (!result.ok) { setSave({ status: "error", message: result.message }); return false; }
      markSaved(body);
      setSave({ status: "saved" });
      setState((previous) => previous && { ...previous, draftUpdatedAt: result.data.draftUpdatedAt, dirty: result.data.dirty });
      return true;
    })();
    inflight.current = run;
    try { return await run; } finally { inflight.current = null; }
  }, [markSaved]);

  useEffect(() => { if (debounced && debounced !== lastSaved.current) void persist(debounced); }, [debounced, persist]);

  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  async function act(action: "publish" | "discard" | "reset" | "restore", extra: Record<string, unknown> = {}, success?: string, flushFirst = false) {
    setBusy(true);
    if (flushFirst) {
      const flushed = unsaved ? await persist(json) : inflight.current ? await inflight.current : true;
      if (!flushed) { setBusy(false); toast.error("Corrige el borrador antes de publicar."); return; }
    }
    const result = await request<State>("POST", { action, ...extra });
    setBusy(false);
    if (!result.ok) { toast.error(result.message); return; }
    apply(result.data);
    if (success) toast.success(success);
  }

  const patch = (id: string, next: HomeSection) => setDoc((current) => current && { ...current, sections: current.sections.map((section) => (section.id === id ? next : section)) });
  const toggle = (id: string) => setDoc((current) => current && { ...current, sections: current.sections.map((section) => (section.id === id ? { ...section, enabled: !section.enabled } : section)) });
  const move = (index: number, delta: number) => setDoc((current) => {
    if (!current) return current;
    const target = index + delta;
    if (target < 0 || target >= current.sections.length) return current;
    const sections = [...current.sections];
    [sections[index], sections[target]] = [sections[target], sections[index]];
    return { ...current, sections };
  });
  const remove = (section: HomeSection) => { if (window.confirm(`¿Eliminar el bloque «${blockCatalog[section.type].label}»?`)) setDoc((current) => current && { ...current, sections: current.sections.filter((item) => item.id !== section.id) }); };
  const duplicate = (index: number) => setDoc((current) => { if (!current) return current; const sections = [...current.sections]; sections.splice(index + 1, 0, cloneSection(sections[index])); return { ...current, sections }; });
  const add = (type: HomeSectionType) => {
    const section = createSection(type);
    setDoc((current) => current && { ...current, sections: [...current.sections, section] });
    setOpen(section.id);
    window.setTimeout(() => document.getElementById(`block-${section.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  if (loadError) return <><PageHeader title="Portada" /><p className="checkout-status">{loadError}</p></>;
  if (!state || !doc) return <><PageHeader title="Portada" /><p className="adm-muted">Cargando…</p></>;

  const canPublish = (state.dirty || unsaved) && !busy;
  const addable = blockTypes.filter((type) => !blockCatalog[type].unique || !doc.sections.some((section) => section.type === type));
  const saveLabel = unsaved || save.status === "saving" ? <><Loader2 size={14} className="adm-spin" /> Guardando borrador…</>
    : save.status === "error" ? <><AlertTriangle size={14} /> {save.message}</>
    : state.draftUpdatedAt ? <><Check size={14} /> Borrador guardado {formatDateTime(state.draftUpdatedAt)}</> : <>Sin cambios en el borrador</>;

  return <div className="adm-editor adm-form">
    <PageHeader title="Portada" description="Edita los bloques, textos, imágenes y videos de la página de inicio. Los cambios se guardan como borrador y solo se ven en la web cuando publicas.">
      <a className="refresh-button" href="/?vista=borrador" target="_blank" rel="noreferrer"><Eye size={14} /> Vista previa</a>
      <button type="button" className="refresh-button" disabled={!state.dirty || busy} onClick={() => { if (window.confirm("¿Descartar los cambios del borrador? Volverá a lo que está publicado.")) void act("discard", {}, "Borrador descartado."); }}><Undo2 size={14} /> Descartar cambios</button>
      <button type="button" className="button button-dark" disabled={!canPublish} onClick={() => void act("publish", {}, "Portada publicada. Ya está visible en la web.", true)}><Rocket size={15} /> {busy ? "Un momento…" : "Publicar"}</button>
    </PageHeader>

    <div className="adm-editor-status">
      <span className={`adm-save-state is-${unsaved ? "saving" : save.status}`}>{saveLabel}</span>
      <span>{state.publishedAt ? `Publicada ${formatDateTime(state.publishedAt)}` : "Nunca publicada: la web muestra el diseño original."}</span>
      <button type="button" className="adm-link-button" onClick={() => setRevisionsOpen(true)}><History size={13} /> Versiones anteriores ({state.revisions.length})</button>
      <button type="button" className="adm-link-button" onClick={() => { if (window.confirm("¿Cargar el diseño original en el borrador? Tus cambios actuales se perderán (lo publicado no cambia hasta que publiques).")) void act("reset", {}, "Diseño original cargado en el borrador."); }}><RotateCcw size={13} /> Restaurar diseño original</button>
      {(state.dirty || unsaved) && <span className="status-pill" data-status="payment_review">Cambios sin publicar</span>}
    </div>

    <ol className="adm-blocks">
      {doc.sections.map((section, index) => {
        const Icon = typeIcons[section.type];
        const meta = blockCatalog[section.type];
        const expanded = open === section.id;
        return <li key={section.id} id={`block-${section.id}`} className={`adm-block${section.enabled ? "" : " is-hidden"}${expanded ? " is-open" : ""}`}>
          <header className="adm-block-head">
            <button type="button" className="adm-block-title" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : section.id)}>
              <Icon size={20} strokeWidth={1.8} />
              <span><strong>{meta.label}{!section.enabled && <em> · oculto</em>}</strong><small>{describeSection(section)}</small></span>
              <ChevronDown size={16} />
            </button>
            <div className="adm-block-tools">
              <button type="button" aria-label="Subir bloque" title="Subir" disabled={index === 0} onClick={() => move(index, -1)}><ChevronUp size={16} /></button>
              <button type="button" aria-label="Bajar bloque" title="Bajar" disabled={index === doc.sections.length - 1} onClick={() => move(index, 1)}><ChevronDown size={16} /></button>
              <button type="button" aria-label={section.enabled ? "Ocultar bloque" : "Mostrar bloque"} title={section.enabled ? "Ocultar en la web" : "Mostrar en la web"} aria-pressed={!section.enabled} onClick={() => toggle(section.id)}>{section.enabled ? <Eye size={16} /> : <EyeOff size={16} />}</button>
              {!meta.unique && <button type="button" aria-label="Duplicar bloque" title="Duplicar" onClick={() => duplicate(index)}><Copy size={16} /></button>}
              {!meta.unique && <button type="button" aria-label="Eliminar bloque" title="Eliminar" className="is-danger" onClick={() => remove(section)}><Trash2 size={16} /></button>}
            </div>
          </header>
          {expanded && <div className="adm-block-body"><SectionForm section={section} onChange={(next) => patch(section.id, next)} /></div>}
        </li>;
      })}
    </ol>

    <section className="adm-block-picker">
      <h2><Plus size={16} /> Agregar bloque</h2>
      <p>El bloque nuevo se añade al final; luego puedes subirlo con las flechas.</p>
      <div className="adm-block-options">
        {addable.map((type) => { const Icon = typeIcons[type]; return <button type="button" key={type} onClick={() => add(type)}><Icon size={20} strokeWidth={1.8} /><strong>{blockCatalog[type].label}</strong><small>{blockCatalog[type].description}</small></button>; })}
      </div>
    </section>

    <Drawer open={revisionsOpen} title="Versiones publicadas" subtitle="Cargar una versión la pone en el borrador; revísala con la vista previa y publícala si te sirve." onClose={() => setRevisionsOpen(false)}>
      {state.revisions.length ? <ol className="adm-revisions">
        {state.revisions.map((revision, index) => <li key={revision.id}>
          <div><strong>{formatDateTime(revision.createdAt)}</strong>{index === 0 && " · actual"}<small>{revision.createdBy ?? "—"}</small></div>
          <button type="button" className="refresh-button" disabled={busy} onClick={() => { if (window.confirm("¿Cargar esta versión en el borrador? Tus cambios sin publicar se reemplazan.")) { setRevisionsOpen(false); void act("restore", { revisionId: revision.id }, "Versión cargada en el borrador."); } }}>Cargar</button>
        </li>)}
      </ol> : <p className="adm-muted">Todavía no hay versiones publicadas.</p>}
    </Drawer>
  </div>;
}
