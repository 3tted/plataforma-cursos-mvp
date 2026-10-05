import { promises as fs } from "fs";
import path from "path";
import type {
  Categoria,
  Comentario,
  LeccionCoach,
  Pago,
  PreguntaIA,
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
}

const DIRECTORIO =
  process.env.DATA_DIR ??
  (process.env.VERCEL ? "/tmp/plataforma-cursos" : path.join(process.cwd(), ".data"));
const ARCHIVO = path.join(DIRECTORIO, "almacen.json");
/** Los videos de las lecciones se guardan como archivos junto al almacén. */
export const DIRECTORIO_VIDEOS = path.join(DIRECTORIO, "videos");
const SEMILLA = path.join(process.cwd(), "data", "comunidad-seed.json");

const MAX_PREGUNTAS = 500;

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
  return { siguienteId: id, publicaciones, leccionesCoach: [], preguntas: [], pagos: [], videos: [] };
}

async function leer(): Promise<Almacen> {
  try {
    return JSON.parse(await fs.readFile(ARCHIVO, "utf8")) as Almacen;
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
