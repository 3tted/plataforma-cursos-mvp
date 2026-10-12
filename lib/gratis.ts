import type { Modulo } from "./tipos";

/**
 * Qué parte de un curso se ve sin membresía, en pocas palabras: "Módulo 1
 * gratis", "1 lección gratis", "3 lecciones gratis" o "" si todo es con la
 * membresía. Sirve igual para los cursos de archivo y los que crea la coach
 * (ella marca qué lecciones son gratis).
 */
export function etiquetaGratis(modulos: Pick<Modulo, "lecciones">[]): string {
  const gratis = modulos.flatMap((m) => m.lecciones).filter((l) => l.gratis).length;
  const primero = modulos[0]?.lecciones ?? [];
  if (gratis === 0) return "";
  if (gratis === primero.length && primero.every((l) => l.gratis)) return "Módulo 1 gratis";
  return gratis === 1 ? "1 lección gratis" : `${gratis} lecciones gratis`;
}
