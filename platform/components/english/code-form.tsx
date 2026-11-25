"use client";

import { FormEvent, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { normalizeCode } from "@/lib/english/levels";

type Result = { ok?: boolean; message?: string; label?: string; grades?: number[]; unlocked?: number[] };

const gradeList = (grades: number[]) => grades.map((grade) => `${grade}°`).join(", ").replace(/, ([^,]*)$/, " y $1");

/**
 * Canje del código del libro. Al aceptarlo refresca la página: el servidor vuelve a leer el acceso y muestra el
 * material desbloqueado. `grade` es el grado de la página actual, para avisar si el código es de otro grado.
 */
export function CodeForm({ grade, tone = "dark", autoFocus, onUnlocked }: { grade?: number; tone?: "dark" | "light"; autoFocus?: boolean; onUnlocked?: () => void }) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (normalizeCode(value).length < 6) { setError("Escribe el código completo, tal como aparece en tu libro."); input.current?.focus(); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/ingles/acceso", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: value }) });
      const result = await response.json().catch(() => ({})) as Result;
      if (!response.ok) { setError(result.message ?? "No pudimos validar el código. Intenta de nuevo."); input.current?.focus(); return; }
      const grades = result.grades ?? [];
      if (grade && !grades.includes(grade)) toast.warning(`Código aceptado para ${gradeList(grades)}. No incluye ${grade}°: revisa que sea el código de este grado.`, { duration: 8000 });
      else toast.success(grades.length === 5 ? "¡Listo! Tienes acceso a todos los grados." : `¡Listo! Ya puedes usar el material de ${gradeList(grades)}.`);
      setValue("");
      onUnlocked?.();
      router.refresh();
    } catch { setError("Sin conexión. Revisa tu internet e intenta de nuevo."); }
    finally { setBusy(false); }
  }

  return <form className={`eng-code-form is-${tone}`} onSubmit={submit} noValidate>
    <label htmlFor={id}><KeyRound size={16} aria-hidden="true" /> Código de acceso</label>
    <div className="eng-code-row">
      <input ref={input} id={id} name="code" value={value} autoFocus={autoFocus} onChange={(event) => { setValue(event.target.value.toUpperCase().replace(/[^A-Z0-9 -]/g, "").slice(0, 32)); setError(""); }}
        placeholder="XXXX-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text" aria-invalid={error ? true : undefined} aria-describedby={`${id}-help`} />
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? <LoaderCircle size={18} className="eng-spin" aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}<span>{busy ? "Validando" : "Desbloquear"}</span></button>
    </div>
    <p id={`${id}-help`} className={error ? "eng-code-error" : "eng-code-help"} role={error ? "alert" : undefined}>{error || "Está en la primera página de tu libro Alesya o te lo entrega tu colegio."}</p>
  </form>;
}
