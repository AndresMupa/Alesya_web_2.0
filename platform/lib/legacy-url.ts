/** Only retired WordPress endpoints: never apply these rules to checkout, APIs or admin. */
export function legacyUrlAction(url: URL): "gone" | "clean-catalog" | null {
  if (url.pathname === "/" && ["page_id", "thim_elementor_kit", "wc-ajax"].some((key) => url.searchParams.has(key))) return "gone";
  if (url.pathname === "/catalogo" && ["register", "lostpassword"].includes(url.searchParams.get("action") ?? "")) return "clean-catalog";
  return null;
}
