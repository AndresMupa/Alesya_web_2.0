"use client";
/* eslint-disable @next/next/no-img-element -- fotos de /media y /uploads servidas tal cual (en cPanel no hay optimizador de imágenes). */

import { useRef, useState } from "react";
import { Film, ImageIcon, Images, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Drawer, useJson } from "@/components/admin/kit";

export type MediaKind = "image" | "video";
type MediaItem = { url: string; name: string; kind: MediaKind; size: number; source: "uploads" | "media" };

const accept: Record<MediaKind, string> = { image: "image/jpeg,image/png,image/webp", video: "video/mp4,video/webm" };
const limits: Record<MediaKind, string> = { image: "JPG, PNG o WebP hasta 5 MB, o una ruta del sitio.", video: "MP4 o WebM hasta 60 MB, o una ruta del sitio." };
const formatSize = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Sube un archivo a la biblioteca y devuelve su URL. Muestra el motivo si falla. */
export async function uploadMedia(file: File): Promise<{ url: string; kind: MediaKind } | null> {
  try {
    const body = new FormData();
    body.set("file", file);
    const response = await fetch("/api/admin/media", { method: "POST", body });
    const result = await response.json().catch(() => ({})) as { url?: string; kind?: MediaKind; message?: string };
    if (response.ok && result.url && result.kind) return { url: result.url, kind: result.kind };
    toast.error(result.message ?? "No se pudo subir el archivo.");
  } catch { toast.error("No se pudo subir el archivo. Revisa la conexión."); }
  return null;
}

export function MediaPreview({ url, kind }: { url: string; kind: MediaKind }) {
  if (!url) return kind === "video" ? <Film size={24} strokeWidth={1.3} /> : <ImageIcon size={24} strokeWidth={1.3} />;
  return kind === "video" ? <video src={url} muted playsInline preload="metadata" /> : <img src={url} alt="" />;
}

/** Imagen o video de una sección: subir, elegir de la biblioteca o escribir la ruta. */
export function MediaField({ label, kind, value, onChange, hint }: { label: string; kind: MediaKind; value: string; onChange: (url: string) => void; hint?: string }) {
  const [uploading, setUploading] = useState(false);
  const [library, setLibrary] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    const result = await uploadMedia(file);
    setUploading(false);
    if (input.current) input.current.value = "";
    if (!result) return;
    if (result.kind !== kind) { toast.error(kind === "video" ? "Ese archivo es una imagen; aquí va un video." : "Ese archivo es un video; aquí va una imagen."); return; }
    onChange(result.url);
    toast.success(kind === "video" ? "Video cargado. Se aplica al guardar." : "Imagen cargada. Se aplica al guardar.");
  }

  return <div className="adm-media-field">
    <span className="adm-media-label">{label}</span>
    <div className="adm-media-row">
      <div className="adm-media-preview"><MediaPreview url={value} kind={kind} /></div>
      <div className="adm-media-controls">
        <div className="adm-actions-row">
          <button type="button" className="refresh-button" onClick={() => input.current?.click()} disabled={uploading}><Upload size={14} /> {uploading ? "Subiendo…" : "Subir"}</button>
          <button type="button" className="refresh-button" onClick={() => setLibrary(true)}><Images size={14} /> Biblioteca</button>
          {value && <button type="button" className="refresh-button" onClick={() => onChange("")}><Trash2 size={14} /> Quitar</button>}
        </div>
        <input ref={input} type="file" accept={accept[kind]} hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={kind === "video" ? "/media/video.mp4" : "/media/foto.jpg"} maxLength={500} aria-label={`Ruta de ${label}`} />
        <small>{hint ?? limits[kind]}</small>
      </div>
    </div>
    {library && <MediaLibrary kind={kind} onClose={() => setLibrary(false)} onSelect={(url) => { onChange(url); setLibrary(false); }} />}
  </div>;
}

/** Biblioteca: lo subido desde el panel y los archivos incluidos en el sitio. */
function MediaLibrary({ kind, onClose, onSelect }: { kind: MediaKind; onClose: () => void; onSelect: (url: string) => void }) {
  const { data, error } = useJson<{ items: MediaItem[]; uploads: boolean }>(`/api/admin/media?kind=${kind}`);
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    const result = await uploadMedia(file);
    setUploading(false);
    if (input.current) input.current.value = "";
    if (!result) return;
    if (result.kind !== kind) { toast.error(kind === "video" ? "Ese archivo es una imagen; aquí va un video." : "Ese archivo es un video; aquí va una imagen."); return; }
    onSelect(result.url);
  }

  return <Drawer open title={kind === "video" ? "Biblioteca de videos" : "Biblioteca de imágenes"} subtitle="Elige un archivo subido desde el panel o uno incluido en el sitio." onClose={onClose}
    actions={data?.uploads ? <><button type="button" className="refresh-button" onClick={() => input.current?.click()} disabled={uploading}><Upload size={14} /> {uploading ? "Subiendo…" : "Subir nuevo"}</button><input ref={input} type="file" accept={accept[kind]} hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></> : undefined}>
    {error && <p className="checkout-status">{error}</p>}
    {!data && !error && <p className="adm-muted">Cargando…</p>}
    {data && !data.items.length && <p className="adm-muted">Todavía no hay archivos de este tipo.</p>}
    {data && data.items.length > 0 && <div className="adm-media-grid">
      {data.items.map((item) => <button type="button" key={item.url} onClick={() => onSelect(item.url)} title={item.name}>
        {item.kind === "video" ? <video src={item.url} muted playsInline preload="metadata" /> : <img src={item.url} alt="" loading="lazy" />}
        <span>{item.name}</span><small>{item.source === "uploads" ? "Subido" : "Del sitio"} · {formatSize(item.size)}</small>
      </button>)}
    </div>}
  </Drawer>;
}
