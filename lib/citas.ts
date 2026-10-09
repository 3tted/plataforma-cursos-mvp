// Las respuestas del asistente citan lecciones como [L4], [L5, L6], [P2], [W1] o [C1]
// (L, P y W = cada curso; C = lección agregada por la coach). Este módulo lo usan el servidor, para
// registrar qué lecciones se consultan, y la interfaz, para volverlas enlaces.

export const PATRON_CITA = /\[((?:[LPWC]\d+)(?:\s*,\s*[LPWC]\d+)*)\]/g;

export function extraerCitas(texto: string): string[] {
  const ids = new Set<string>();
  for (const coincidencia of texto.matchAll(PATRON_CITA)) {
    for (const id of coincidencia[1].split(",")) ids.add(id.trim());
  }
  return [...ids];
}
