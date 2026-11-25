"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Ventana modal sobre `<dialog>` nativo: atrapa el foco, cierra con Escape y devuelve el foco al botón que la abrió.
 * `size="full"` la usa el lector de libros.
 */
export function Modal({ open, onClose, title, subtitle, actions, size = "medium", children }: { open: boolean; onClose: () => void; title: string; subtitle?: ReactNode; actions?: ReactNode; size?: "medium" | "large" | "full"; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) { element.showModal(); document.documentElement.classList.add("eng-modal-open"); }
    if (!open && element.open) element.close();
    return () => document.documentElement.classList.remove("eng-modal-open");
  }, [open]);
  return <dialog ref={dialog} className={`eng-modal is-${size}`} aria-label={title} onClose={onClose} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    {open && <div className="eng-modal-frame">
      <header className="eng-modal-head">
        <div><strong>{title}</strong>{subtitle && <span>{subtitle}</span>}</div>
        <div className="eng-modal-actions">{actions}<button type="button" className="eng-icon-button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button></div>
      </header>
      <div className="eng-modal-body">{children}</div>
    </div>}
  </dialog>;
}
