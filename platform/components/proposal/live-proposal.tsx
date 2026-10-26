"use client";
/* eslint-disable @next/next/no-img-element -- fotos y logos de /media servidos tal cual (en cPanel no hay optimizador de imágenes). */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { LazyVideo } from "@/components/lazy-video";
import { useReadingTracker } from "@/components/proposal/use-reading-tracker";
import { PROGRAM_PACKS, PROPOSAL_SECTIONS, SCHOOL_MONTHS, levelPrice, planTotals, type ProposalLevel, type ProposalPack, type ProposalStudents, type ProposalView } from "@/lib/crm/proposal-plan";

const ARENA_URL = "https://alesya-x-arena.vercel.app/";
const IMG = "/media/propuesta";
const BROCHURE = `${IMG}/brochure-robotica.pdf`;

type Css = CSSProperties & Record<`--${string}`, string | number>;
const v = (vars: Record<string, string | number>) => vars as Css;

const LEVELS: { key: ProposalLevel; name: string; tab: string; kind: string; color: string; img: string; pos?: string; text: string; specs: string[] }[] = [
  { key: "pre", name: "Bee-bot", tab: "Preescolar", kind: "Pre-jardín · Jardín · Transición", color: "var(--yellow)", img: `${IMG}/preescolar.webp`,
    text: "Robot abeja que se programa con secuencias, sin montajes. Los niños aprenden jugando sobre tapetes educativos.",
    specs: ["Desde 3 años", "Programación por secuencias", "Tapetes educativos", "Cuento «Igor el Robot»"] },
  { key: "pri", name: "MART-02", tab: "Primaria", kind: "Modelos motorizados", color: "var(--cyan)", img: `${IMG}/primaria.jpg`, pos: "center 40%",
    text: "Construcciones con motor y programación sencilla en Scratch, a partir de temas del entorno como los desastres naturales.",
    specs: ["280 piezas", "50 montajes guiados", "Smarthub, motor y 2 sensores", "Programación con Scratch"] },
  { key: "bach", name: "TECH-R3", tab: "Bachillerato", kind: "Brazos mecánicos y líneas de selección", color: "var(--magenta)", img: `${IMG}/bachillerato.jpg`,
    text: "Puesto completo para 2–3 estudiantes: de arrastrar íconos a algoritmos complejos, con modelos aplicables a la vida diaria.",
    specs: ["Procesador ARM9 y Linux", "4 sensores y 4 motores", "Bluetooth y USB", "Puesto para 2–3 estudiantes"] },
];
const CALC_FIELDS: { key: ProposalLevel; label: string; color: string; min: number }[] = [
  { key: "pre", label: "Preescolar", color: "var(--yellow)", min: 400 }, { key: "pri", label: "Primaria", color: "var(--cyan)", min: 900 }, { key: "bach", label: "Bachillerato", color: "var(--magenta)", min: 900 },
];
const LOGOS = [["lideres-del-manana.png", "Gimnasio Líderes del Mañana"], ["colegio-finlandes.png", "Colegio Finlandés Juan Pablo II"], ["meryland.png", "Nuevo Gimnasio Campestre Meryland Bilingüe"], ["la-anunciacion.png", "Instituto La Anunciación"], ["mayor-andino.jpg", "Colegio Mayor Andino"], ["alcibiades-florez.jpg", "Gimnasio Alcibíades Flórez"], ["ninos-felices.png", "Colegio Niños Felices"], ["gs.jpg", "Institución aliada"]];

const cop = (cents: number) => `$${Math.round(cents / 100).toLocaleString("es-CO")}`;
const num = (value: number) => value.toLocaleString("es-CO");
const packLabel = (pack: ProposalPack) => `${pack} proyecto${pack > 1 ? "s" : ""}`;
const prefersReduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ===== Íconos ===== */
const Arrow = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
const Play = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
const Check = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg>;
const Whatsapp = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm4.4 12c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.5 6.5 0 01-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.2 0-.3 0-.4l-.7-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.8 12 12 0 004.6 4c1.7.7 2.3.8 3.1.6a2.7 2.7 0 001.8-1.3 2.2 2.2 0 00.1-1.3c0-.1-.2-.2-.4-.3z" /></svg>;

/** Total que se anima al cambiar (con "reducir movimiento" salta directo). */
function AnimatedMoney({ cents }: { cents: number }) {
  const [shown, setShown] = useState(cents);
  const from = useRef(cents);
  useEffect(() => {
    const start = from.current, t0 = performance.now(), duration = prefersReduced() ? 0 : 600;
    let raf = 0;
    const tick = (now: number) => {
      const progress = duration ? Math.min(1, (now - t0) / duration) : 1;
      from.current = start + (cents - start) * (1 - Math.pow(1 - progress, 3));
      setShown(from.current);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // En pestañas en segundo plano requestAnimationFrame se pausa: el total no puede quedar a medias.
    const fallback = window.setTimeout(() => { cancelAnimationFrame(raf); from.current = cents; setShown(cents); }, duration + 100);
    return () => { cancelAnimationFrame(raf); clearTimeout(fallback); };
  }, [cents]);
  return <>{cop(shown)}</>;
}

/**
 * Propuesta viva de Robótica Educativa: resumen, impacto, clase, niveles, Arena jugable, calculadora, plan, respaldo y
 * siguiente paso, con modo presentación (botón o tecla P). Los datos vienen de la cotización y del lead; la aceptación usa
 * el mismo flujo de la cotización pública y la lectura se registra en el historial del lead.
 */
export function LiveProposal({ proposal: p, className = "" }: { proposal: ProposalView; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const activeRef = useRef(0);
  const presentRef = useRef(false);
  const slideRef = useRef({ target: -1, at: 0 });

  const [students, setStudents] = useState<ProposalStudents>(p.plan.students);
  const [pack, setPack] = useState<ProposalPack>(p.plan.pack);
  const [level, setLevel] = useState(0);
  const [levelTouched, setLevelTouched] = useState(false);
  const [arenaLive, setArenaLive] = useState(false);
  const [present, setPresent] = useState(false);
  const [active, setActive] = useState(0);
  const [preview, setPreview] = useState(false);
  const [mode, setMode] = useState<"confirm" | "reject" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<"accepted" | "rejected" | null>(null);

  const tracker = useReadingTracker(p.token, p.status !== "draft", setPreview);
  const status = outcome ?? p.status;
  const decidable = status === "sent";

  /* ===== Cifras ===== */
  const base = p.plan.students;
  const baseEst = base.pre + base.pri + base.bach;
  const routeLevels = CALC_FIELDS.filter((field) => base[field.key] > 0).map((field) => field.label);
  const routeLabel = routeLevels.length === 3 ? "Pre-jardín a 11°" : routeLevels.join(" + ") || "—";
  const t = planTotals(p.plan, students, pack);
  const adjusted = pack !== p.plan.pack || CALC_FIELDS.some((field) => students[field.key] !== base[field.key]);
  // Sin cambios, la calculadora muestra exactamente el total de la cotización.
  const calcTotal = p.plan.fromQuote && !adjusted ? p.totalInCents : t.total;
  const calcMonth = t.est ? calcTotal / t.est / SCHOOL_MONTHS : 0;
  const asesorFirst = p.asesorFirst ?? "Su asesor";
  const greet = p.asesorFirst ? `Hola ${p.asesorFirst}` : "Hola, equipo Alesya";
  const school = p.organization + (p.city ? ` (${p.city})` : "");

  const wa = (kind: "hello" | "accept" | "meet" | "renew") => {
    const message = {
      hello: `${greet}, estoy revisando la propuesta ${p.number} de Robótica Educativa para ${school}. Tengo una pregunta:`,
      accept: `${greet}, ${adjusted ? "queremos ajustar" : "queremos avanzar con"} la propuesta ${p.number} para ${school}: ${num(t.est)} estudiantes (preescolar ${students.pre}, primaria ${students.pri}, bachillerato ${students.bach}), paquete de ${packLabel(pack)} STEM, inversión estimada ${cop(calcTotal)}. ¿Cuáles son los siguientes pasos?`,
      meet: `${greet}, quiero agendar el diagnóstico de robótica para ${school} (propuesta ${p.number}). ¿Qué horarios tiene disponibles?`,
      renew: `${greet}, la propuesta ${p.number} para ${school} venció. ¿Nos envía una actualizada?`,
    }[kind];
    return `https://wa.me/${p.whatsappDigits}?text=${encodeURIComponent(message)}`;
  };

  /* ===== Apariciones, contadores, progreso y riel ===== */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reveal = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.setAttribute("data-in", ""); reveal.unobserve(entry.target); }
    }), { threshold: .15, rootMargin: "0px 0px -6% 0px" });
    root.querySelectorAll(".rv, .steps").forEach((element) => reveal.observe(element));
    const counters = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      counters.unobserve(entry.target);
      const element = entry.target as HTMLElement, end = Number(element.dataset.count), t0 = performance.now();
      if (prefersReduced()) return;
      const tick = (now: number) => { const progress = Math.min(1, (now - t0) / 1100); element.textContent = String(Math.round(end * (1 - Math.pow(1 - progress, 3)))); if (progress < 1) requestAnimationFrame(tick); };
      element.textContent = "0"; requestAnimationFrame(tick);
    }), { threshold: .6 });
    root.querySelectorAll("[data-count]").forEach((element) => counters.observe(element));

    const sections = Array.from(root.querySelectorAll<HTMLElement>("main > section"));
    const onScroll = () => {
      const height = document.documentElement.scrollHeight - innerHeight;
      progressRef.current?.style.setProperty("--p", height > 0 ? (scrollY / height).toFixed(4) : "0");
      let current = 0;
      sections.forEach((section, index) => { if (section.getBoundingClientRect().top < innerHeight * .45) current = index; });
      activeRef.current = current;
      setActive(current);
    };
    const first = requestAnimationFrame(onScroll);
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);

    // Brillo que sigue al puntero en las tarjetas.
    const onPointer = (event: PointerEvent) => {
      const card = (event.target as Element | null)?.closest?.<HTMLElement>(".pv .spot");
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      card.style.setProperty("--my", `${event.clientY - rect.top}px`);
    };
    document.addEventListener("pointermove", onPointer);
    return () => {
      reveal.disconnect(); counters.disconnect(); cancelAnimationFrame(first);
      removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); document.removeEventListener("pointermove", onPointer);
    };
  }, []);

  /* ===== Modo presentación ===== */
  const setPresentMode = useCallback((on: boolean) => {
    setPresent(on);
    if (on) void document.documentElement.requestFullscreen?.().catch(() => undefined);
    else if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
  }, []);
  // Si el desplazamiento anterior sigue en curso, se avanza desde su destino y no desde la posición a medio camino.
  const go = useCallback((delta: number) => {
    const sections = Array.from(rootRef.current?.querySelectorAll<HTMLElement>("main > section") ?? []);
    if (!sections.length) return;
    let current = 0;
    sections.forEach((section, index) => { if (section.getBoundingClientRect().top <= innerHeight * .3) current = index; });
    const now = performance.now();
    const from = slideRef.current.target >= 0 && now - slideRef.current.at < 900 ? slideRef.current.target : current;
    const target = Math.max(0, Math.min(sections.length - 1, from + delta));
    slideRef.current = { target, at: now };
    sections[target].scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth", block: "start" });
  }, []);

  useEffect(() => {
    presentRef.current = present;
    document.documentElement.classList.toggle("pv-present-mode", present);
    if (present) Array.from(rootRef.current?.querySelectorAll<HTMLElement>("main > section") ?? [])[activeRef.current]?.scrollIntoView();
    return () => document.documentElement.classList.remove("pv-present-mode");
  }, [present]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as Element | null)?.closest?.("input, select, textarea, iframe, [contenteditable]") || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "p" || event.key === "P") { setPresentMode(!presentRef.current); return; }
      if (!presentRef.current) return;
      if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(event.key)) { event.preventDefault(); go(1); }
      if (["ArrowUp", "ArrowLeft", "PageUp"].includes(event.key)) { event.preventDefault(); go(-1); }
      if (event.key === "Escape") setPresentMode(false);
    };
    const onFullscreen = () => { if (!document.fullscreenElement && presentRef.current) setPresent(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("fullscreenchange", onFullscreen); };
  }, [go, setPresentMode]);

  /* ===== Arena jugable ===== */
  useEffect(() => { if (arenaLive) iframeRef.current?.focus(); }, [arenaLive]);
  const playArena = () => { setArenaLive(true); tracker.arena(); };

  /* ===== Niveles ===== */
  const tilt = (event: ReactPointerEvent<HTMLDivElement>) => {
    const image = event.currentTarget.querySelector("img");
    if (!image || prefersReduced()) return;
    const rect = event.currentTarget.getBoundingClientRect(), x = (event.clientX - rect.left) / rect.width - .5, y = (event.clientY - rect.top) / rect.height - .5;
    image.style.transform = `scale(1.06) rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`;
  };
  const untilt = (event: ReactPointerEvent<HTMLDivElement>) => { const image = event.currentTarget.querySelector("img"); if (image) image.style.transform = ""; };
  const lv = LEVELS[level];
  const lvPrice = levelPrice(p.plan, lv.key, pack);

  /* ===== Decisión ===== */
  const openAccept = () => { setMode("confirm"); setError(""); document.getElementById("siguiente")?.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth" }); };
  async function decide(choice: "accepted" | "rejected") {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/cotizacion/${p.token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision: choice, note: choice === "rejected" ? note : "" }) });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) { setError(body.message ?? "No se pudo registrar su respuesta."); return; }
      setOutcome(choice); setMode(null);
    } catch { setError("Sin conexión. Intente de nuevo."); }
    finally { setBusy(false); }
  }

  const statusChip = status === "accepted" ? "Aceptada" : status === "rejected" ? "Respondida" : status === "expired" ? "Vencida" : p.validShort;
  const notice = preview ? "Vista previa del asesor: esta visita no se registra en el CRM." : p.status === "draft" ? "Borrador: el colegio podrá aceptarla cuando la envíe desde el CRM." : null;
  const logos = LOGOS.map(([file, name]) => ({ file, name }));

  return <div ref={rootRef} className={`pv${present ? " present" : ""} ${className}`}>
    <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
    <div className="grain" aria-hidden="true" />

    <header className="bar">
      <a className="brand" href="#inicio" aria-label="Alesya Ediciones y Alesya X-Tech">
        <img src="/media/alesya-ediciones.png" alt="" width={26} height={26} decoding="async" /><span>ALESYA</span><span className="sep" />
        <img className="xt" src="/media/alesya-x-tech.webp" alt="" width={30} height={30} decoding="async" />
      </a>
      <span className="bar-title">Propuesta {p.number} · <b>{p.organization}</b></span>
      <div className="bar-actions">
        <button className="btn glass sm" type="button" title="Presentar (P)" onClick={() => setPresentMode(!present)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>Presentar</button>
        <a className="btn wa sm" href={wa("hello")} target="_blank" rel="noopener noreferrer"><Whatsapp />Asesor</a>
      </div>
      <div className="progress"><i ref={progressRef} /></div>
    </header>

    {notice && <p className="pv-notice" role="status">{notice}</p>}

    <nav className="rail" aria-label="Secciones de la propuesta">
      {PROPOSAL_SECTIONS.map((section, index) => <a key={section.id} href={`#${section.id}`} className={index === active ? "on" : undefined} aria-current={index === active ? "true" : undefined}><span>{section.name}</span></a>)}
    </nav>

    <main>
      {/* ============ 0 · Portada ============ */}
      <section id="inicio" className="cover">
        <LazyVideo className="cover-video" src="/media/robotica-aula.mp4" poster="/media/posters/robotica-aula.jpg" />
        <div className="cover-shade" />
        <div className="wrap cover-grid">
          <div>
            <p className="kicker"><span className="dot" />Propuesta para {p.organization}</p>
            <h1>{["Robótica", "que", "se", "aprende"].map((word, index) => <span key={word}><span className="w" style={v({ "--i": index })}>{word}</span> </span>)}<em className="w" style={v({ "--i": 4 })}>haciendo.</em></h1>
            <p className="lede">Una ruta de pre-jardín a grado 11 con texto, kit, software y una arena de competencia, pensada para los <b>{num(baseEst)}</b> estudiantes de <b>{p.organization}</b>.</p>
            <div className="cover-actions">
              <a className="btn primary" href="#inversion">Ver la inversión<Arrow /></a>
              <a className="btn glass" href="#arena"><Play />Jugar la Arena 3D</a>
            </div>
          </div>
          <aside className="summary glass-card rv" style={v({ "--d": 3 })} aria-label="Resumen de la propuesta">
            <header><span>{p.number}</span><b data-status={status}>{statusChip}</b></header>
            <dl>
              <div><dt>Estudiantes</dt><dd>{num(baseEst)}</dd></div>
              <div><dt>Ruta</dt><dd className="route">{routeLabel}</dd></div>
              <div><dt>{p.plan.fromQuote && !p.plan.extras.length ? "Inversión anual en textos" : "Inversión de la propuesta"}</dt><dd className="hl">{cop(p.totalInCents)}</dd></div>
              <div><dt>Por estudiante al mes</dt><dd>{cop(baseEst ? p.totalInCents / baseEst / SCHOOL_MONTHS : 0)}</dd></div>
            </dl>
            <div className="who"><span className="avatar">{p.initials}</span><div><b>{p.asesor}</b><span>Su asesor Alesya</span></div><a className="btn wa sm" href={wa("hello")} target="_blank" rel="noopener noreferrer">Escribir</a></div>
          </aside>
        </div>
        <div className="scroll-cue" aria-hidden="true"><i />Deslice</div>
      </section>

      {/* ============ 1 · Impacto ============ */}
      <section id="impacto">
        <div className="wrap">
          <div className="sec-head">
            <div><p className="kicker rv">01 · Lo que logra su colegio</p><h2 className="rv" style={v({ "--d": 1 })}>Habilidades que se <em>ven</em> en cada clase.</h2></div>
            <p className="rv" style={v({ "--d": 2 })}>Robótica Educativa es una serie de libros que despierta la curiosidad por la innovación y lleva a resolver problemas reales, con mirada ética y sostenible.</p>
          </div>
          <div className="bento">
            <article className="tile t-video spot rv"><LazyVideo src="/media/lego-ev3.mp4" poster="/media/posters/lego-ev3.jpg" /><span className="tag">En el aula</span><div className="cap"><b>Cada clase termina con un robot.</b><span>Construido y programado por sus estudiantes.</span></div></article>
            <article className="tile t-stat spot rv" style={v({ "--d": 1 })}><b className="big"><span data-count="2">2</span><small>h</small></b><p>semanales en un solo bloque: concepto, montaje y programación.</p></article>
            <article className="tile t-stat spot rv" style={v({ "--d": 2 })}><b className="big"><span data-count="3">3</span><small>/ mesa</small></b><p>estudiantes máximo por mesa: trabajo colaborativo STEM+H.</p></article>
            <article className="tile t-skills spot rv"><div><h3>10 habilidades del siglo XXI</h3><p>Lo que crece en sus estudiantes con cada robot.</p></div><div className="chips">{["Creatividad e imaginación", "Pensamiento crítico", "Trabajo en equipo", "Espíritu emprendedor", "Aprender de los errores", "Autoevaluación", "Motivación por aprender", "Autoestima", "Nuevas formas de comunicación", "Adaptación al futuro"].map((skill) => <span key={skill}>{skill}</span>)}</div></article>
            <article className="tile t-book spot rv" style={v({ "--d": 1 })}><img src={`${IMG}/robot-libro.webp`} alt="" loading="lazy" /><div><h3>Menos pantallas, más foco.</h3><p>El libro es el puente metodológico: ordena la secuencia didáctica, no necesita baterías y deja evidencia del aprendizaje.</p></div></article>
            <article className="tile t-feria spot rv"><div><h3>Feria de modelos a fin de año</h3><p>Sus estudiantes exponen a la comunidad educativa y motivan a los cursos que vienen.</p></div><div className="chip-row"><span>Pre-jardín → 11°</span><span>Enfoque STEM+H</span><span>Exposición anual</span></div></article>
          </div>
        </div>
      </section>

      {/* ============ 2 · Clase ============ */}
      <section id="clase">
        <div className="wrap">
          <div className="sec-head">
            <div><p className="kicker rv">02 · Así es una clase</p><h2 className="rv" style={v({ "--d": 1 })}>De la idea al robot <em>en&nbsp;2&nbsp;horas.</em></h2></div>
            <p className="rv" style={v({ "--d": 2 })}>Grupos de máximo tres estudiantes por mesa. Cada sesión recorre el ciclo completo; al final del año, compiten.</p>
          </div>
          <div className="steps rv">
            <article className="step glass-card"><span className="n">01 · Diseña</span><h3>Concepto y experimentación</h3><p>Fuerza, máquinas simples y movimiento, con modelos iniciales en materiales básicos o reciclables.</p></article>
            <article className="step glass-card"><span className="n">02 · Construye</span><h3>Montaje con el kit</h3><p>El texto del alumno guía el montaje del robot pieza a pieza.</p></article>
            <article className="step glass-card"><span className="n">03 · Programa</span><h3>Programación</h3><p>Pensamiento computacional aplicado: del bloque visual al algoritmo.</p></article>
            <article className="step glass-card arena-step"><span className="n">04 · Compite</span><h3>Arena ALESYA X</h3><p>Los equipos ponen a prueba su robot en retos de laberinto, base y globos.</p></article>
          </div>
        </div>
      </section>

      {/* ============ 3 · Niveles ============ */}
      <section id="niveles">
        <div className="wrap">
          <div className="sec-head">
            <div><p className="kicker rv">03 · Ruta por niveles</p><h2 className="rv" style={v({ "--d": 1 })}>Un kit para cada <em>etapa.</em></h2></div>
            <p className="rv" style={v({ "--d": 2 })}>El texto del alumno acompaña todos los grados. El kit se elige según el nivel y el equipamiento que ya tiene el colegio.</p>
          </div>
          <div className="tabs rv" role="tablist" aria-label="Niveles">
            {LEVELS.map((item, index) => <button key={item.key} className="tab" role="tab" type="button" aria-selected={index === level} style={v({ "--c": item.color })} onClick={() => { setLevel(index); setLevelTouched(true); }}><i />{item.tab}</button>)}
          </div>
          <div className="rv">
            <div key={lv.key} className={`level${levelTouched ? " swap" : ""}`} style={v({ "--c": lv.color })} role="tabpanel" aria-label={lv.tab}>
              <div className="level-art spot" onPointerMove={tilt} onPointerLeave={untilt}>
                <img src={lv.img} alt={lv.name} style={lv.pos ? { objectPosition: lv.pos } : undefined} loading="lazy" />
                <span className="badge">{lv.tab}</span>
                <div className="count"><b>{num(students[lv.key])}</b><span>estudiantes en su colegio</span></div>
              </div>
              <div className="level-body glass-card">
                <span className="kind">{lv.kind}</span><h3>{lv.name}</h3><p>{lv.text}</p>
                <ul className="specs">{lv.specs.map((spec) => <li key={spec}>{spec}</li>)}</ul>
                <div className="level-price"><span>{lv.key === "pre" ? "Texto + cuento" : `Texto + ${packLabel(pack)} STEM`}</span><b>{cop(lvPrice)}<small>/ estudiante</small></b></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 4 · Arena ============ */}
      <section id="arena">
        <div className="wrap">
          <div className="sec-head">
            <div><p className="kicker rv"><span className="dot" />04 · Arena ALESYA X</p><h2 className="rv" style={v({ "--d": 1 })}>No solo aprenden robótica: <em>compiten.</em></h2></div>
            <p className="rv" style={v({ "--d": 2 })}>Nuestra propia arena de competencia, con simulador 3D. Pruébela desde aquí: maneje un robot, capture la base y pinche los globos rivales.</p>
          </div>
          <div className="rv">
            <div className={`arena-frame${arenaLive ? " live" : ""}`}>
              {arenaLive ? <iframe ref={iframeRef} src={ARENA_URL} title="Arena ALESYA X, simulador 3D" allow="fullscreen; gamepad; autoplay" />
                : <>
                  <img src={`${IMG}/arena-portada.jpg`} alt="Arena ALESYA X: pista con cuatro equipos de robots" loading="lazy" />
                  <div className="hud" aria-hidden="true"><i /><i /><i /><i /><span className="tl">Modo 01 / Captura la base</span><span className="tr">● Simulador 3D</span><span className="bl">2,40 × 2,40 m · 4 equipos</span></div>
                  <button className="play" type="button" onClick={playArena}><b><svg viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg></b>Jugar la Arena aquí</button>
                </>}
            </div>
            {arenaLive && <div className="arena-tools"><span className="note" style={{ marginRight: "auto" }}>Teclado: WASD o flechas · E pincha · C cambia la cámara. En celular, controles táctiles.</span><button className="btn glass sm" type="button" onClick={() => { const frame = iframeRef.current as (HTMLIFrameElement & { webkitRequestFullscreen?: () => void }) | null; if (frame?.requestFullscreen) void frame.requestFullscreen().catch(() => undefined); else frame?.webkitRequestFullscreen?.(); }}>Pantalla completa</button><a className="btn glass sm" href={ARENA_URL} target="_blank" rel="noopener noreferrer" onClick={() => tracker.arena()}>Abrir aparte</a></div>}
          </div>
          <ul className="facts">
            <li className="glass-card rv"><b>5</b><span>laberintos, de iniciación a Arena XL</span></li>
            <li className="glass-card rv" style={v({ "--d": 1 })}><b>4</b><span>equipos con dos globos cada uno</span></li>
            <li className="glass-card rv" style={v({ "--d": 2 })}><b>Juez</b><span>valida un reto de fundamentos por globo</span></li>
            <li className="glass-card rv" style={v({ "--d": 3 })}><b>2 robots</b><span>tracción diferencial o Mecanum 4×4</span></li>
          </ul>
        </div>
      </section>

      {/* ============ 5 · Inversión ============ */}
      <section id="inversion">
        <div className="wrap">
          <div className="sec-head">
            <div><p className="kicker rv">05 · Su inversión</p><h2 className="rv" style={v({ "--d": 1 })}>Calculada para <em className="dot-after">{p.organization}</em></h2></div>
            <p className="rv" style={v({ "--d": 2 })}>{p.plan.fromQuote ? "Parte de su cotización. Ajuste estudiantes y paquete para explorar otros escenarios: el total se actualiza al instante y su asesor confirma cualquier cambio." : "Ajuste el número de estudiantes y el paquete. El total se actualiza al instante; su asesor confirma la cotización formal."}</p>
          </div>
          <div className="calc">
            <form className="calc-in glass-card rv" onSubmit={(event) => event.preventDefault()}>
              {CALC_FIELDS.map((field) => {
                const max = Math.max(field.min, Math.ceil(base[field.key] * 1.5 / 50) * 50);
                const price = levelPrice(p.plan, field.key, pack);
                return <div key={field.key} className="field" style={v({ "--c": field.color })}>
                  <div className="row"><label htmlFor={`pv-${field.key}`}>{field.label}<small>{field.key === "pre" ? `Texto + cuento «Igor el Robot» · ${cop(price)}` : `Texto + proyectos STEM · ${cop(price)}`}</small></label><output htmlFor={`pv-${field.key}`}>{num(students[field.key])}</output></div>
                  <input type="range" id={`pv-${field.key}`} min={0} max={max} step={5} value={students[field.key]} style={v({ "--fill": `${students[field.key] / max * 100}%` })} onChange={(event) => { const value = Number(event.target.value); setStudents((current) => ({ ...current, [field.key]: value })); }} />
                </div>;
              })}
              <div className="field"><label>Proyectos STEM por estudiante (primaria y bachillerato)</label>
                <div className="seg">{PROGRAM_PACKS.map((option) => <button key={option} type="button" aria-pressed={option === pack} onClick={() => setPack(option)}>{packLabel(option)}<small>{cop(levelPrice(p.plan, students.pri || !students.bach ? "pri" : "bach", option))}</small></button>)}</div>
              </div>
            </form>
            <div className="calc-out glass-card rv" style={v({ "--d": 1 })}>
              <div className="total"><small>{adjusted ? "Inversión estimada con sus cambios" : p.plan.fromQuote ? "Inversión anual de su propuesta" : "Inversión anual estimada en textos"}</small><b><AnimatedMoney cents={calcTotal} /></b></div>
              <p className="permonth">{cop(calcMonth)}<span>por estudiante al mes</span></p>
              <div className="lines">
                {CALC_FIELDS.map((field) => <div key={field.key}><span>{field.label} · {num(students[field.key])} × {cop(levelPrice(p.plan, field.key, pack))}</span><b>{cop(t.byLevel[field.key])}</b></div>)}
                {p.plan.extras.map((extra, index) => <div key={`${extra.description}-${index}`}><span>{extra.description}</span><b>{cop(extra.totalInCents)}</b></div>)}
                {p.plan.discountInCents > 0 && <div><span>Descuento</span><b>− {cop(p.plan.discountInCents)}</b></div>}
                <div><span>Estudiantes en la ruta</span><b>{num(t.est)}</b></div>
              </div>
              {adjusted && <p className="adjusted"><span>Su propuesta formal {p.number} es de <b>{cop(p.totalInCents)}</b>.</span><button type="button" onClick={() => { setStudents(base); setPack(p.plan.pack); }}>Volver a la propuesta</button></p>}
              <p className="note">{p.plan.fromQuote ? `Valores por estudiante de la cotización ${p.number}, en pesos colombianos. Con otro paquete rigen los valores del catálogo 2025–2026.` : `Valores del catálogo 2025–2026 por estudiante, en pesos colombianos. Los kits Bee-bot, MART-02 y TECH-R3 se cotizan aparte, según el equipamiento del colegio. La cotización formal ${p.number} suma ${cop(p.totalInCents)}.`} El valor mensual reparte el total en {SCHOOL_MONTHS} meses de año escolar. <a href={`/cotizacion/${p.token}`} target="_blank" rel="noopener noreferrer"><u>Cotización formal y condiciones</u></a>.</p>
              {decidable && !adjusted
                ? <button className="btn primary" type="button" style={{ marginTop: "auto" }} onClick={openAccept}>Aceptar la propuesta<Arrow /></button>
                : <a className="btn primary" href={wa("accept")} target="_blank" rel="noopener noreferrer" style={{ marginTop: "auto" }}>{adjusted ? "Pedir el ajuste a mi asesor" : "Confirmar con mi asesor"}<Arrow /></a>}
            </div>
          </div>
        </div>
      </section>

      {/* ============ 6 · Plan ============ */}
      <section id="plan">
        <div className="wrap">
          <div className="sec-head">
            <div><p className="kicker rv">06 · Plan de implementación</p><h2 className="rv" style={v({ "--d": 1 })}>Del sí al aula, <em>paso a paso.</em></h2></div>
            <p className="rv" style={v({ "--d": 2 })}>Acompañamos al colegio desde el diagnóstico hasta la feria de fin de año.</p>
          </div>
          <ol className="plan">
            {[["var(--cyan)", "Semana 1", "Diagnóstico", "Conversamos con coordinación sobre grados, número de estudiantes y equipos con que ya cuenta."],
              ["var(--violet)", "Semana 2", "Ruta pedagógica y pedido", "Ajustamos textos y kits por grado y emitimos la cotización formal."],
              ["var(--magenta)", "Semanas 3–4", "Entrega y formación docente", "Materiales en el aula y acompañamiento a los docentes para llevar la ruta a clase."],
              ["var(--yellow)", "Año escolar", "Clases semanales", "Dos horas en bloque con texto, kit y software."],
              ["var(--lime)", "Cierre", "Feria y Arena", "Exposición de modelos para la comunidad y competencia por equipos en la Arena ALESYA X."]].map(([color, when, title, text]) => <li key={title} className="rv" style={v({ "--c": color })}><span className="when">{when}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}
          </ol>
        </div>
      </section>

      {/* ============ 7 · Confianza ============ */}
      <section id="confianza">
        <div className="wrap">
          <div className="sec-head"><div><p className="kicker rv">07 · Respaldo</p><h2 className="rv" style={v({ "--d": 1 })}>Colegios que ya <em>construyen</em> con Alesya.</h2></div></div>
          <div className="proof">
            <figure className="proof-photo rv"><img src={`${IMG}/portada.jpg`} alt="Estudiantes con los brazos robóticos que construyeron y programaron" loading="lazy" /><figcaption>Estudiantes de bachillerato con los brazos mecánicos que construyeron y programaron.</figcaption></figure>
            <div className="allies">
              <div className="ally glass-card spot rv"><span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10L12 5 2 10l10 5 10-5z" /><path d="M6 12v5c3 2 9 2 12 0v-5" /></svg></span><div><b>Aliado pedagógico</b><span>Universidad Cooperativa de Colombia</span></div></div>
              <div className="ally glass-card spot rv" style={v({ "--d": 1 })}><span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3" /></svg></span><div><b>Sponsor de RoboYork</b><span>Competencia del Colegio Nueva York</span></div></div>
              <div className="ally glass-card spot rv" style={v({ "--d": 2 })}><span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h10M7 13h6" /></svg></span><div><b>Editorial con autores propios</b><span>Textos de pre-jardín a bachillerato y el cuento «Igor el Robot»</span></div></div>
            </div>
          </div>
          <div className="marquee rv" aria-label="Colegios que confían en Alesya">
            <div className="track">
              {logos.map((logo) => <img key={logo.file} src={`/media/clientes/${logo.file}`} alt={logo.name} loading="lazy" />)}
              {logos.map((logo) => <img key={`${logo.file}-copia`} src={`/media/clientes/${logo.file}`} alt="" aria-hidden="true" loading="lazy" />)}
            </div>
          </div>
        </div>
      </section>

      {/* ============ 8 · Siguiente paso ============ */}
      <section id="siguiente" className="close">
        <div className="wrap">
          <p className="kicker rv"><span className="dot" />08 · Siguiente paso</p>
          <h2 className="rv" style={v({ "--d": 1 })}>{status === "accepted" ? "La robótica llega a " : "Llevemos la robótica a "}<em className="dot-after">{p.organization}</em></h2>
          <p className="rv" style={v({ "--d": 2 })}>{status === "accepted" ? `${asesorFirst} coordina con ustedes la entrega y la formación docente.` : status === "rejected" ? "Su respuesta quedó registrada. Si algo cambia, seguimos aquí." : status === "expired" ? "La vigencia de esta propuesta terminó; la actualizamos el mismo día hábil." : `Acepte la propuesta o agende el diagnóstico sin costo. ${asesorFirst} le responde el mismo día hábil.`}</p>
          <div className="rv" style={v({ "--d": 3 })}>
            {status === "accepted" ? <div className="result glass-card" role="status">
                <span className="mark"><Check /></span>
                <h3>Propuesta aceptada{!outcome && p.decidedOn ? ` el ${p.decidedOn}` : ""}</h3>
                <p>Gracias por confiar en Alesya. {asesorFirst} los contactará para coordinar el inicio.</p>
                <div className="cta-row"><a className="btn wa" href={wa("hello")} target="_blank" rel="noopener noreferrer"><Whatsapp />Escribir a mi asesor</a><a className="btn glass" href={BROCHURE} download>Descargar brochure PDF</a></div>
              </div>
              : status === "rejected" ? <div className="result glass-card" data-tone="calm" role="status">
                <span className="mark"><Check /></span>
                <h3>Recibimos su respuesta</h3>
                <p>Gracias por contarnos. Si quieren retomarla, {asesorFirst === "Su asesor" ? "su asesor" : asesorFirst} les ayuda a ajustarla.</p>
                <div className="cta-row"><a className="btn wa" href={wa("hello")} target="_blank" rel="noopener noreferrer"><Whatsapp />Escribir a mi asesor</a></div>
              </div>
              : status === "expired" ? <div className="result glass-card" data-tone="calm">
                <h3>Esta propuesta venció el {p.validLong}</h3>
                <p>Escríbanos y le enviamos una actualizada.</p>
                <div className="cta-row"><a className="btn primary" href={wa("renew")} target="_blank" rel="noopener noreferrer">Pedir propuesta actualizada<Arrow /></a><a className="btn glass" href={BROCHURE} download>Descargar brochure PDF</a></div>
              </div>
              : mode === "confirm" ? <div className="decide glass-card" role="dialog" aria-labelledby="pv-accept-title">
                <h3 id="pv-accept-title">¿Aceptan la propuesta {p.number}?</h3>
                <dl><dt>Colegio</dt><dd>{p.organization}</dd><dt>Estudiantes</dt><dd>{num(baseEst)}</dd><dt>Inversión</dt><dd>{cop(p.totalInCents)}</dd><dt>Vigente hasta</dt><dd>{p.validLong}</dd></dl>
                {adjusted && <p className="warn">Usted ajustó la calculadora. La aceptación es sobre la propuesta formal; para cambiar cantidades o paquete, <a href={wa("accept")} target="_blank" rel="noopener noreferrer"><u>escríbale a su asesor</u></a>.</p>}
                <p>Al aceptar, {asesorFirst === "Su asesor" ? "su asesor" : asesorFirst} los contactará para coordinar la entrega y la formación docente. <a href={`/cotizacion/${p.token}`} target="_blank" rel="noopener noreferrer"><u>Ver la cotización formal y sus condiciones</u></a>.</p>
                {error && <p className="err" role="alert">{error}</p>}
                <div className="actions"><button className="btn primary" type="button" disabled={busy} onClick={() => void decide("accepted")}><Check />{busy ? "Registrando…" : "Sí, aceptar la propuesta"}</button><button className="btn glass" type="button" disabled={busy} onClick={() => setMode(null)}>Cancelar</button></div>
              </div>
              : mode === "reject" ? <form className="decide glass-card" onSubmit={(event) => { event.preventDefault(); void decide("rejected"); }}>
                <h3>¿Qué ajustaría?</h3>
                <p>Cuéntenos qué no encaja: presupuesto, cantidades o fechas. {asesorFirst} lo revisa y le propone una alternativa.</p>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="Comentario (opcional)" aria-label="Comentario" />
                {error && <p className="err" role="alert">{error}</p>}
                <div className="actions"><button className="btn glass" type="submit" disabled={busy}>{busy ? "Enviando…" : "Enviar respuesta"}</button><button className="btn glass" type="button" disabled={busy} onClick={() => setMode(null)}>Volver</button></div>
              </form>
              : <>
                <div className="cta-row">
                  {decidable ? <button className="btn primary" type="button" onClick={openAccept}>Aceptar la propuesta<Check /></button>
                    : <a className="btn primary" href={wa("accept")} target="_blank" rel="noopener noreferrer">Confirmar con mi asesor<Arrow /></a>}
                  <a className="btn glass" href={wa("meet")} target="_blank" rel="noopener noreferrer">Agendar diagnóstico</a>
                  <a className="btn glass" href={BROCHURE} download>Descargar brochure PDF</a>
                </div>
                {decidable && <button type="button" className="link-quiet" onClick={() => { setMode("reject"); setError(""); }}>¿No es el momento? Cuéntenos qué ajustaría</button>}
              </>}
          </div>
          {(status === "sent" || status === "draft") && <div className="validity rv" style={v({ "--d": 4 })}><span className="days">{p.daysLeft === 1 ? "1 día" : `${p.daysLeft} días`}</span><span>Propuesta <b>{p.number}</b> válida hasta <b>{p.validLong}</b></span></div>}
        </div>
      </section>
    </main>

    <footer className="pv-foot"><div className="wrap"><span>Alesya Ediciones · Alesya X-Tech · Funza, Cundinamarca</span><span><a href="mailto:comercial@alesyaediciones.com">comercial@alesyaediciones.com</a> · <a href="/colegios">alesyaediciones.com</a></span></div></footer>

    <div className="dock"><a className="btn wa" href={wa("hello")} target="_blank" rel="noopener noreferrer">WhatsApp</a><a className="btn primary" href="#inversion">Mi inversión</a></div>

    <div className="present-hud" role="toolbar" aria-label="Controles de presentación">
      <button type="button" aria-label="Anterior" onClick={() => go(-1)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg></button>
      <span>{active + 1} / {PROPOSAL_SECTIONS.length}</span>
      <button type="button" aria-label="Siguiente" onClick={() => go(1)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg></button>
      <button type="button" aria-label="Salir de la presentación" onClick={() => setPresentMode(false)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
    </div>
  </div>;
}
