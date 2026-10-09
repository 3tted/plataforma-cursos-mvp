import type { Almacen } from "./almacen";
import { COMUNIDAD_PRINCIPAL, CURSO_PRINCIPAL } from "./curso";
import { leccionesDelCurso } from "./evaluaciones";
import type { DatosCurso } from "./tipos";

// Cuentas para el directorio y las tendencias del inicio.

/** Miembros activos de una comunidad: publicaron o comentaron en ella, le
 * preguntaron al asistente de uno de sus cursos o se unieron. */
export function miembrosDeComunidad(a: Almacen, comunidad: string, cursos: Set<string>): number {
  const nombres = new Set<string>();
  for (const p of a.publicaciones) {
    if ((p.comunidad ?? COMUNIDAD_PRINCIPAL) !== comunidad) continue;
    if (p.rol === "alumno") nombres.add(p.autor);
    for (const c of p.comentarios) if (c.rol === "alumno") nombres.add(c.autor);
  }
  for (const q of a.preguntas) if (cursos.has(q.curso ?? CURSO_PRINCIPAL)) nombres.add(q.autor);
  for (const i of a.inscripciones ?? []) {
    const suyas = i.comunidades ?? (i.comunidad ? [COMUNIDAD_PRINCIPAL] : []);
    if (suyas.includes(comunidad)) nombres.add(i.autor);
  }
  return nombres.size;
}

/** Alumnos de un curso: los inscritos y quien ya avanzó en sus lecciones. */
export function alumnosDeCurso(a: Almacen, curso: DatosCurso): number {
  const ids = new Set(leccionesDelCurso(curso).flatMap((m) => m.lecciones.map((l) => l.id)));
  const nombres = new Set<string>();
  for (const i of a.inscripciones ?? []) if (i.cursos.includes(curso.curso.id)) nombres.add(i.autor);
  for (const p of a.progreso ?? []) if (p.completadas.some((id) => ids.has(id))) nombres.add(p.autor);
  return nombres.size;
}
