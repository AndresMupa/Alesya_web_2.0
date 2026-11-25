"use client";

import { useEffect, useRef } from "react";

type Reading = { visit: string; sections: string[]; seconds: number; arena: boolean };

const MIN_GAP_MS = 8_000;
const HEARTBEAT_MS = 30_000;
const MAX_SECONDS = 4 * 3600;

/** La visita vive en la pestaña (sessionStorage): recargar la página sigue sumando a la misma visita. */
function restore(token: string): Reading {
  const key = `pv-visit-${token}`;
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? "null") as Reading | null;
    if (saved && /^[a-f0-9]{32}$/.test(saved.visit)) return { visit: saved.visit, sections: Array.isArray(saved.sections) ? saved.sections : [], seconds: Number(saved.seconds) || 0, arena: !!saved.arena };
  } catch { /* sin almacenamiento: la visita dura lo que la página */ }
  const visit = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { visit, sections: [], seconds: 0, arena: false };
}

/**
 * Analítica de lectura propia, sin terceros: al abrir, al ver una sección nueva, al jugar la Arena, cada 30 s y al salir
 * envía a /api/propuesta/[token] las secciones vistas, el tiempo con la página visible y si jugó la Arena. Solo un
 * identificador aleatorio de la visita: nada del visitante. Con sesión del panel el servidor responde `preview`.
 */
export function useReadingTracker(token: string, enabled: boolean, onPreview: (preview: boolean) => void) {
  const arenaRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!enabled) return;
    const url = `/api/propuesta/${token}`;
    const key = `pv-visit-${token}`;
    const reading = restore(token);
    const seen = new Set(reading.sections);
    let visibleSince = document.visibilityState === "visible" ? performance.now() : 0;
    let lastSent = 0, timer = 0, stopped = false;

    const seconds = () => Math.min(MAX_SECONDS, Math.round(reading.seconds + (visibleSince ? (performance.now() - visibleSince) / 1000 : 0)));
    const post = () => {
      if (stopped) return;
      clearTimeout(timer);
      lastSent = performance.now();
      const payload: Reading = { visit: reading.visit, sections: [...seen], seconds: seconds(), arena: reading.arena };
      try { sessionStorage.setItem(key, JSON.stringify(payload)); } catch { /* sin almacenamiento */ }
      const body = JSON.stringify(payload);
      try {
        const request = fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true, credentials: "same-origin" });
        void request.then((response) => (response.ok ? response.json() : null) as Promise<{ preview?: boolean } | null>).then((data) => {
          if (data?.preview) { stopped = true; onPreview(true); }
        }).catch(() => undefined);
      } catch {
        navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }));
      }
    };
    // Agrupa los avances: como mucho un envío cada 8 s, salvo al salir de la página.
    const schedule = () => {
      const wait = MIN_GAP_MS - (performance.now() - lastSent);
      clearTimeout(timer);
      if (wait <= 0) post(); else timer = window.setTimeout(() => post(), wait);
    };

    const sections = Array.from(document.querySelectorAll<HTMLElement>(".pv main > section[id]"));
    const observer = new IntersectionObserver((entries) => {
      let fresh = false;
      for (const entry of entries) if (entry.isIntersecting && !seen.has(entry.target.id)) { seen.add(entry.target.id); fresh = true; }
      if (fresh) schedule();
    }, { rootMargin: "-45% 0px -45% 0px" });
    sections.forEach((section) => observer.observe(section));

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (visibleSince) { reading.seconds += (performance.now() - visibleSince) / 1000; visibleSince = 0; }
        post();
      } else if (!visibleSince) visibleSince = performance.now();
    };
    const onLeave = () => post();
    const heartbeat = window.setInterval(() => { if (visibleSince) schedule(); }, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVisibility);
    addEventListener("pagehide", onLeave);
    arenaRef.current = () => { if (!reading.arena) { reading.arena = true; post(); } };
    post();

    return () => {
      observer.disconnect(); clearInterval(heartbeat); clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility); removeEventListener("pagehide", onLeave);
      arenaRef.current = () => undefined;
    };
  }, [token, enabled, onPreview]);

  return { arena: () => arenaRef.current() };
}
