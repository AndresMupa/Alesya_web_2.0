"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";

export function AdminLogin({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json() as { message?: string };
      if (!response.ok) { setError(result.message || "No se pudo iniciar sesión."); return; }
      router.replace("/admin");
      router.refresh();
    } catch { setError("No pudimos conectar. Intenta nuevamente."); }
    finally { setBusy(false); }
  }
  return <form className="login-form" onSubmit={submit}>
    <span className="login-icon"><LockKeyhole size={25} /></span>
    <p className="eyebrow">Acceso privado</p><h1>Tu espacio<br />para hacer crecer<br /><em>Alesya.</em></h1>
    <p className="login-description">Gestiona productos, pedidos y relaciones desde un solo lugar.</p>
    <label htmlFor="admin-email">Correo electrónico</label><input id="admin-email" name="email" type="email" autoComplete="username" required maxLength={180} />
    <label htmlFor="admin-password">Contraseña</label><div className="login-password"><input id="admin-password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" required maxLength={256} /><button type="button" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
    {!configured && <p role="status" className="form-error">El acceso está pendiente de configuración por el propietario.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="button button-primary" disabled={busy || !configured} type="submit">{busy ? "Verificando…" : "Entrar al panel"}<ArrowRight size={18} /></button>
    <p className="login-note">Solo para el equipo autorizado de Alesya.</p>
  </form>;
}
