"use client";
import { useEffect } from "react";
import { cleanAttribution, hasSignal, touchFromUrl, type Attribution } from "@/lib/crm/attribution";

const KEY = "alesya_touch";

function stored(): Attribution | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? cleanAttribution(JSON.parse(raw) as Partial<Attribution>) : null;
  } catch { return null; }
}

/**
 * Primer toque de la visita: lo que trajo el enlace (UTM), el sitio de donde vino y la página de entrada. Se guarda solo en la
 * pestaña (sessionStorage, sin cookies ni terceros) y el formulario lo envía junto con el contacto. Una visita directa sin señales
 * cede su lugar al primer enlace con UTM o referente externo de la misma sesión.
 */
function captureTouch() {
  if (window.location.pathname.startsWith("/admin")) return;
  const current = touchFromUrl(window.location, document.referrer, window.location.host);
  const previous = stored();
  if (previous && (hasSignal(previous) || !hasSignal(current))) return;
  try { window.sessionStorage.setItem(KEY, JSON.stringify(current)); } catch { /* almacenamiento bloqueado: el formulario usa la URL actual */ }
}

/** Toque que viaja con el formulario: el guardado al aterrizar o, si no hay, el de la página actual. */
export function readTouch(): Attribution {
  return stored() ?? touchFromUrl(window.location, document.referrer, window.location.host);
}

export function AttributionCapture() {
  useEffect(captureTouch, []);
  return null;
}
