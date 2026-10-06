import { promises as fs } from "fs";
import path from "path";
import type {
  Categoria,
  Comentario,
  IntentoExamen,
  IntentoRepaso,
  LeccionCoach,
  Pago,
  PreguntaIA,
  ProgresoAlumno,
  Publicacion,
  Rol,
  VideoLeccion,
} from "./tipos";

// Almacén del prototipo: un archivo JSON en disco. Es suficiente para validar
// el MVP con pocas personas; en la Fase 2 se reemplaza por la base de datos
// de Django (modelos Publicacion, Comentario, Pago, etc.).

export interface Almacen {
  siguienteId: number;
  publicaciones: Publicacion[];
  leccionesCoach: LeccionCoach[];
  preguntas: PreguntaIA[];
  pagos: Pago[];
  /** Opcional: los almacenes creados antes de que existieran los videos no lo traen. */
  videos?: VideoLeccion[];
  /** Opcionales por la misma razón: llegaron con el repaso y el examen final. */
  progreso?: ProgresoAlumno[];
  repasos?: IntentoRepaso[];
  examenes?: IntentoExamen[];
}

const DIRECTORIO =
  process.env.DATA_DIR ??
  (process.env.VERCEL ? "/tmp/plataforma-cursos" : path.join(process.cwd(), ".data"));
const ARCHIVO = path.join(DIRECTORIO, "almacen.json");
/** Los videos de las lecciones se guardan como archivos junto al almacén. */
export const DIRECTORIO_VIDEOS = path.join(DIRECTORIO, "videos");
const SEMILLA = path.join(process.cwd(), "data", "comunidad-seed.json");
const VIDEOS_MUESTRA = path.join(process.cwd(), "data", "videos");
const AVANCE_SEMILLA = path.join(process.cwd(), "data", "avance-seed.json");
const EVALUACIONES = path.join(process.cwd(), "data", "evaluaciones.json");

const MAX_PREGUNTAS = 500;
const MAX_INTENTOS = 2000;

interface ComentarioSemilla {
  autor: string;
  rol: Rol;
  haceHoras: number;
  cuerpo: string;
}

interface PublicacionSemilla extends ComentarioSemilla {
  categoria: Categoria;
  fijada: boolean;
  titulo: string;
  comentarios: ComentarioSemilla[];
}

function haceHoras(horas: number): string {
  return new Date(Date.now() - horas * 3_600_000).toISOString();
}

async function sembrar(): Promise<Almacen> {
  const semilla = JSON.parse(await fs.readFile(SEMILLA, "utf8")) as {
    publicaciones: PublicacionSemilla[];
  };
  let id = 1;
  const publicaciones: Publicacion[] = semilla.publicaciones.map((p) => ({
    id: id++,
    autor: p.autor,
    rol: p.rol,
    categoria: p.categoria,
    titulo: p.titulo,
    cuerpo: p.cuerpo,
    fijada: p.fijada,
    creadaEn: haceHoras(p.haceHoras),
    reacciones: [],
    comentarios: p.comentarios.map(
      (c): Comentario => ({
        id: id++,
        autor: c.autor,
        rol: c.rol,
        cuerpo: c.cuerpo,
        creadoEn: haceHoras(c.haceHoras),
      }),
    ),
  }));
  const almacen: Almacen = {
    siguienteId: id,
    publicaciones,
    leccionesCoach: [],
    preguntas: [],
    pagos: [],
    videos: await sembrarVideos(),
  };
  await sembrarAvance(almacen);
  return almacen;
}

interface AvanceSemilla {
  autor: string;
  completadas: string[];
  hace_dias: number;
  repasos: { leccion: string; fallas: string[]; hace_dias: number }[];
  examenes: { fallas: string[]; hace_dias: number }[];
}

// Avance de ejemplo de los alumnos de la comunidad (data/avance-seed.json),
// para que la matriz de la coach tenga datos en la demo. También se aplica una
// vez a los almacenes creados antes de que existieran el repaso y el examen.
async function sembrarAvance(almacen: Almacen): Promise<void> {
  almacen.progreso = [];
  almacen.repasos = [];
  almacen.examenes = [];
  let alumnos: AvanceSemilla[];
  let evaluaciones: { aprobar_con: number; repaso: Record<string, unknown[]>; examen_final: { preguntas: unknown[] } };
  try {
    alumnos = (JSON.parse(await fs.readFile(AVANCE_SEMILLA, "utf8")) as { alumnos: AvanceSemilla[] }).alumnos;
    evaluaciones = JSON.parse(await fs.readFile(EVALUACIONES, "utf8"));
  } catch {
    return;
  }
  const haceDias = (dias: number) => haceHoras(dias * 24);
  const totalExamen = evaluaciones.examen_final.preguntas.length;
  for (const a of alumnos) {
    almacen.progreso.push({ autor: a.autor, completadas: a.completadas, actualizado: haceDias(a.hace_dias) });
    for (const r of a.repasos) {
      const total = evaluaciones.repaso[r.leccion]?.length ?? 0;
      almacen.repasos.push({
        autor: a.autor,
        leccion: r.leccion,
        aciertos: total - r.fallas.length,
        total,
        fallas: r.fallas,
        creadoEn: haceDias(r.hace_dias),
      });
    }
    // Los intentos van del más antiguo al más reciente, como se guardan al presentarlos.
    for (const x of [...a.examenes].sort((p, q) => q.hace_dias - p.hace_dias)) {
      const aciertos = totalExamen - x.fallas.length;
      const puntaje = Math.round((aciertos / totalExamen) * 100);
      almacen.examenes.push({
        id: almacen.siguienteId++,
        autor: a.autor,
        aciertos,
        total: totalExamen,
        puntaje,
        aprobado: puntaje >= evaluaciones.aprobar_con,
        fallas: x.fallas,
        creadoEn: haceDias(x.hace_dias),
      });
    }
  }
}

// Videos de muestra que viajan con el proyecto (data/videos/L1.webm…). Se
// copian junto al almacén para que la coach pueda reemplazarlos o quitarlos
// como cualquier video subido.
async function sembrarVideos(): Promise<VideoLeccion[]> {
  let archivos: string[];
  try {
    archivos = (await fs.readdir(VIDEOS_MUESTRA)).filter((a) => /^[A-Za-z0-9]+\.webm$/.test(a));
  } catch {
    return [];
  }
  await fs.mkdir(DIRECTORIO_VIDEOS, { recursive: true });
  const subidoEn = new Date().toISOString();
  return Promise.all(
    archivos.map(async (a) => {
      const leccion = a.replace(/\.webm$/, "");
      const archivo = `${leccion}-muestra.webm`;
      await fs.copyFile(path.join(VIDEOS_MUESTRA, a), path.join(DIRECTORIO_VIDEOS, archivo));
      const { size } = await fs.stat(path.join(DIRECTORIO_VIDEOS, archivo));
      return {
        leccion,
        archivo,
        tipo: "video/webm",
        bytes: size,
        nombreOriginal: `video-de-muestra-${leccion}.webm`,
        subidoEn,
      };
    }),
  );
}

async function leer(): Promise<Almacen> {
  try {
    const almacen = JSON.parse(await fs.readFile(ARCHIVO, "utf8")) as Almacen;
    if (almacen.progreso === undefined) {
      await sembrarAvance(almacen);
      await escribir(almacen);
    }
    return almacen;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const inicial = await sembrar();
    await escribir(inicial);
    return inicial;
  }
}

async function escribir(almacen: Almacen): Promise<void> {
  await fs.mkdir(DIRECTORIO, { recursive: true });
  // Escritura atómica: primero a un archivo temporal y luego se renombra,
  // para que un corte a medias nunca deje el JSON dañado.
  const temporal = `${ARCHIVO}.${process.pid}.tmp`;
  await fs.writeFile(temporal, JSON.stringify(almacen, null, 2), "utf8");
  await fs.rename(temporal, ARCHIVO);
}

// Las escrituras se encadenan para que dos peticiones simultáneas no se pisen.
let cola: Promise<unknown> = Promise.resolve();

export function modificar<T>(cambio: (almacen: Almacen) => T): Promise<T> {
  const tarea = cola.then(async () => {
    const almacen = await leer();
    const resultado = cambio(almacen);
    if (almacen.preguntas.length > MAX_PREGUNTAS) {
      almacen.preguntas = almacen.preguntas.slice(-MAX_PREGUNTAS);
    }
    if (almacen.repasos && almacen.repasos.length > MAX_INTENTOS) {
      almacen.repasos = almacen.repasos.slice(-MAX_INTENTOS);
    }
    await escribir(almacen);
    return resultado;
  });
  cola = tarea.catch(() => undefined);
  return tarea;
}

export async function consultar<T>(lectura: (almacen: Almacen) => T): Promise<T> {
  await cola;
  return lectura(await leer());
}

export function nuevoId(almacen: Almacen): number {
  return almacen.siguienteId++;
}

// Miembros activos: alumnos que publicaron, comentaron o le preguntaron al
// asistente. El feed y el panel de la coach usan esta misma cuenta.
export function contarMiembros(almacen: Almacen): number {
  const miembros = new Set<string>();
  for (const p of almacen.publicaciones) {
    if (p.rol === "alumno") miembros.add(p.autor);
    for (const c of p.comentarios) if (c.rol === "alumno") miembros.add(c.autor);
  }
  for (const q of almacen.preguntas) miembros.add(q.autor);
  return miembros.size;
}
