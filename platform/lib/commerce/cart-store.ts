"use client";

import { useSyncExternalStore } from "react";

/**
 * Carrito del navegador (localStorage). Guarda una copia de nombre y precio solo para pintar rápido:
 * el servidor recalcula precio y disponibilidad en /api/store/cart y al crear el pedido.
 */
export type CartItem = { slug: string; name: string; priceInCents: number; imageUrl: string | null; category: string; quantity: number };

const KEY = "alesya_cart_v1";
const EMPTY: CartItem[] = [];
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: CartItem[] = EMPTY;
let storageAvailable = true;

const valid = (item: unknown): item is CartItem => !!item && typeof item === "object" && typeof (item as CartItem).slug === "string" && Number.isInteger((item as CartItem).quantity) && (item as CartItem).quantity > 0;

function read(): CartItem[] {
  if (!storageAvailable) return cached;
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY); } catch { storageAvailable = false; return cached; }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try { const parsed = raw ? JSON.parse(raw) : []; cached = Array.isArray(parsed) ? parsed.filter(valid).slice(0, 50) : EMPTY; } catch { cached = EMPTY; }
  return cached;
}

function write(items: CartItem[]) {
  cached = items;
  const raw = JSON.stringify(items);
  try { window.localStorage.setItem(KEY, raw); cachedRaw = raw; } catch { storageAvailable = false; }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (event.key === KEY) listener(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

export const cart = {
  has(slug: string) { return read().some((item) => item.slug === slug); },
  add(product: Omit<CartItem, "quantity">, quantity = 1, max = 99) {
    const items = read();
    const existing = items.find((item) => item.slug === product.slug);
    const next = existing
      ? items.map((item) => item.slug === product.slug ? { ...item, ...product, quantity: Math.min(max, item.quantity + quantity) } : item)
      : [...items, { ...product, quantity: Math.min(max, quantity) }];
    write(next);
  },
  setQuantity(slug: string, quantity: number) {
    write(quantity <= 0 ? read().filter((item) => item.slug !== slug) : read().map((item) => item.slug === slug ? { ...item, quantity: Math.min(99, Math.trunc(quantity)) } : item));
  },
  remove(slug: string) { write(read().filter((item) => item.slug !== slug)); },
  clear() { write([]); },
};

export function useCart() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);
  return { items, count: items.reduce((acc, item) => acc + item.quantity, 0) };
}
