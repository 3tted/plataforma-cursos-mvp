// Las respuestas del asistente citan lecciones como [L4], [L5, L6], [P2], [W1], [K7] o [C1]
// (L, P y W = cursos del proyecto; K = cursos que crea la coach; C = lección pegada en su panel). Este módulo lo usan el servidor, para
// registrar qué lecciones se consultan, y la interfaz, para volverlas enlaces.

export const PATRON_CITA = /\[((?:[LPWKC]\d+)(?:\s*,\s*[LPWKC]\d+)*)\]/g;

export function extraerCitas(texto: string): string[] {
  const ids = new Set<string>();
  for (const coincidencia of texto.matchAll(PATRON_CITA)) {
    for (const id of coincidencia[1].split(",")) ids.add(id.trim());
  }
  return [...ids];
}
