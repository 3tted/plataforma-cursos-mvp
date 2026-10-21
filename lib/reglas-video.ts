// Reglas de los videos de lección, compartidas por la interfaz y la API.

/** Formatos que aceptamos, con la extensión con la que se guardan. */
export const TIPOS_VIDEO: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/** 250 MB: suficiente para una lección de 10 a 20 minutos en calidad media. */
export const MAX_BYTES_VIDEO = 250 * 1024 * 1024;

/** Algunos sistemas no informan el tipo del archivo: se deduce de la extensión. */
export function tipoDeVideo(nombre: string, tipo: string): string | null {
  if (TIPOS_VIDEO[tipo]) return tipo;
  const extension = nombre.toLowerCase().split(".").pop();
  const encontrado = Object.entries(TIPOS_VIDEO).find(([, ext]) => ext === extension);
  return encontrado ? encontrado[0] : null;
}

export function tamañoLegible(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toLocaleString("es-MX", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("es-MX")} KB`;
}

/** 370 → "6:10"; 3750 → "1:02:30". */
export function reloj(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${seg}` : `${m}:${seg}`;
}

/** "6:10" → 370; "1:02:30" → 3750 (undefined si no se entiende). */
export function segundos(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : undefined;
  const texto = String(v ?? "").trim();
  if (!/^\d+(:\d{1,2}){0,2}$/.test(texto)) return undefined;
  return texto.split(":").map(Number).reduce((total, n) => total * 60 + n, 0);
}
