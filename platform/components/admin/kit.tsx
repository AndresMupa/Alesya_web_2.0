"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

/**
 * Carga JSON de una API del panel. `revision` fuerza una recarga. `loading` se deriva de la clave de la
 * última respuesta (sin setState síncrono dentro del efecto) y se conservan los datos anteriores mientras carga.
 */
export function useJson<T>(url: string | null, revision = 0) {
  const key = url ? `${url}#${revision}` : null;
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string }>({ key: null, data: null, error: "" });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error((body as { message?: string }).message ?? "No se pudo cargar la información.");
        return body as T;
      })
      .then((data) => setState({ key, data, error: "" }), (error: Error) => { if (!controller.signal.aborted) setState((previous) => ({ key, data: previous.data, error: error.message })); });
    return () => controller.abort();
  }, [url, key]);
  return { data: state.data, error: state.error, loading: key !== null && state.key !== key };
}

export function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(timer); }, [value, delay]);
  return debounced;
}

/** Envía JSON a una API del panel y muestra el resultado como notificación. */
export async function send<T = Record<string, unknown>>(url: string, method: "POST" | "PATCH", body: unknown, success?: string): Promise<(T & { ok: true }) | null> {
  try {
    const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({})) as T & { message?: string };
    if (!response.ok) { toast.error(result.message ?? "No se pudo guardar el cambio."); return null; }
    if (success) toast.success(success);
    return { ...result, ok: true };
  } catch {
    toast.error("Sin conexión con el servidor. Intenta de nuevo.");
    return null;
  }
}

/** Panel lateral para fichas (contacto, pedido, producto). Se cierra con Escape o clic fuera. */
export function Drawer({ open, title, subtitle, onClose, children, actions }: { open: boolean; title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return <div className="adm-drawer-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="adm-drawer" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
      <header className="adm-drawer-head">
        <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <div className="adm-drawer-actions">{actions}<button type="button" className="adm-icon-button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></div>
      </header>
      <div className="adm-drawer-body">{children}</div>
    </aside>
  </div>;
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <header className="adm-page-head"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{children && <div className="adm-page-actions">{children}</div>}</header>;
}

export function Metric({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "warning" | "good" }) {
  return <article className="metric-card adm-metric"><p>{label}</p><strong>{value}</strong>{hint !== undefined && <span className={tone ? `is-${tone}` : undefined}>{hint}</span>}</article>;
}

/** Lee un archivo de texto (CSV) elegido por el usuario. */
export function readTextFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "utf-8");
  });
}
