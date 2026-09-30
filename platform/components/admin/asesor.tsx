"use client";

import { useSyncExternalStore } from "react";
import { UserRound } from "lucide-react";

/**
 * Asesor activo del panel. Varios asesores comparten la cuenta de administración, así que cada uno
 * escribe su nombre una vez (queda en el navegador): firma sus gestiones, filtra "mis oportunidades"
 * y es el responsable por defecto de los contactos que registra.
 */
const KEY = "alesya_asesor";
const listeners = new Set<() => void>();
let cached: string | undefined;

function read() {
  if (cached === undefined) { try { cached = window.localStorage.getItem(KEY) ?? ""; } catch { cached = ""; } }
  return cached;
}

export function setAsesor(name: string) {
  cached = name.slice(0, 80);
  try { window.localStorage.setItem(KEY, cached); } catch { /* sin almacenamiento: solo dura la sesión */ }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export const useAsesor = () => useSyncExternalStore(subscribe, read, () => "");

export function AsesorPicker({ owners = [] }: { owners?: string[] }) {
  const asesor = useAsesor();
  return <label className="adm-asesor" title="Tu nombre firma las gestiones y filtra tus oportunidades">
    <UserRound size={15} />
    <span>Asesor</span>
    <input list="adm-asesor-options" value={asesor} maxLength={80} placeholder="Tu nombre" onChange={(event) => setAsesor(event.target.value)} onBlur={(event) => setAsesor(event.target.value.trim())} />
    <datalist id="adm-asesor-options">{owners.map((owner) => <option key={owner} value={owner} />)}</datalist>
  </label>;
}
