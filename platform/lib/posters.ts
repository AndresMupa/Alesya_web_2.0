/** Videos incluidos en public/media que tienen carátula en public/media/posters (scripts/optimize-media.mjs). */
const bundled = new Set(["robotica-aula", "electronica", "impresion-3d", "lego-ev3"]);

/** Imagen que se ve antes de que el video cargue: la elegida en el editor o, si no hay, la carátula del video incluido. */
export function posterFor(video: string, image?: string | null) {
  if (image) return image;
  const match = /^\/media\/([a-z0-9-]+)\.mp4$/.exec(video);
  return match && bundled.has(match[1]) ? `/media/posters/${match[1]}.jpg` : undefined;
}
