// Las respuestas del asistente citan lecciones como [L4], [L5, L6] o [C1]
// (C = lección agregada por la coach). Este módulo lo usan el servidor, para
// registrar qué lecciones se consultan, y la interfaz, para volverlas enlaces.

export const PATRON_CITA = /\[((?:[LC]\d+)(?:\s*,\s*[LC]\d+)*)\]/g;

export function extraerCitas(texto: string): string[] {
  const ids = new Set<string>();
  for (const coincidencia of texto.matchAll(PATRON_CITA)) {
    for (const id of coincidencia[1].split(",")) ids.add(id.trim());
  }
  return [...ids];
}
