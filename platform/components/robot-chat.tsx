"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";

type Message = { id: number; from: "bot" | "user"; text: string; actions?: { label: string; href: string }[] };

type Intent = {
  keys: string[];
  reply: string;
  actions?: { label: string; href: string }[];
};

// Base de conocimiento de Bambú (respuestas locales, sin depender de un servicio externo).
const intents: Intent[] = [
  {
    keys: ["hola", "buenas", "hey", "saludos", "que tal", "holi"],
    reply: "¡Hola! Soy Bambú 🐼, el panda de Alesya X-Tech. Puedo contarte sobre kits, proyectos, precios, envíos y programas para colegios. ¿Qué quieres construir hoy?",
  },
  {
    keys: ["precio", "cuesta", "vale", "valor", "cuanto", "costo", "tarifa"],
    reply: "Estos son algunos precios de referencia:\n• Kit Arduino Explorador — $289.000\n• Ruta LEGO EV3 (libro + recursos) — $119.000\n• Kit Mecanismos WeDo — $349.000\n• Laboratorio de impresión 3D — $179.000\n¿Quieres ver el catálogo completo?",
    actions: [{ label: "Ver catálogo", href: "/catalogo" }],
  },
  {
    keys: ["arduino", "electronica", "sensor", "microcontrolador"],
    reply: "El Kit Arduino Explorador trae placa, sensores, actuadores y una guía para 12 proyectos progresivos ($289.000). Es ideal para empezar en electrónica aplicada.",
    actions: [{ label: "Comprar Arduino", href: "/checkout?producto=kit-arduino-explorador" }],
  },
  {
    keys: ["lego", "ev3", "wedo", "robotica", "robot"],
    reply: "En robótica tenemos LEGO EV3 y WeDo: construcción, sensores, motores y programación por bloques. La Ruta LEGO EV3 incluye 8 retos con guía docente ($119.000).",
    actions: [
      { label: "Ver proyectos", href: "/proyectos" },
      { label: "Ruta LEGO EV3", href: "/checkout?producto=ruta-lego-ev3" },
    ],
  },
  {
    keys: ["3d", "impresion", "impresora", "prototipo", "fabricacion"],
    reply: "El Laboratorio de impresión 3D te lleva paso a paso por diseño, laminado y fabricación de un objeto funcional ($179.000). Perfecto para conectar ideas con el mundo físico.",
    actions: [{ label: "Ver programa", href: "/checkout?producto=laboratorio-impresion-3d" }],
  },
  {
    keys: ["proyecto", "ruta", "aprender", "curso", "aprendizaje", "clase"],
    reply: "Tenemos rutas de aprendizaje desde inicial hasta avanzado: circuitos, robot seguidor de línea, mecanismos WeDo y diseño con impresión 3D. Cada una con guías y actividades de aula.",
    actions: [{ label: "Explorar proyectos", href: "/proyectos" }],
  },
  {
    keys: ["colegio", "institucion", "escuela", "docente", "profesor", "aula", "programa"],
    reply: "Para colegios diseñamos programas completos: diagnóstico, dotación, formación docente, contenidos y seguimiento. No entregamos cajas, construimos capacidad. 🏫",
    actions: [{ label: "Soluciones para colegios", href: "/colegios" }],
  },
  {
    keys: ["envio", "entrega", "domicilio", "despacho", "llega"],
    reply: "Realizamos envíos a toda Colombia. El tiempo de entrega depende de tu ciudad y se confirma al finalizar la compra. Para pedidos institucionales grandes coordinamos logística especial.",
    actions: [{ label: "Escríbenos", href: "mailto:comercial@alesyaediciones.com" }],
  },
  {
    keys: ["pago", "pagar", "tarjeta", "wompi", "pse", "transferencia", "medios"],
    reply: "Puedes pagar de forma segura con tarjeta, PSE y otros medios a través de Wompi al momento del checkout. 🔒",
    actions: [{ label: "Ir a la tienda", href: "/catalogo" }],
  },
  {
    keys: ["contacto", "telefono", "correo", "email", "whatsapp", "hablar", "asesor"],
    reply: "Con gusto te conecto con el equipo humano:\n• Correo: comercial@alesyaediciones.com\n• Teléfono: +57 300 593 7840\nEstamos en Funza, Colombia.",
    actions: [
      { label: "Enviar correo", href: "mailto:comercial@alesyaediciones.com" },
      { label: "Llamar", href: "tel:+573005937840" },
    ],
  },
  {
    keys: ["gracias", "genial", "perfecto", "chevere", "excelente"],
    reply: "¡Con gusto! 🐼🎋 Si necesitas algo más, aquí estaré mordisqueando bambú y listo para ayudarte. ✨",
  },
  {
    keys: ["quien eres", "que eres", "nombre", "panda", "eres un bot", "bambu"],
    reply: "Soy Bambú, el panda curioso de Alesya X-Tech. Me encanta el bambú, la robótica y ayudarte a aprender haciendo. 🐼⚡",
  },
];

const fallback: Message = {
  id: -1,
  from: "bot",
  text: "Mmm, me quedé mordisqueando bambú 🎋 y no entendí bien 🤔. Puedo ayudarte con kits, precios, proyectos, envíos, pagos o programas para colegios. También puedes escribirle al equipo:",
  actions: [{ label: "Contactar equipo", href: "mailto:comercial@alesyaediciones.com" }],
};

const quickChips = ["Precios", "Robótica LEGO", "Proyectos", "Colegios", "Contacto"];

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function findReply(input: string): Message {
  const q = normalize(input);
  let best: Intent | null = null;
  let bestScore = 0;
  for (const intent of intents) {
    const score = intent.keys.reduce((acc, key) => (q.includes(normalize(key)) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      best = intent;
    }
  }
  if (!best) return { ...fallback, id: Date.now() };
  return { id: Date.now(), from: "bot", text: best.reply, actions: best.actions };
}

type Activity = "wave" | "build" | "eat";

// Panda alegre y animado — rota entre cositas curiosas: saluda con la patita,
// arma un robot de LEGO y come bambú; además parpadea, mira y mueve las orejas.
function PandaFace({ talking, activity }: { talking?: boolean; activity?: Activity }) {
  const cls = ["robot-face", "panda-face", talking ? "is-talking" : "", activity ? `is-${activity}` : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <svg viewBox="0 0 48 48" className={cls} aria-hidden="true">
      <g className="pf-float">
        {/* orejas */}
        <g className="pf-ear pf-ear-l"><circle cx="13" cy="13" r="6" className="pf-black" /><circle cx="13" cy="13" r="2.4" className="pf-inner" /></g>
        <g className="pf-ear pf-ear-r"><circle cx="35" cy="13" r="6" className="pf-black" /><circle cx="35" cy="13" r="2.4" className="pf-inner" /></g>
        {/* cabeza */}
        <ellipse cx="24" cy="27" rx="17" ry="15" className="pf-head" />
        {/* manchas de los ojos */}
        <ellipse cx="17.5" cy="25" rx="4.7" ry="6" className="pf-black pf-patch pf-patch-l" />
        <ellipse cx="30.5" cy="25" rx="4.7" ry="6" className="pf-black pf-patch pf-patch-r" />
        {/* cachetes */}
        <circle cx="12" cy="31.5" r="2.6" className="pf-blush" />
        <circle cx="36" cy="31.5" r="2.6" className="pf-blush" />
        {/* ojos */}
        <g className="pf-eyes">
          <circle cx="17.7" cy="25.6" r="2.6" className="pf-white" />
          <circle cx="30.3" cy="25.6" r="2.6" className="pf-white" />
          <g className="pf-pupils">
            <circle cx="17.7" cy="25.6" r="1.35" className="pf-black" />
            <circle cx="30.3" cy="25.6" r="1.35" className="pf-black" />
            <circle cx="18.2" cy="25.1" r="0.5" className="pf-white" />
            <circle cx="30.8" cy="25.1" r="0.5" className="pf-white" />
          </g>
        </g>
        {/* nariz + boca que mastica */}
        <ellipse cx="24" cy="30.6" rx="2" ry="1.4" className="pf-black" />
        <g className="pf-mouth">
          <path d="M24 32.2 q -2.6 2.8 -4.6 0.9" className="pf-line" />
          <path d="M24 32.2 q 2.6 2.8 4.6 0.9" className="pf-line" />
        </g>

        {/* patitas */}
        <ellipse cx="15" cy="43.5" rx="3.3" ry="2.7" className="pf-black pf-paw pf-paw-l" />
        <ellipse cx="33" cy="43.5" rx="3.3" ry="2.7" className="pf-black pf-paw pf-paw-r" />

        {/* 🧱 arma un robot de LEGO */}
        {activity === "build" && (
          <g className="pf-lego">
            <g className="pf-brick pf-brick1">
              <rect x="17" y="44" width="14" height="3.6" rx="1" className="pf-lego-red" />
              <rect x="19.2" y="42.7" width="2.4" height="1.6" rx="0.6" className="pf-lego-red" />
              <rect x="26.4" y="42.7" width="2.4" height="1.6" rx="0.6" className="pf-lego-red" />
            </g>
            <g className="pf-brick pf-brick2">
              <rect x="18.5" y="40.4" width="11" height="3.6" rx="1" className="pf-lego-yellow" />
              <rect x="20.6" y="39.1" width="2.2" height="1.6" rx="0.6" className="pf-lego-yellow" />
              <rect x="25.2" y="39.1" width="2.2" height="1.6" rx="0.6" className="pf-lego-yellow" />
            </g>
            <g className="pf-brick pf-brick3">
              <rect x="20" y="36.8" width="8" height="3.6" rx="1" className="pf-lego-blue" />
              <circle cx="22.3" cy="38.6" r="0.7" className="pf-white" />
              <circle cx="25.7" cy="38.6" r="0.7" className="pf-white" />
            </g>
          </g>
        )}

        {/* 🎋 come bambú */}
        {activity === "eat" && (
          <g className="pf-food">
            <rect x="31.6" y="37" width="2.3" height="8.5" rx="1.15" className="pf-stem" />
            <path d="M32 38.5 q -4 -1 -5.4 -4 q 4 0 5.4 4 z" className="pf-leaf" />
            <path d="M33.9 40 q 4 -1 5.4 -3.6 q -4 -0.2 -5.4 3.6 z" className="pf-leaf" />
          </g>
        )}
      </g>
    </svg>
  );
}

export function RobotChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      from: "bot",
      text: "¡Hola! Soy Bambú 🐼, el panda de Alesya X-Tech. Pregúntame por kits, proyectos, precios o programas para colegios.",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [activity, setActivity] = useState<Activity>("wave");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, open]);

  // Bambú va rotando entre sus cositas curiosas: saludar 👋, armar LEGO 🧱 y comer 🎋.
  useEffect(() => {
    const cycle: Activity[] = ["wave", "build", "eat"];
    let i = 0;
    const id = window.setInterval(() => {
      i = (i + 1) % cycle.length;
      setActivity(cycle[i]);
    }, 4200);
    return () => window.clearInterval(id);
  }, []);

  function send(raw: string) {
    const text = raw.trim();
    if (!text) return;
    const userMsg: Message = { id: Date.now() - 1, from: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    window.setTimeout(() => {
      setMessages((prev) => [...prev, findReply(text)]);
      setTyping(false);
    }, 650);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(input);
  }

  return (
    <div className="robot-chat">
      {open && (
        <div className="robot-panel" role="dialog" aria-label="Asistente panda Bambú">
          <header className="robot-panel-head">
            <div className="robot-panel-id">
              <span className="robot-avatar">
                <PandaFace talking={typing} activity={typing ? undefined : activity} />
              </span>
              <div>
                <strong>Bambú</strong>
                <small><span className="robot-online" /> Panda asistente · en línea</small>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar chat">
              <X size={18} />
            </button>
          </header>

          <div className="robot-log" ref={scrollRef}>
            {messages.map((msg) => (
              <div key={msg.id} className={`robot-msg robot-msg-${msg.from}`}>
                {msg.from === "bot" && (
                  <span className="robot-msg-avatar">
                    <PandaFace />
                  </span>
                )}
                <div className="robot-bubble">
                  {msg.text.split("\n").map((line, i) => (
                    <span key={i}>{line}</span>
                  ))}
                  {msg.actions && (
                    <div className="robot-actions">
                      {msg.actions.map((a) => (
                        <a key={a.href + a.label} href={a.href} className="robot-action">
                          {a.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {typing && (
              <div className="robot-msg robot-msg-bot">
                <span className="robot-msg-avatar"><PandaFace talking /></span>
                <div className="robot-bubble robot-typing"><i /><i /><i /></div>
              </div>
            )}
          </div>

          <div className="robot-chips">
            {quickChips.map((chip) => (
              <button key={chip} type="button" onClick={() => send(chip)}>
                {chip}
              </button>
            ))}
          </div>

          <form className="robot-input" onSubmit={onSubmit}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escríbele a Bambú…"
              aria-label="Mensaje para el panda"
              maxLength={280}
            />
            <button type="submit" aria-label="Enviar mensaje" disabled={!input.trim()}>
              <Send size={17} />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className={`robot-launcher ${open ? "is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar asistente Bambú" : "Abrir asistente Bambú"}
      >
        {open ? <X size={22} /> : <PandaFace activity={activity} />}
        {!open && <span className="robot-ping" />}
      </button>
    </div>
  );
}
