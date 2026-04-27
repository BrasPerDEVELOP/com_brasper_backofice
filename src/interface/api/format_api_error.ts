/**
 * Mensaje legible desde cuerpos de error habituales (Django REST, FastAPI, etc.).
 */
function formatDetailEntry(entry: unknown): string {
  if (entry == null) return "";
  if (typeof entry === "string") return entry;
  if (typeof entry !== "object") return String(entry);
  const o = entry as Record<string, unknown>;
  if (typeof o.msg === "string") {
    const loc = Array.isArray(o.loc)
      ? o.loc.map((x) => String(x)).filter(Boolean).join(".")
      : "";
    return loc ? `${loc}: ${o.msg}` : o.msg;
  }
  return JSON.stringify(entry);
}

export function formatApiErrorBody(data: unknown): string | null {
  if (data == null) return null;
  if (typeof data === "string") return data.trim() || null;
  if (typeof data !== "object") return String(data);
  const o = data as Record<string, unknown>;

  if (typeof o.detail === "string") return o.detail;
  if (Array.isArray(o.detail) && o.detail.length) {
    return o.detail.map(formatDetailEntry).filter(Boolean).join("; ");
  }

  if (typeof o.message === "string") return o.message;

  if (Array.isArray(o.non_field_errors) && o.non_field_errors.length) {
    return o.non_field_errors.map((x) => String(x)).join("; ");
  }

  const parts: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      parts.push(`${k}: ${v.map((x) => formatDetailEntry(x)).join(", ")}`);
    } else if (typeof v === "object") {
      parts.push(`${k}: ${JSON.stringify(v)}`);
    } else parts.push(`${k}: ${v}`);
  }
  return parts.length ? parts.slice(0, 6).join("; ") : null;
}
