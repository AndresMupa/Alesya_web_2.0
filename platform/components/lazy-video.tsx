"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Video decorativo en bucle que solo se descarga cuando está por entrar en pantalla y se pausa al salir.
 * Con "reducir movimiento" o el modo de ahorro de datos no se descarga: queda la carátula.
 */
export function LazyVideo({ src, poster, className }: { src: string; poster?: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (saveData || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setActive(true); void video.play().catch(() => undefined); }
      else video.pause();
    }, { rootMargin: "300px 0px" });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return <video ref={ref} className={className} src={active ? src : undefined} poster={poster} muted loop playsInline autoPlay={active} preload="none" aria-hidden="true" />;
}
