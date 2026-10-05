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
