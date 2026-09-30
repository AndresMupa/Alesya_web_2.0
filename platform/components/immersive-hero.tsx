"use client";

import Link from "next/link";
import { ArrowDown, ArrowUpRight, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const worlds = [
  { name: "Robótica", label: "Construye. Programa. Dale vida.", title: "La próxima gran idea", accent: "empieza contigo.", description: "Un robot que se mueve. Una pregunta que despierta. Descubre lo que puedes crear cuando aprendes haciendo.", video: "robotica-aula.mp4", category: "LEGO EV3", color: "#d7ff43" },
  { name: "Electrónica", label: "Conecta tu curiosidad.", title: "Pequeños circuitos.", accent: "Grandes posibilidades.", description: "Sensores, luces y código: experimenta con Arduino y transforma una idea en algo que responde al mundo.", video: "electronica.mp4", category: "Arduino", color: "#69e2ff" },
  { name: "Diseño 3D", label: "De tu imaginación a tus manos.", title: "Si puedes imaginarlo,", accent: "puedes construirlo.", description: "Explora el diseño y la impresión 3D. Aprende a dar forma a tus ideas, una capa a la vez.", video: "impresion-3d.mp4", category: "Impresión 3D", color: "#c2a6ff" },
];

export function ImmersiveHero() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const world = worlds[active];

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

  return <section className="immersive-hero" id="inicio" style={{ "--world-color": world.color } as React.CSSProperties}>
    <video ref={video} key={world.video} className="immersive-film" muted loop playsInline preload="auto" poster="/media/clientes-robotica-ev3.jpeg" aria-hidden="true">
      <source src={`/media/${world.video}`} type="video/mp4" />
    </video>
    <div className="immersive-shade" />
    <div className="hero-editorial page-width">
      <div className="hero-caption"><span>ALESYA X-TECH</span><span>El mundo es tu laboratorio</span></div>
      <div className="world-copy" key={world.name}>
        <p className="eyebrow">{world.label}</p>
        <h1>{world.title}<br /><em>{world.accent}</em></h1>
        <p className="world-description">{world.description}</p>
        <div className="hero-actions">
          <Link className="button world-button" href={`/proyectos?categoria=${encodeURIComponent(world.category)}`}>Empieza a explorar <ArrowUpRight size={20} /></Link>
          <Link className="world-shop" href="/catalogo">Encuentra tu kit <ArrowUpRight size={18} /></Link>
        </div>
      </div>
      <div className="world-bottom">
        <a href="#explorar" className="discover-cue"><span className="discover-circle"><ArrowDown size={19} /></span><span>Hay un mundo<br />por descubrir</span></a>
        <div className="world-selector" role="group" aria-label="Explora nuestros mundos">
          {worlds.map((item, index) => <button key={item.name} type="button" aria-pressed={index === active} onClick={() => setActive(index)}><span>0{index + 1}</span><strong>{item.name}</strong><i /></button>)}
        </div>
        <button className="film-control" type="button" onClick={() => setPaused(!paused)} aria-label={paused ? "Reproducir video de portada" : "Pausar video de portada"}>{paused ? <Play size={17} /> : <Pause size={17} />}</button>
      </div>
    </div>
  </section>;
}
