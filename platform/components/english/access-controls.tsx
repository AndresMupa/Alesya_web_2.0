"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";
import { CodeForm } from "@/components/english/code-form";
import { Modal } from "@/components/english/modal";

/** Botón "Tengo un código" que abre el canje en una ventana. */
export function CodeDialogButton({ className = "button button-ghost-light", grade, children }: { className?: string; grade?: number; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={className} onClick={() => setOpen(true)}>{children ?? <><KeyRound size={17} aria-hidden="true" /> Tengo un código</>}</button>
    <Modal open={open} onClose={() => setOpen(false)} title="Desbloquea tu material" subtitle="Libros, audios, videos y actividades de tu grado">
      <div className="eng-dialog-copy">
        <p>Escribe el código que viene en tu libro Alesya o el que te dio tu colegio. Queda guardado en este navegador: no necesitas crear una cuenta.</p>
        <CodeForm grade={grade} tone="light" autoFocus onUnlocked={() => setOpen(false)} />
      </div>
    </Modal>
  </>;
}

/** Cierra el acceso en este navegador: útil en computadores compartidos del colegio. */
export function ForgetAccessButton({ className = "eng-link-button" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function forget() {
    if (!confirm("¿Cerrar el acceso en este equipo? Para volver a entrar necesitarás el código de nuevo.")) return;
    setBusy(true);
    const response = await fetch("/api/ingles/acceso", { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!response?.ok) { toast.error("No se pudo cerrar el acceso. Intenta de nuevo."); return; }
    toast.success("Acceso cerrado en este equipo.");
    router.refresh();
  }
  return <button type="button" className={className} onClick={() => void forget()} disabled={busy}><LogOut size={14} aria-hidden="true" /> {busy ? "Cerrando…" : "Cerrar acceso en este equipo"}</button>;
}
