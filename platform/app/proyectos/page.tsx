/* eslint-disable @next/next/no-img-element -- fotos de /media servidas tal cual (en cPanel no hay optimizador de imágenes). */
import { ArrowRight, Clock, Gauge, Users } from "lucide-react";
import Link from "next/link";
import { LazyVideo } from "@/components/lazy-video";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { posterFor } from "@/lib/posters";
import { pageMetadata } from "@/lib/seo";

type Project = { title: string; tech: string[]; age: string; time: string; level: string; video?: string; image?: string };

const projects: Project[] = [
  { title: "Robot que esquiva obstáculos", tech: ["Arduino", "Sensores"], age: "11+", time: "4 sesiones", level: "Intermedio", video: "/media/robotica-aula.mp4" },
  { title: "Brazo mecánico programable", tech: ["LEGO EV3", "Mecanismos"], age: "10+", time: "6 sesiones", level: "Intermedio", video: "/media/lego-ev3.mp4" },
  { title: "Máquinas simples en movimiento", tech: ["LEGO WeDo", "Mecanismos"], age: "7+", time: "4 sesiones", level: "Inicial", image: "/media/clientes-lego-wedo.jpeg" },
  { title: "Diseña una pieza funcional", tech: ["Impresión 3D", "Diseño"], age: "12+", time: "5 sesiones", level: "Inicial", video: "/media/impresion-3d.mp4" },
  { title: "Circuitos con propósito", tech: ["Electrónica", "Bricolaje"], age: "8+", time: "3 sesiones", level: "Inicial", video: "/media/electronica.mp4" },
];
const filters = ["Todos", "LEGO EV3", "LEGO WeDo", "Arduino", "Impresión 3D", "Bricolaje"];

// Los filtros son la misma página: todas apuntan a /proyectos como canónica para no duplicar contenido.
export const generateMetadata = () => pageMetadata({
  title: "Proyectos de robótica, Arduino e impresión 3D para el aula",
  description: "Biblioteca de proyectos maker con LEGO EV3, LEGO WeDo, Arduino, impresión 3D y bricolaje: objetivo pedagógico, guía paso a paso, materiales y evaluación por edad y nivel.",
  path: "/proyectos",
  image: { url: "/media/posters/lego-ev3.jpg", alt: "Proyecto de robótica con LEGO EV3" },
});

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const { categoria } = await searchParams;
  const active = filters.includes(categoria ?? "") ? categoria! : "Todos";
  const visible = active === "Todos" ? projects : projects.filter((project) => project.tech.includes(active));
  return <div className="site-shell"><div className="interior-header"><SiteHeader /></div><main><section className="page-hero"><div className="page-width"><p className="eyebrow eyebrow-light">Biblioteca de proyectos</p><h1>Construye, programa<br />y comprende.</h1><p>Rutas listas para aprender haciendo. Cada proyecto conecta una pregunta, una tecnología y un resultado que se puede mostrar.</p></div></section><section className="section page-width">
    <nav className="filter-strip" aria-label="Filtrar por tecnología">{filters.map((item) => <Link scroll={false} href={item === "Todos" ? "/proyectos" : `/proyectos?categoria=${encodeURIComponent(item)}`} className={item === active ? "filter-chip is-active" : "filter-chip"} aria-current={item === active ? "page" : undefined} key={item}>{item}</Link>)}</nav>
    <div className="project-grid">{visible.map((project) => <article className="project-card" key={project.title}><div className="project-card-media">{project.video ? <LazyVideo src={project.video} poster={posterFor(project.video)} /> : <img src={project.image} alt={project.title} loading="lazy" />}</div><div className="project-card-body"><div className="project-tags">{project.tech.map((tag) => <span key={tag}>{tag}</span>)}</div><h2>{project.title}</h2><p>Incluye objetivo pedagógico, guía paso a paso, lista de materiales, código y criterios de evaluación.</p><div className="project-meta"><span><Users size={14} /> {project.age}</span><span><Clock size={14} /> {project.time}</span><span><Gauge size={14} /> {project.level}</span></div><Link className="underlined-link" href="/colegios#diagnostico">Solicitar esta ruta <ArrowRight size={16} /></Link></div></article>)}</div>
  </section></main><SiteFooter /></div>;
}
