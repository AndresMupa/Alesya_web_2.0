import test from "node:test";
import assert from "node:assert/strict";
import { legacyUrlAction } from "./legacy-url.ts";
const action = (path) => legacyUrlAction(new URL(path, "https://www.alesyaediciones.com"));
test("retired WordPress resources never render an indexable homepage", () => {
  for (const path of ["/?page_id=2958&action=register", "/?thim_elementor_kit=topbar&action=lostpassword", "/?wc-ajax=%%endpoint%%"]) assert.equal(action(path), "gone");
});
test("obsolete registration query is cleaned only on the public catalog", () => {
  assert.equal(action("/catalogo?action=register&categoria=Libros"), "clean-catalog");
  assert.equal(action("/catalogo?action=lostpassword"), "clean-catalog");
  for (const path of ["/", "/?utm_source=google", "/catalogo?q=libros", "/catalogo?categoria=Libros", "/checkout?action=register", "/api/payment?action=register", "/admin?action=register", "/pedido?action=lostpassword"]) assert.equal(action(path), null);
});
