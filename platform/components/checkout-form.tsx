"use client";
import { FormEvent, useState } from "react";
import { ArrowRight, Building2, CreditCard, LockKeyhole, Smartphone } from "lucide-react";

type Product = { slug: string; name: string; price: string; priceInCents: number; description: string };

export function CheckoutForm({ product }: { product: Product }) {
  const [state, setState] = useState<"idle"|"saving"|"setup"|"error">("idle");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setState("saving");
    const customer = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/checkout", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ productSlug:product.slug, customer }) });
    const result = await response.json() as { checkoutUrl?: string; message?: string };
    if (response.ok && result.checkoutUrl) { window.location.href = result.checkoutUrl; return; }
    if (response.ok) { setMessage(result.message ?? "Pedido registrado."); setState("setup"); return; }
    setMessage(result.message ?? "No fue posible iniciar el pago."); setState("error");
  }
  return <form className="checkout-card" onSubmit={submit}><h1>Finaliza tu compra</h1><p>Datos de contacto y facturación.</p><div className="checkout-fields"><label>Nombre completo<input required name="name" /></label><label>Correo electrónico<input required type="email" name="email" /></label><label>Celular<input required name="phone" inputMode="tel" /></label><label>Ciudad<input required name="city" /></label><label className="wide">Dirección de entrega<input required name="address" /></label></div><h2 style={{marginTop:32}}>Método de pago</h2><div className="payment-methods"><label className="payment-method"><input defaultChecked type="radio" name="method" value="WOMPI" /><Smartphone /> Nequi</label><label className="payment-method"><input type="radio" name="method" value="WOMPI" /><Building2 /> Botón Bancolombia o PSE</label><label className="payment-method"><input type="radio" name="method" value="WOMPI" /><CreditCard /> Tarjeta débito o crédito</label></div><p className="secure-note"><LockKeyhole size={28} />Los datos financieros se procesan directamente en el checkout seguro de Wompi. Alesya no almacena números de tarjeta ni claves bancarias.</p>{(state === "setup" || state === "error") && <div className="checkout-status">{message}</div>}<button className="button button-primary" disabled={state === "saving"} type="submit">{state === "saving" ? "Preparando pago…" : `Pagar ${product.price}`} <ArrowRight size={18} /></button></form>;
}
