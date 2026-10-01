"use client";
/* eslint-disable @next/next/no-img-element -- fotos de /media y /uploads servidas tal cual (en cPanel no hay optimizador de imágenes). */

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type SliderSlide = { id: string; image: string; title: string; text: string; href: string };

/** Carrusel de fotos con desplazamiento nativo (scroll-snap), flechas, puntos y paso automático opcional. */
export function ImageSlider({ slides, autoplay, label }: { slides: SliderSlide[]; autoplay: boolean; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [hovering, setHovering] = useState(false);
  const total = slides.length;

  const go = (index: number) => {
    const element = track.current;
    if (!element || !total) return;
    const target = ((index % total) + total) % total;
    element.scrollTo({ left: target * element.clientWidth, behavior: "smooth" });
  };

  useEffect(() => {
    if (!autoplay || total < 2 || hovering || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      const element = track.current;
      if (!element) return;
      const current = Math.round(element.scrollLeft / element.clientWidth);
      element.scrollTo({ left: ((current + 1) % total) * element.clientWidth, behavior: "smooth" });
    }, 6000);
    return () => clearInterval(timer);
  }, [autoplay, total, hovering]);

  if (!total) return null;
  return <div className="home-slider" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
    <div className="home-slider-track" ref={track} aria-label={label} onScroll={(event) => setActive(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))}>
      {slides.map((slide) => {
        const content = <><img src={slide.image} alt={slide.title} loading="lazy" />{(slide.title || slide.text) && <figcaption className="home-slide-copy">{slide.title && <strong>{slide.title}</strong>}{slide.text && <span>{slide.text}</span>}</figcaption>}</>;
        return <figure className="home-slide" key={slide.id}>{slide.href ? <Link href={slide.href}>{content}</Link> : content}</figure>;
      })}
    </div>
    {total > 1 && <div className="home-slider-nav">
      <button type="button" aria-label="Diapositiva anterior" onClick={() => go(active - 1)}><ArrowLeft size={18} /></button>
      <div className="home-slider-dots">{slides.map((slide, index) => <button type="button" key={slide.id} aria-label={`Ir a la diapositiva ${index + 1}`} aria-pressed={index === active} onClick={() => go(index)} />)}</div>
      <button type="button" aria-label="Diapositiva siguiente" onClick={() => go(active + 1)}><ArrowRight size={18} /></button>
    </div>}
  </div>;
}
