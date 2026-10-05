import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** Manifiesto web: nombre, colores e íconos cuando se agrega el sitio a la pantalla de inicio del celular. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: "Alesya",
    description: site.description,
    lang: "es-CO",
    start_url: "/",
    display: "browser",
    background_color: "#080f1b",
    theme_color: "#080f1b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
