"use client";

import { FormEvent, useRef, useState } from "react";
import { FileUp, Link2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Drawer, send } from "@/components/admin/kit";
import { defaultLevel, embedUrl, formatBytes, GRADES, resourceTypes, RESOURCE_TYPES, SUGGESTED_UNITS, uploadRules, type Grade, type Level, type ResourceType } from "@/lib/english/levels";
import type { AdminResource } from "@/lib/english/resources";

type StoredFile = { fileName: string; fileSize: number; format: string };

/** Sube con XMLHttpRequest para mostrar el avance: un libro en PDF puede pesar decenas de MB. */
function upload(file: File, type: ResourceType, onProgress: (percent: number) => void) {
  return new Promise<StoredFile>((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    const request = new XMLHttpRequest();
    request.open("POST", "/api/admin/ingles/archivos");
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onload = () => {
      const body = (() => { try { return JSON.parse(request.responseText) as Partial<StoredFile> & { message?: string }; } catch { return {}; } })();
      if (request.status >= 200 && request.status < 300 && body.fileName) resolve(body as StoredFile);
      else reject(new Error(body.message ?? (request.status === 413 ? "El archivo es demasiado grande para el servidor." : "No se pudo subir el archivo.")));
    };
    request.onerror = () => reject(new Error("Sin conexión con el servidor. Intenta de nuevo."));
    request.send(form);
  });
}

/** Ficha de un material: tipo, grado, unidad, textos, archivo o enlace de video, muestra gratis y estado. */
export function ResourceDrawer({ grade, resource, units, uploads, onClose, onSaved }: { grade: Grade; resource: AdminResource | null; units: string[]; uploads: boolean; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<ResourceType>(resource?.type ?? "book");
  const [source, setSource] = useState<"file" | "link">(resource?.externalUrl ? "link" : "file");
  const [link, setLink] = useState(resource?.externalUrl ?? "");
  const [file, setFile] = useState<StoredFile | null>(resource?.fileName ? { fileName: resource.fileName, fileSize: resource.size ?? 0, format: resource.format } : null);
  const [progress, setProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  // Archivos subidos en esta ficha que todavía no quedaron guardados: se descartan si se cierra sin guardar.
  const [pending, setPending] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const rule = uploadRules[type];
  const usesLink = type === "video" && source === "link";
  const linkOk = !link || embedUrl(link) !== null;

  function discard(names: string[]) {
    for (const name of names) void fetch(`/api/admin/ingles/archivos?archivo=${encodeURIComponent(name)}`, { method: "DELETE" }).catch(() => undefined);
  }

  function close() {
    discard(pending);
    onClose();
  }

  async function choose(selected: File | undefined) {
    if (!selected) return;
    if (selected.size > rule.maxMb * 1024 * 1024) { toast.error(`El archivo supera ${rule.maxMb} MB.`); return; }
    setProgress(0);
    try {
      const stored = await upload(selected, type, setProgress);
      // El archivo que reemplaza a otro recién subido (y no guardado) deja a ese de sobra.
      const replaced = file && pending.includes(file.fileName) ? file.fileName : null;
      if (replaced) discard([replaced]);
      setPending((names) => [...names.filter((name) => name !== replaced), stored.fileName]);
      setFile(stored);
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo subir el archivo."); }
    finally { setProgress(null); if (input.current) input.current.value = ""; }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (usesLink && !embedUrl(link)) { toast.error("Pega un enlace de YouTube o Vimeo válido."); return; }
    if (!usesLink && !file) { toast.error("Sube el archivo del material."); return; }
    setSaving(true);
    const body = {
      grade: Number(form.get("grade")), type, title: String(form.get("title") ?? ""), unit: String(form.get("unit") ?? ""), description: String(form.get("description") ?? ""),
      free: form.get("free") === "on", status: form.get("status") === "published" ? "published" : "draft",
      fileName: usesLink ? null : file?.fileName ?? null, fileSize: usesLink ? null : file?.fileSize ?? null, externalUrl: usesLink ? link : null,
    };
    const result = resource
      ? await send(`/api/admin/ingles/recursos/${resource.id}`, "PUT", body, "Material guardado.")
      : await send("/api/admin/ingles/recursos", "POST", body, body.status === "published" ? "Material publicado." : "Material guardado como borrador.");
    setSaving(false);
    if (!result) return;
    // Lo que se subió y no quedó en el material (p. ej. se cambió a enlace) se descarta.
    discard(pending.filter((name) => name !== body.fileName));
    setPending([]);
    onSaved();
  }

  // Al cambiar de tipo, un archivo ya subido puede no servir (un PDF no es un audio): se pide de nuevo.
  function changeType(next: ResourceType) {
    setType(next);
    if (next !== "video") setSource("file");
    if (file && !uploadRules[next].accept.toUpperCase().includes(`.${file.format}`)) setFile(null);
  }

  return <Drawer open title={resource ? "Editar material" : "Nuevo material"} subtitle={resource ? resource.title : "Libro, audio, video o actividad de un grado"} onClose={close}>
    <form className="adm-form adm-eng-form" onSubmit={submit}>
      <fieldset className="adm-eng-types"><legend>Tipo de material</legend>
        {RESOURCE_TYPES.map((item) => { const meta = resourceTypes[item], Icon = meta.icon; return <button key={item} type="button" className={`is-${item}`} aria-pressed={type === item} onClick={() => changeType(item)}><Icon size={18} /><b>{meta.label}</b><small>{uploadRules[item].formats}</small></button>; })}
      </fieldset>

      <div className="adm-form-grid">
        <label>Grado<select name="grade" defaultValue={resource?.grade ?? grade}>{GRADES.map((item) => <option key={item} value={item}>{item}° de primaria</option>)}</select></label>
        <label>Unidad<input name="unit" list="eng-units" defaultValue={resource?.unit ?? ""} placeholder="Unit 1" maxLength={60} /><small>Agrupa el material en la página del grado.</small></label>
      </div>
      <datalist id="eng-units">{[...new Set([...SUGGESTED_UNITS, ...units])].map((unit) => <option key={unit} value={unit} />)}</datalist>
      <label>Título<input name="title" required minLength={2} maxLength={160} defaultValue={resource?.title ?? ""} placeholder={type === "book" ? "Student's Book · Unit 1" : type === "audio" ? "Track 3 · Listen and repeat" : type === "video" ? "Song: Hello, hello!" : "Worksheet · My family"} /></label>
      <label>Descripción<textarea name="description" rows={3} maxLength={600} defaultValue={resource?.description ?? ""} placeholder="Qué van a encontrar o qué deben hacer (opcional)." /></label>

      <div className="adm-eng-source">
        <div className="adm-eng-source-head">
          <strong>{usesLink ? "Enlace del video" : "Archivo"}</strong>
          {type === "video" && <div className="adm-segmented" role="group" aria-label="Origen del video">
            <button type="button" aria-pressed={source === "file"} onClick={() => setSource("file")}><FileUp size={13} /> Subir archivo</button>
            <button type="button" aria-pressed={source === "link"} onClick={() => setSource("link")}><Link2 size={13} /> YouTube / Vimeo</button>
          </div>}
        </div>
        {usesLink ? <label className="adm-eng-link">
          <input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" inputMode="url" aria-invalid={!linkOk || undefined} />
          <small className={linkOk ? undefined : "adm-eng-error"}>{linkOk ? "Se muestra dentro del sitio sin publicidad de seguimiento. Puede ser un video no listado." : "Ese enlace no es de YouTube ni de Vimeo."}</small>
        </label> : progress !== null ? <div className="adm-eng-progress" role="status"><span style={{ width: `${progress}%` }} /><small>Subiendo… {progress}%</small></div>
          : file ? <div className="adm-eng-file">
            <span className="adm-eng-file-badge">{file.format}</span>
            <div><strong>{file.format} · {formatBytes(file.fileSize)}</strong><small>{pending.includes(file.fileName) ? "Subido. Se guarda al guardar la ficha." : "Archivo actual"}</small></div>
            <button type="button" className="refresh-button" onClick={() => input.current?.click()} disabled={!uploads}><RefreshCw size={13} /> Reemplazar</button>
            {!resource?.fileName || pending.includes(file.fileName) ? <button type="button" className="adm-icon-button" aria-label="Quitar archivo" onClick={() => setFile(null)}><X size={14} /></button> : null}
          </div>
          : <button type="button" className="adm-eng-drop" onClick={() => input.current?.click()} disabled={!uploads}
            onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void choose(event.dataTransfer.files[0]); }}>
            <FileUp size={22} /><strong>{uploads ? "Elige o arrastra el archivo" : "La subida de archivos no está disponible aquí"}</strong><small>{rule.formats} · hasta {rule.maxMb} MB</small>
          </button>}
        <input ref={input} type="file" hidden accept={rule.accept} onChange={(event) => void choose(event.target.files?.[0])} />
      </div>

      <label className="adm-check"><input type="checkbox" name="free" defaultChecked={resource?.free ?? false} /> Muestra gratis <small>Se puede abrir sin código, para que conozcan el material.</small></label>
      <label>Estado<select name="status" defaultValue={resource?.status ?? "published"}><option value="published">Publicado: visible en la página del grado</option><option value="draft">Borrador: solo lo ve el equipo</option></select></label>

      <div className="adm-actions-row">
        <button className="button button-dark" type="submit" disabled={saving || progress !== null}>{saving ? "Guardando…" : resource ? "Guardar cambios" : "Guardar material"}</button>
        <button className="refresh-button" type="button" onClick={close}>Cancelar</button>
      </div>
    </form>
  </Drawer>;
}

/** Frase y descripción de un grado tal como se ven en la landing y en la página del grado. */
export function LevelTextDrawer({ level, onClose, onSaved }: { level: Level; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const base = defaultLevel(level.grade);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    const result = await send("/api/admin/ingles/niveles", "PUT", { grade: level.grade, tagline: String(form.get("tagline") ?? ""), description: String(form.get("description") ?? "") }, `Texto de ${level.ordinal} guardado.`);
    setSaving(false);
    if (result) onSaved();
  }
  return <Drawer open title={`Texto de ${level.ordinal}`} subtitle="Se muestra en la tarjeta del grado y en su página" onClose={onClose}>
    <form className="adm-form adm-eng-form" onSubmit={submit}>
      <label>Frase en inglés<input name="tagline" maxLength={60} defaultValue={level.tagline === base.tagline ? "" : level.tagline} placeholder={base.tagline} /><small>Vacío = “{base.tagline}”.</small></label>
      <label>Descripción<textarea name="description" rows={5} maxLength={400} defaultValue={level.description === base.description ? "" : level.description} placeholder={base.description} /><small>Qué aprenden en este grado. Vacío = texto por defecto.</small></label>
      <div className="adm-actions-row"><button className="button button-dark" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar texto"}</button><button className="refresh-button" type="button" onClick={onClose}>Cancelar</button></div>
    </form>
  </Drawer>;
}
