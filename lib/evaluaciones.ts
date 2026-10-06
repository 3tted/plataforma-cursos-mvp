import { promises as fs } from "fs";
import path from "path";
import type { Almacen } from "./almacen";
import { ErrorDeDatos } from "./http";
import type {
  DatosCurso,
  EstadoAlumno,
  EvaluacionesPublicas,
  Expediente,
  MatrizAlumnos,
  PreguntaPublica,
} from "./tipos";

// Repaso por lección y examen final del curso. Las respuestas correctas viven
// solo en el servidor (data/evaluaciones.json): el navegador recibe las
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

const ARCHIVO = path.join(process.cwd(), "data", "evaluaciones.json");
let cache: Evaluaciones | null = null;

export async function cargarEvaluaciones(): Promise<Evaluaciones> {
  if (cache && process.env.NODE_ENV === "production") return cache;
  const crudo = JSON.parse(await fs.readFile(ARCHIVO, "utf8")) as {
    aprobar_con: number;
    intentos_examen: number;
    repaso: Record<string, PreguntaArchivo[]>;
    examen_final: { titulo: string; preguntas: PreguntaArchivo[] };
  };
  cache = {
    aprobarCon: crudo.aprobar_con,
    intentosExamen: crudo.intentos_examen,
    repaso: crudo.repaso,
    examenFinal: crudo.examen_final,
  };
  return cache;
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

export function expedienteDe(a: Almacen, curso: DatosCurso, ev: Evaluaciones, autor: string): Expediente {
  const modulos = leccionesDelCurso(curso);
  const completadas = completadasDe(a, autor);
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
  for (const r of a.repasos ?? []) if (r.autor === autor) ultimos.set(r.leccion, r);
  const repaso = [...ultimos.values()].reduce<Expediente["repaso"]>(
    (s, r) => ({ aciertos: s.aciertos + r.aciertos, total: s.total + r.total, lecciones: s.lecciones + 1 }),
    { aciertos: 0, total: 0, lecciones: 0 },
  );

  const intentos = (a.examenes ?? []).filter((x) => x.autor === autor);
  const aprobadoEn = intentos.find((x) => x.aprobado)?.creadoEn ?? null;
  const examen = {
    mejorPuntaje: intentos.length ? Math.max(...intentos.map((x) => x.puntaje)) : null,
    intentos: intentos.length,
    intentosMaximos: ev.intentosExamen,
    aprobado: aprobadoEn !== null,
    aprobadoEn,
  };

  const estado: EstadoAlumno = examen.aprobado
    ? "aprobado"
    : examen.intentos >= ev.intentosExamen
      ? "requiere-apoyo"
      : leccionesTotal > 0 && leccionesHechas === leccionesTotal
        ? "examen-pendiente"
        : leccionesHechas > 0 || repaso.lecciones > 0
          ? "en-curso"
          : "sin-iniciar";

  const fechas = [
    a.progreso?.find((p) => p.autor === autor)?.actualizado,
    ...(a.repasos ?? []).filter((r) => r.autor === autor).map((r) => r.creadoEn),
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

export function construirMatriz(a: Almacen, curso: DatosCurso, ev: Evaluaciones): MatrizAlumnos {
  const autores = new Set<string>([
    ...(a.progreso ?? []).filter((p) => p.completadas.length > 0).map((p) => p.autor),
    ...(a.repasos ?? []).map((r) => r.autor),
    ...(a.examenes ?? []).map((x) => x.autor),
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
  for (const r of a.repasos ?? []) {
    for (const p of ev.repaso[r.leccion] ?? []) sumar(p.id, r.fallas.includes(p.id));
  }
  for (const x of a.examenes ?? []) {
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
  const masFalladas = preguntas
    .map((p) => ({ ...p, ...(conteo.get(p.id) ?? { respuestas: 0, fallas: 0 }) }))
    .filter((p) => p.fallas > 0)
    .sort((x, y) => y.fallas / y.respuestas - x.fallas / x.respuestas || y.fallas - x.fallas)
    .slice(0, 6);

  return {
    aprobarCon: ev.aprobarCon,
    modulos: leccionesDelCurso(curso).map((m) => ({ id: m.id, titulo: m.titulo, total: m.lecciones.length })),
    alumnos,
    masFalladas,
  };
}
