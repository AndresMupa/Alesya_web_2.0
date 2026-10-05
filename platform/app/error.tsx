"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

/** Error inesperado en una página: mensaje claro, reintento y contacto, sin detalles técnicos para el visitante. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("page_error", error.digest ?? error.message); }, [error]);
  return <main className="status-page page-width">
    <p className="eyebrow">Algo salió mal</p>
    <h1>No pudimos cargar <em>esta página.</em></h1>
    <p>Fue un problema de nuestro lado. Intenta de nuevo en unos segundos; si continúa, escríbenos a comercial@alesyaediciones.com o al WhatsApp +57 300 593 7840.</p>
    <div className="status-links">
      <button type="button" onClick={reset}><RotateCcw size={16} /> Intentar de nuevo</button>
      <Link href="/">Ir al inicio</Link>
    </div>
  </main>;
}
