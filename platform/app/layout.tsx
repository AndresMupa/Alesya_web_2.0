import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alesya X Tech | Educación que se construye",
  description: "Robótica, Arduino, LEGO, impresión 3D, libros y proyectos maker para colegios, docentes y familias.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
