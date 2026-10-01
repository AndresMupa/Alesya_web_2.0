"use client";
/* eslint-disable @next/next/no-img-element -- fotos de /media y /uploads servidas tal cual (en cPanel no hay optimizador de imágenes). */

import Link from "next/link";
import { ArrowDown, ArrowUpRight, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { HeroSlide } from "@/lib/pages/home-schema";

const DEFAULT_COLOR = "#d7ff43";
const videoType = (src: string) => (src.endsWith(".webm") ? "video/webm" : "video/mp4");

/** Portada principal: diapositivas (mundos) con video o imagen de fondo, editables desde /admin/portada. */
export function ImmersiveHero({ captionTop, captionBottom, poster, slides }: { captionTop: string; captionBottom: string; poster: string; slides: HeroSlide[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const world = slides[Math.min(active, slides.length - 1)];

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPaused(preference.matches);
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (paused) video.current?.pause();
    else void video.current?.play().catch(() => setPaused(true));
  }, [paused, active]);

  if (!world) return null;
  const still = world.image || poster;
  return <section className="immersive-hero" id="inicio" style={{ "--world-color": world.color || DEFAULT_COLOR } as React.CSSProperties}>
    {world.video
      ? <video ref={video} key={world.id} className="immersive-film" muted loop playsInline preload="auto" poster={still || undefined} aria-hidden="true"><source src={world.video} type={videoType(world.video)} /></video>
      : still ? <img key={world.id} className="immersive-film" src={still} alt="" /> : null}
    <div className="immersive-shade" />
    <div className="hero-editorial page-width">
      {(captionTop || captionBottom) && <div className="hero-caption"><span>{captionTop}</span><span>{captionBottom}</span></div>}
      <div className="world-copy" key={world.id}>
        {world.label && <p className="eyebrow">{world.label}</p>}
        <h1>{world.title}{world.accent && <><br /><em>{world.accent}</em></>}</h1>
        {world.description && <p className="world-description">{world.description}</p>}
        <div className="hero-actions">
          {world.primaryLabel && <Link className="button world-button" href={world.primaryHref || "/proyectos"}>{world.primaryLabel} <ArrowUpRight size={20} /></Link>}
          {world.secondaryLabel && <Link className="world-shop" href={world.secondaryHref || "/catalogo"}>{world.secondaryLabel} <ArrowUpRight size={18} /></Link>}
        </div>
      </div>
      <div className="world-bottom">
        <a href="#explorar" className="discover-cue"><span className="discover-circle"><ArrowDown size={19} /></span><span>Hay un mundo<br />por descubrir</span></a>
        {slides.length > 1 && <div className="world-selector" role="group" aria-label="Explora nuestros mundos">
          {slides.map((item, index) => <button key={item.id} type="button" aria-pressed={index === active} onClick={() => setActive(index)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.name}</strong><i /></button>)}
        </div>}
        {world.video && <button className="film-control" type="button" onClick={() => setPaused(!paused)} aria-label={paused ? "Reproducir video de portada" : "Pausar video de portada"}>{paused ? <Play size={17} /> : <Pause size={17} />}</button>}
      </div>
    </div>
  </section>;
}
