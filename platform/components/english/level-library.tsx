"use client";

/* eslint-disable @next/next/no-img-element -- las imágenes de actividades salen de /ingles/archivo (privado, sin optimizador en cPanel). */
import { useMemo, useState } from "react";
import { Download, ExternalLink, Lock, Sparkles } from "lucide-react";
import { CodeForm } from "@/components/english/code-form";
import { Modal } from "@/components/english/modal";
import { formatBytes, resourceTypes, RESOURCE_TYPES, type PublicResource as LibraryResource, type ResourceType } from "@/lib/english/levels";


type Tab = "all" | ResourceType;
const fileUrl = (id: string, download = false) => `/ingles/archivo/${id}${download ? "?descargar=1" : ""}`;
const isAudio = (resource: LibraryResource) => resource.type === "audio" || (resource.type === "activity" && (resource.format === "MP3" || resource.format === "M4A" || resource.format === "OGG" || resource.format === "WAV"));
const isImage = (resource: LibraryResource) => resource.format === "JPG" || resource.format === "PNG" || resource.format === "WEBP";
const isOffice = (resource: LibraryResource) => resource.format === "DOCX" || resource.format === "PPTX" || resource.format === "XLSX";

/** Material de un grado: pestañas por tipo, agrupado por unidad, con lector, reproductor y videos en ventana. */
export function LevelLibrary({ resources, unlocked, grade, ordinal }: { resources: LibraryResource[]; unlocked: boolean; grade: number; ordinal: string }) {
  const [tab, setTab] = useState<Tab>("all");
  const [viewer, setViewer] = useState<LibraryResource | null>(null);
  const [askCode, setAskCode] = useState(false);

  const counts = useMemo(() => Object.fromEntries(RESOURCE_TYPES.map((type) => [type, resources.filter((item) => item.type === type).length])) as Record<ResourceType, number>, [resources]);
  const visible = tab === "all" ? resources : resources.filter((item) => item.type === tab);
  const units = useMemo(() => {
    const groups = new Map<string, LibraryResource[]>();
    for (const item of visible) groups.set(item.unit || "", [...(groups.get(item.unit || "") ?? []), item]);
    // Lo que no tiene unidad va al final como material general.
    return [...groups.entries()].sort(([a], [b]) => (a === "" ? 1 : 0) - (b === "" ? 1 : 0));
  }, [visible]);

  function open(resource: LibraryResource) {
    if (!unlocked && !resource.free) { setAskCode(true); return; }
    // En pantallas pequeñas el visor de PDF del navegador funciona mejor en su propia pestaña.
    if (resource.format === "PDF" && window.matchMedia("(max-width: 760px)").matches) { window.open(fileUrl(resource.id), "_blank", "noopener"); return; }
    setViewer(resource);
  }

  if (!resources.length) return <div className="eng-empty">
    <Sparkles size={30} aria-hidden="true" />
    <h3>Estamos preparando el material de {ordinal}</h3>
    <p>Muy pronto encontrarás aquí el libro digital, los audios, los videos y las actividades de este grado.</p>
  </div>;

  const tabs: { key: Tab; label: string; count: number }[] = [{ key: "all", label: "Todo", count: resources.length }, ...RESOURCE_TYPES.filter((type) => counts[type]).map((type) => ({ key: type, label: resourceTypes[type].plural, count: counts[type] }))];

  return <div className="eng-library">
    <div className="eng-tabs" role="tablist" aria-label="Tipo de material">
      {tabs.map((item) => {
        const Icon = item.key === "all" ? null : resourceTypes[item.key].icon;
        return <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} className={tab === item.key ? "is-active" : undefined} onClick={() => setTab(item.key)}>
          {Icon && <Icon size={16} aria-hidden="true" />}{item.label}<span>{item.count}</span>
        </button>;
      })}
    </div>

    <div role="tabpanel" className="eng-units">
      {units.map(([unit, items]) => <section className="eng-unit" key={unit || "general"} aria-label={unit || "Material general"}>
        <h3 className="eng-unit-title"><span>{unit || "Material general"}</span><small>{items.length} {items.length === 1 ? "recurso" : "recursos"}</small></h3>
        <ul className="eng-resources">
          {items.map((resource) => <ResourceCard key={resource.id} resource={resource} locked={!unlocked && !resource.free} onOpen={() => open(resource)} />)}
        </ul>
      </section>)}
    </div>

    <Modal open={askCode} onClose={() => setAskCode(false)} title={`Desbloquea el material de ${ordinal}`} subtitle="Con el código de tu libro o de tu colegio">
      <div className="eng-dialog-copy"><p>Este recurso es parte del material completo de {ordinal}. Escribe tu código una sola vez y queda guardado en este navegador.</p><CodeForm grade={grade} tone="light" autoFocus onUnlocked={() => setAskCode(false)} /></div>
    </Modal>

    {viewer && <Viewer resource={viewer} onClose={() => setViewer(null)} />}
  </div>;
}

function ResourceCard({ resource, locked, onOpen }: { resource: LibraryResource; locked: boolean; onOpen: () => void }) {
  const meta = resourceTypes[resource.type];
  const Icon = meta.icon;
  const audio = !locked && resource.hasFile && isAudio(resource);
  const downloadOnly = !locked && isOffice(resource);
  const details = [resource.embed ? "Video en línea" : resource.format, formatBytes(resource.size)].filter(Boolean).join(" · ");
  return <li className={`eng-res is-${resource.type}${locked ? " is-locked" : ""}`}>
    <span className="eng-res-icon" aria-hidden="true"><Icon size={22} /></span>
    <div className="eng-res-body">
      <p className="eng-res-kind">{meta.label}{details && <span>{details}</span>}{resource.free && <b className="eng-badge">Muestra gratis</b>}</p>
      <h4>{resource.title}</h4>
      {resource.description && <p className="eng-res-text">{resource.description}</p>}
      {audio && <audio className="eng-audio" controls preload="none" src={fileUrl(resource.id)}><a href={fileUrl(resource.id, true)}>Descargar audio</a></audio>}
    </div>
    <div className="eng-res-actions">
      {locked ? <button type="button" className="eng-res-button is-locked" onClick={onOpen}><Lock size={15} aria-hidden="true" /> Desbloquear</button>
        : downloadOnly ? <a className="eng-res-button" href={fileUrl(resource.id, true)} download><Download size={15} aria-hidden="true" /> Descargar</a>
        : !audio ? <button type="button" className="eng-res-button" onClick={onOpen}>{meta.action}</button> : null}
      {!locked && resource.hasFile && !downloadOnly && <a className="eng-icon-button" href={fileUrl(resource.id, true)} download aria-label={`Descargar ${resource.title}`} title="Descargar"><Download size={17} /></a>}
    </div>
  </li>;
}

/** Lector de libros y actividades (PDF o imagen) y reproductor de video, en ventana. */
function Viewer({ resource, onClose }: { resource: LibraryResource; onClose: () => void }) {
  const isVideo = resource.type === "video";
  const actions = resource.hasFile ? <>
    {!isVideo && <a className="eng-modal-link" href={fileUrl(resource.id)} target="_blank" rel="noopener"><ExternalLink size={15} aria-hidden="true" /> Pestaña nueva</a>}
    <a className="eng-modal-link" href={fileUrl(resource.id, true)} download><Download size={15} aria-hidden="true" /> Descargar</a>
  </> : null;
  return <Modal open onClose={onClose} title={resource.title} subtitle={[resource.unit, resourceTypes[resource.type].label].filter(Boolean).join(" · ")} actions={actions} size={isVideo ? "large" : "full"}>
    {isVideo ? <div className="eng-video">{resource.embed
      ? <iframe src={`${resource.embed}&autoplay=1`} title={resource.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      : <video src={fileUrl(resource.id)} controls autoPlay playsInline />}</div>
      : isImage(resource) ? <div className="eng-image"><img src={fileUrl(resource.id)} alt={resource.title} /></div>
      : <iframe className="eng-reader" src={`${fileUrl(resource.id)}#view=FitH`} title={resource.title} />}
  </Modal>;
}
