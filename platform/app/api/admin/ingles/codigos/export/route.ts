import { authorizeAdmin } from "@/lib/admin-auth";
import { formatCode } from "@/lib/english/levels";
import { listCodes } from "@/lib/english/resources";
import { csvResponse, toCsv } from "@/lib/csv";
import { bogotaDay } from "@/lib/format";
import { handleError } from "@/lib/http";

const day = (value: Date | null) => value ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(value) : "";

/** Códigos en CSV para imprimir o repartir. `?lote=<nombre>` deja solo los de ese lote. */
export async function GET(request: Request) {
  const admin = await authorizeAdmin(); if (admin instanceof Response) return admin;
  const lote = new URL(request.url).searchParams.get("lote");
  try {
    const codes = (await listCodes(20000)).filter((code) => !lote || code.label === lote);
    const rows = codes.map((code) => [formatCode(code.code), code.label, code.grades === "all" ? "1,2,3,4,5" : code.grades, code.maxUses ?? "ilimitado", code.uses, day(code.expiresAt), code.active ? "activo" : "inactivo"]);
    return csvResponse(`codigos-ingles-${bogotaDay()}.csv`, toCsv(["codigo", "lote", "grados", "usos_maximos", "usos", "vence", "estado"], rows));
  } catch (error) { return handleError(error, "english_codes_export_failed", "No se pudieron exportar los códigos."); }
}
