import { promises as fs } from "fs";
import path from "path";
import { consultar, type Almacen } from "./almacen";
import { CURSO_PRINCIPAL, idCurso } from "./curso";
import { ErrorDeDatos } from "./http";
import { MIN_RESPUESTAS } from "./tipos";
import type {
  DatosCurso,
  EstadoAlumno,
  EvaluacionesPublicas,
  Expediente,
  MatrizAlumnos,
  PreguntaPublica,
} from "./tipos";

// Repaso por lección y examen final de cada curso. Las respuestas correctas
// viven solo en el servidor (data/evaluaciones*.json): el navegador recibe las
// preguntas sin ellas y el servidor califica. En la Fase 2 pasan a los
// modelos Examen, Pregunta, Opcion e Intento de Django.

interface PreguntaArchivo {
  id: string;
  enunciado: string;
  opciones: string[];
  correcta: number;
  explicacion?: string;
  leccion?: string;
}

export interface Evaluaciones {
  aprobarCon: number;
  intentosExamen: number;
  repaso: Record<string, PreguntaArchivo[]>;
  examenFinal: { titulo: string; preguntas: PreguntaArchivo[] };
}

const ARCHIVOS: Record<string, string> = {
  [CURSO_PRINCIPAL]: "evaluaciones.json",
  "precios-servicios": "evaluaciones-precios-servicios.json",
  "ventas-whatsapp": "evaluaciones-ventas-whatsapp.json",
};
const cache = new Map<string, Evaluaciones>();

// Las de los cursos que crea la coach viven en el almacén, junto al curso:
// el repaso en cada lección y el examen final en el curso.
async function evaluacionesDeCursoCreado(id: string): Promise<Evaluaciones | null> {
  const curso = await consultar((a) => (a.cursosCoach ?? []).find((c) => c.id === id) ?? null);
  if (!curso) return null;
  return {
    aprobarCon: 70,
    intentosExamen: 3,
    repaso: Object.fromEntries(
      curso.modulos.flatMap((m) => m.lecciones).filter((l) => l.repaso.length > 0).map((l) => [l.id, l.repaso]),
    ),
    // Sin examen final, no hay preguntas que presentar (las suyas se guardan en el curso).
    examenFinal: { titulo: `Examen final: ${curso.titulo}`, preguntas: curso.sinExamen ? [] : curso.examen },
  };
}

export async function cargarEvaluaciones(curso: string = CURSO_PRINCIPAL): Promise<Evaluaciones> {
  // Los borradores también: la coach los revisa antes de publicar.
  const id = await idCurso(curso, { borradores: true });
  if (!(id in ARCHIVOS)) {
    const creadas = await evaluacionesDeCursoCreado(id);
    if (creadas) return creadas;
  }
  const guardado = cache.get(id);
  if (guardado && process.env.NODE_ENV === "production") return guardado;
  const crudo = JSON.parse(await fs.readFile(path.join(process.cwd(), "data", ARCHIVOS[id]), "utf8")) as {
    aprobar_con: number;
    intentos_examen: number;
    repaso: Record<string, PreguntaArchivo[]>;
    examen_final: { titulo: string; preguntas: PreguntaArchivo[] };
  };
  const ev: Evaluaciones = {
    aprobarCon: crudo.aprobar_con,
    intentosExamen: crudo.intentos_examen,
    repaso: crudo.repaso,
    examenFinal: crudo.examen_final,
  };
  cache.set(id, ev);
  return ev;
}

/** Intentos de examen de un curso (los guardados antes de que hubiera dos cursos son del principal). */
export function examenesDelCurso(a: Almacen, curso: string) {
  return (a.examenes ?? []).filter((x) => (x.curso ?? CURSO_PRINCIPAL) === curso);
}

function publica({ id, enunciado, opciones, leccion }: PreguntaArchivo): PreguntaPublica {
  return leccion ? { id, enunciado, opciones, leccion } : { id, enunciado, opciones };
}

export function evaluacionesPublicas(ev: Evaluaciones): EvaluacionesPublicas {
  return {
    aprobarCon: ev.aprobarCon,
    intentosExamen: ev.intentosExamen,
    repaso: Object.fromEntries(Object.entries(ev.repaso).map(([id, lista]) => [id, lista.map(publica)])),
    examenFinal: { titulo: ev.examenFinal.titulo, preguntas: ev.examenFinal.preguntas.map(publica) },
  };
}

// Una respuesta por pregunta, en el mismo orden: el índice de la opción elegida.
export function calificar(preguntas: PreguntaArchivo[], respuestas: unknown) {
  if (
    !Array.isArray(respuestas) ||
    respuestas.length !== preguntas.length ||
    respuestas.some((r, i) => !Number.isInteger(r) || r < 0 || r >= preguntas[i].opciones.length)
  ) {
    throw new ErrorDeDatos("Responde todas las preguntas antes de enviar.");
  }
  const detalle = preguntas.map((p, i) => ({ pregunta: p, acierto: respuestas[i] === p.correcta }));
  return {
    detalle,
    aciertos: detalle.filter((d) => d.acierto).length,
    total: preguntas.length,
    fallas: detalle.filter((d) => !d.acierto).map((d) => d.pregunta),
  };
}

// Solo cuentan las lecciones del curso; las que la coach pega desde su panel
// son para probar el asistente.
export function leccionesDelCurso(curso: DatosCurso) {
  return curso.curso.modulos.filter((m) => m.id !== "MC");
}

export function completadasDe(a: Almacen, autor: string): string[] {
  return a.progreso?.find((p) => p.autor === autor)?.completadas ?? [];
}

function idsDelCurso(curso: DatosCurso): Set<string> {
  return new Set(leccionesDelCurso(curso).flatMap((m) => m.lecciones.map((l) => l.id)));
}

// Expediente de un alumno en un curso: solo cuentan las lecciones, repasos y
// exámenes de ese curso.
export function expedienteDe(a: Almacen, curso: DatosCurso, ev: Evaluaciones, autor: string): Expediente {
  const modulos = leccionesDelCurso(curso);
  const ids = idsDelCurso(curso);
  const completadas = completadasDe(a, autor).filter((id) => ids.has(id));
  const porModulo = modulos.map((m) => ({
    id: m.id,
    titulo: m.titulo,
    hechas: m.lecciones.filter((l) => completadas.includes(l.id)).length,
    total: m.lecciones.length,
  }));
  const leccionesHechas = porModulo.reduce((s, m) => s + m.hechas, 0);
  const leccionesTotal = porModulo.reduce((s, m) => s + m.total, 0);

  // Del repaso cuenta el último intento de cada lección.
  const ultimos = new Map<string, { aciertos: number; total: number }>();
  for (const r of a.repasos ?? []) if (r.autor === autor && ids.has(r.leccion)) ultimos.set(r.leccion, r);
  const repaso = [...ultimos.values()].reduce<Expediente["repaso"]>(
    (s, r) => ({ aciertos: s.aciertos + r.aciertos, total: s.total + r.total, lecciones: s.lecciones + 1 }),
    { aciertos: 0, total: 0, lecciones: 0 },
  );

  const intentos = examenesDelCurso(a, curso.curso.id).filter((x) => x.autor === autor);
  const aprobadoEn = intentos.find((x) => x.aprobado)?.creadoEn ?? null;
  const examen = {
    mejorPuntaje: intentos.length ? Math.max(...intentos.map((x) => x.puntaje)) : null,
    intentos: intentos.length,
    intentosMaximos: ev.intentosExamen,
    aprobado: aprobadoEn !== null,
    aprobadoEn,
  };

  // Un curso sin examen final se termina al completar las lecciones.
  const sinExamen = ev.examenFinal.preguntas.length === 0;
  const terminado = leccionesTotal > 0 && leccionesHechas === leccionesTotal;
  if (sinExamen && terminado) {
    examen.aprobado = true;
    examen.aprobadoEn = a.progreso?.find((p) => p.autor === autor)?.actualizado ?? null;
  }

  // Requiere apoyo desde que reprueba un intento del examen (aunque le queden
  // intentos): así la coach lo ve a tiempo.
  const estado: EstadoAlumno = examen.aprobado
    ? "aprobado"
    : examen.intentos > 0
      ? "requiere-apoyo"
      : leccionesTotal > 0 && leccionesHechas === leccionesTotal
        ? "examen-pendiente"
        : leccionesHechas > 0 || repaso.lecciones > 0
          ? "en-curso"
          : "sin-iniciar";

  const fechas = [
    a.progreso?.find((p) => p.autor === autor)?.actualizado,
    ...(a.repasos ?? []).filter((r) => r.autor === autor && ids.has(r.leccion)).map((r) => r.creadoEn),
    ...intentos.map((x) => x.creadoEn),
  ].filter((f): f is string => Boolean(f));

  return {
    autor,
    estado,
    completadas,
    leccionesHechas,
    leccionesTotal,
    porModulo,
    repaso,
    examen,
    ...(sinExamen ? { sinExamen: true } : {}),
    ultimaActividad: fechas.length ? fechas.sort().at(-1)! : null,
  };
}

const ORDEN_ESTADO: Record<EstadoAlumno, number> = {
  "requiere-apoyo": 0,
  "examen-pendiente": 1,
  "en-curso": 2,
  aprobado: 3,
  "sin-iniciar": 4,
};

// Matriz de un curso: aparece quien se inscribió o avanzó en ese curso.
export function construirMatriz(a: Almacen, curso: DatosCurso, ev: Evaluaciones): MatrizAlumnos {
  const ids = idsDelCurso(curso);
  const repasos = (a.repasos ?? []).filter((r) => ids.has(r.leccion));
  const examenes = examenesDelCurso(a, curso.curso.id);
  const autores = new Set<string>([
    ...(a.progreso ?? []).filter((p) => p.completadas.some((id) => ids.has(id))).map((p) => p.autor),
    ...repasos.map((r) => r.autor),
    ...examenes.map((x) => x.autor),
    ...(a.inscripciones ?? []).filter((i) => i.cursos.includes(curso.curso.id)).map((i) => i.autor),
  ]);
  const alumnos = [...autores]
    .map((autor) => expedienteDe(a, curso, ev, autor))
    .sort(
      (x, y) =>
        ORDEN_ESTADO[x.estado] - ORDEN_ESTADO[y.estado] ||
        (y.ultimaActividad ?? "").localeCompare(x.ultimaActividad ?? ""),
    );

  // Respuestas y fallas por pregunta, en el repaso y en el examen.
  const conteo = new Map<string, { respuestas: number; fallas: number }>();
  const sumar = (id: string, fallo: boolean) => {
    const c = conteo.get(id) ?? { respuestas: 0, fallas: 0 };
    c.respuestas++;
    if (fallo) c.fallas++;
    conteo.set(id, c);
  };
  for (const r of repasos) {
    for (const p of ev.repaso[r.leccion] ?? []) sumar(p.id, r.fallas.includes(p.id));
  }
  for (const x of examenes) {
    for (const p of ev.examenFinal.preguntas) sumar(p.id, x.fallas.includes(p.id));
  }
  const preguntas = [
    ...Object.entries(ev.repaso).flatMap(([leccion, lista]) =>
      lista.map((p) => ({ id: p.id, tipo: "repaso" as const, enunciado: p.enunciado, leccion })),
    ),
    ...ev.examenFinal.preguntas.map((p) => ({
      id: p.id,
      tipo: "examen" as const,
      enunciado: p.enunciado,
      leccion: p.leccion ?? "",
    })),
  ];
  // El porcentaje solo dice algo con varias respuestas: primero las que ya tienen
  // MIN_RESPUESTAS o más (por porcentaje), luego las demás (por cuántas fallas).
  const confiable = (p: { respuestas: number }) => p.respuestas >= MIN_RESPUESTAS;
  const masFalladas = preguntas
    .map((p) => ({ ...p, ...(conteo.get(p.id) ?? { respuestas: 0, fallas: 0 }) }))
    .filter((p) => p.fallas > 0)
    .sort(
      (x, y) =>
        Number(confiable(y)) - Number(confiable(x)) ||
        (confiable(x) ? y.fallas / y.respuestas - x.fallas / x.respuestas : 0) ||
        y.fallas - x.fallas,
    )
    .slice(0, 6);

  return {
    curso: { id: curso.curso.id, titulo: curso.curso.titulo },
    titulos: Object.fromEntries(curso.curso.modulos.flatMap((m) => m.lecciones.map((l) => [l.id, l.titulo]))),
    aprobarCon: ev.aprobarCon,
    modulos: leccionesDelCurso(curso).map((m) => ({ id: m.id, titulo: m.titulo, total: m.lecciones.length })),
    alumnos,
    masFalladas,
  };
}
