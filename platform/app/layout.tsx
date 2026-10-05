import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./store.css";
import { Toaster } from "sonner";
import { RobotChatLoader } from "@/components/robot-chat-loader";
import { site, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: site.title, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  keywords: [...site.keywords],
  authors: [{ name: site.publisher }],
  creator: site.publisher,
  publisher: site.publisher,
  category: "education",
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "48x48" }, { url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: { type: "website", locale: site.locale, siteName: site.name, title: site.title, description: site.description, images: [site.ogImage] },
  twitter: { card: "summary_large_image", title: site.title, description: site.description, images: [site.ogImage.url] },
};

export const viewport: Viewport = { themeColor: "#080f1b", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-CO"><body>{children}<RobotChatLoader /><Toaster position="bottom-center" richColors closeButton /></body></html>;
}
