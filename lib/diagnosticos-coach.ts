import { nuevoId, type Almacen } from "./almacen";
import type { ContextoCurso } from "./diagnostico-ia";
import { llevaDiagnostico, preguntasDe, problemasDe, totalPreguntas, type Diagnostico, type DiagnosticoCreado } from "./diagnosticos";
import { ErrorDeDatos, SinPermiso } from "./http";
import type { Coach } from "./permisos";
import type { CursoCreado, LeccionCreada } from "./tipos";

// Los diagnósticos que crean los coaches y cómo se vuelven el primer paso de
// un curso: una lección al principio del módulo 1 que lo incrusta
// (<!-- diagnostico:id -->). La lección se agrega solo cuando el diagnóstico
// está completo, para que nadie se tope con uno a medias. Mientras el coach
// edita uno que sus alumnos ya ven, los cambios a medias quedan en `borrador`
// y los alumnos siguen viendo la última versión completa.

export type DiagnosticoGuardado = DiagnosticoCreado & {
  /** Cambios en curso de uno que ya está publicado (incompletos todavía). */
  borrador?: Diagnostico;
  /** Ya estuvo completo alguna vez (lo pueden estar viendo alumnos). */
  publicado?: boolean;
};

export function diagnosticoDeCoach(a: Almacen, id: unknown, coach: Coach): DiagnosticoGuardado {
  const d = (a.diagnosticosCoach ?? []).find((x) => x.id === id) as DiagnosticoGuardado | undefined;
  if (!d) throw new ErrorDeDatos("No encontramos ese diagnóstico.");
  if (d.empresa !== coach.empresa) throw new SinPermiso("Este diagnóstico es de otra empresa.");
  return d;
}

/** Lo que el coach está editando: sus cambios a medias o la versión publicada. */
export function enEdicion(d: DiagnosticoGuardado): Diagnostico {
  const { borrador, publicado: _p, empresa: _e, curso: _c, autor: _a, creadoEn: _cr, actualizadoEn: _ac, ...base } = d;
  return borrador ?? base;
}

export const leccionDelDiagnostico = (curso: CursoCreado, id: string): LeccionCreada | undefined =>
  curso.modulos.flatMap((m) => m.lecciones).find((l) => llevaDiagnostico(l.contenido, id));

function minutos(d: Diagnostico) {
  return Math.min(30, Math.max(3, Math.round(totalPreguntas(d) / 3)));
}

/** Agrega (o pone al día) la lección del diagnóstico al principio del curso. */
export function ponerComoPrimerPaso(a: Almacen, curso: CursoCreado, d: Diagnostico) {
  const actual = leccionDelDiagnostico(curso, d.id);
  if (actual) {
    actual.titulo = d.titulo.slice(0, 140);
    actual.duracion_min = minutos(d);
    return;
  }
  const leccion: LeccionCreada = {
    id: `K${nuevoId(a)}`,
    titulo: d.titulo.slice(0, 140),
    duracion_min: minutos(d),
    // El primer paso siempre se puede tomar, aunque el curso sea de pago.
    gratis: true,
    resumen: "Responde el diagnóstico y descubre por dónde te conviene empezar el curso.",
    // El título y las instrucciones los pone el diagnóstico: la lección no los repite.
    contenido: `<!-- diagnostico:${d.id} -->\n\nCon tu resultado ya sabes por dónde empezar. Sigue con la siguiente lección.`,
    transcripcion: "",
    preguntas_sugeridas: [],
    repaso: [],
  };
  if (curso.modulos.length === 0) curso.modulos.push({ id: "M1", titulo: "Diagnóstico", lecciones: [] });
  curso.modulos[0].lecciones.unshift(leccion);
  curso.actualizadoEn = new Date().toISOString();
}

export function quitarDelCurso(curso: CursoCreado, id: string) {
  for (const m of curso.modulos) m.lecciones = m.lecciones.filter((l) => !llevaDiagnostico(l.contenido, id));
  curso.actualizadoEn = new Date().toISOString();
}

/** Lo que la IA necesita saber del curso para que las preguntas vayan con él. */
export function contextoDe(a: Almacen, d: DiagnosticoCreado): ContextoCurso | null {
  const c = (a.cursosCoach ?? []).find((x) => x.id === d.curso);
  if (!c) return null;
  return {
    titulo: c.titulo,
    subtitulo: c.subtitulo,
    aprenderas: c.aprenderas,
    lecciones: c.modulos.flatMap((m) => m.lecciones).filter((l) => !llevaDiagnostico(l.contenido, d.id)).map((l) => l.titulo).filter(Boolean),
  };
}

/** Resumen para el editor del curso. */
export function resumenDiagnostico(d: DiagnosticoGuardado, curso: CursoCreado | undefined) {
  const edicion = enEdicion(d);
  return {
    id: d.id,
    titulo: edicion.titulo,
    preguntas: totalPreguntas(edicion),
    areas: edicion.dimensiones.length,
    problemas: problemasDe(edicion).length,
    primerPaso: !!curso && !!leccionDelDiagnostico(curso, d.id),
    conCambios: !!d.borrador,
  };
}

export const sinPreguntas = (d: Diagnostico) => d.dimensiones.every((x) => preguntasDe(x).every((p) => !p.texto));
