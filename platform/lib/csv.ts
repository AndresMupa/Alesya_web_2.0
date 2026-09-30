// CSV mínimo (RFC 4180) para importar y exportar productos y contactos. Acepta coma o punto y coma
// (Excel en español exporta con `;`) y quita el BOM.

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let field = "", record: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delimiter) { record.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      record.push(field); field = "";
      if (record.some((value) => value.trim() !== "")) rows.push(record);
      record = [];
    } else field += c;
  }
  record.push(field);
  if (record.some((value) => value.trim() !== "")) rows.push(record);
  return rows;
}

const normalizeHeader = (value: string) => value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/** Convierte las filas en objetos usando la primera fila como encabezado normalizado (`Precio COP` → `precio_cop`). */
export function csvRecords(input: string) {
  const [header = [], ...rows] = parseCsv(input);
  const keys = header.map(normalizeHeader);
  // Quita el apóstrofo protector que `toCsv` antepone a celdas como `+57 300…` o `-2`.
  return rows.map((row) => Object.fromEntries(keys.map((key, index) => [key, (row[index] ?? "").trim().replace(/^'(?=[=+\-@])/, "")])) as Record<string, string>);
}

const escape = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  // Evita que Excel interprete celdas como fórmulas (inyección CSV).
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",;\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(header: string[], rows: unknown[][]) {
  return "﻿" + [header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, body: string) {
  return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" } });
}
