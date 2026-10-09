import { promises as fs } from "fs";
import path from "path";
import { consultar } from "./almacen";
import type { Curso, DatosCurso, Leccion, LeccionCoach, Modulo, ResumenCurso } from "./tipos";

const DATOS = path.join(process.cwd(), "data");
const SEPARADOR_TRANSCRIPCION = "<!-- transcripcion -->";

// Cursos de la comunidad. Todos son de la misma coach y entran en la misma
// membresía; los ids de lección no se repiten entre cursos (L1…, P1…), así
// que el avance de cada alumno sigue siendo una sola lista de lecciones.
export const CURSO_PRINCIPAL = "finanzas-negocio";
export const COMUNIDAD_PRINCIPAL = "finanzas-claras";
const ARCHIVOS: Record<string, string> = {
  [CURSO_PRINCIPAL]: "curso.json",
  "precios-servicios": "cursos/precios-servicios.json",
  // De otra comunidad (Vende por WhatsApp): su archivo trae su propia comunidad.
  "ventas-whatsapp": "cursos/ventas-whatsapp.json",
};
export const IDS_CURSOS = Object.keys(ARCHIVOS);

/** El curso que pide el navegador; si no llega o no existe, el principal. */
export function idCurso(valor: unknown): string {
  return typeof valor === "string" && valor in ARCHIVOS ? valor : CURSO_PRINCIPAL;
}

interface LeccionArchivo extends Omit<Leccion, "contenido" | "transcripcion"> {
  archivo: string;
}

interface CursoArchivo extends Omit<Curso, "modulos"> {
  modulos: (Omit<Modulo, "lecciones"> & { lecciones: LeccionArchivo[] })[];
}

const cacheBase = new Map<string, DatosCurso>();

async function leerJson<T>(archivo: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.join(DATOS, archivo), "utf8")) as T;
}

async function cargarLeccion({ archivo, ...meta }: LeccionArchivo): Promise<Leccion> {
  const texto = await fs.readFile(path.join(DATOS, archivo), "utf8");
  const [contenido, transcripcion = ""] = texto.split(SEPARADOR_TRANSCRIPCION);
  return { ...meta, contenido: contenido.trim(), transcripcion: transcripcion.trim() };
}

async function cargarCursoBase(id: string): Promise<DatosCurso> {
  const guardado = cacheBase.get(id);
  if (guardado && process.env.NODE_ENV === "production") return guardado;
  // Un curso sin comunidad propia es de la principal (la de curso.json).
  const principal = await leerJson<{ comunidad: DatosCurso["comunidad"]; curso: CursoArchivo }>(ARCHIVOS[CURSO_PRINCIPAL]);
  const archivo =
    id === CURSO_PRINCIPAL
      ? principal
      : await leerJson<{ comunidad?: DatosCurso["comunidad"]; curso: CursoArchivo }>(ARCHIVOS[id]);
  const modulos = await Promise.all(
    archivo.curso.modulos.map(async (m) => ({
      ...m,
      lecciones: await Promise.all(m.lecciones.map(cargarLeccion)),
    })),
  );
  const datos = { comunidad: archivo.comunidad ?? principal.comunidad, curso: { ...archivo.curso, modulos } };
  cacheBase.set(id, datos);
  return datos;
}

export function idLeccionCoach(leccion: LeccionCoach): string {
  return `C${leccion.id}`;
}

// Un curso completo: las lecciones del archivo, más (en el curso principal)
// las que la coach agrega desde su panel, y el video que la coach haya subido
// a cada una. El asistente de IA responde con base en todas.
export async function cargarCurso(id: string = CURSO_PRINCIPAL): Promise<DatosCurso> {
  const base = await cargarCursoBase(idCurso(id));
  const { propias, videos } = await consultar((a) => ({ propias: a.leccionesCoach, videos: a.videos ?? [] }));
  const conPropias = base.curso.id === CURSO_PRINCIPAL && propias.length > 0;
  if (!conPropias && videos.length === 0) return base;

  const modulos = conPropias ? [...base.curso.modulos, moduloDeCoach(base, propias)] : base.curso.modulos;
  const porLeccion = new Map(videos.map((v) => [v.leccion, v]));
  return {
    ...base,
    curso: {
      ...base.curso,
      modulos: modulos.map((m) => ({
        ...m,
        lecciones: m.lecciones.map((l) => {
          const video = porLeccion.get(l.id);
          if (!video) return l;
          return {
            ...l,
            video: {
              // La fecha en la URL evita que el navegador muestre el video anterior tras reemplazarlo.
              url: `/api/videos/${l.id}?v=${encodeURIComponent(video.subidoEn)}`,
              tipo: video.tipo,
              nombre: video.nombreOriginal,
              subidoEn: video.subidoEn,
            },
          };
        }),
      })),
    },
  };
}

export function cargarCursos(): Promise<DatosCurso[]> {
  return Promise.all(IDS_CURSOS.map((id) => cargarCurso(id)));
}

/** Las comunidades con cursos, en el orden de los cursos. */
export async function cargarComunidades(): Promise<DatosCurso["comunidad"][]> {
  const vistas = new Map<string, DatosCurso["comunidad"]>();
  for (const { comunidad } of await cargarCursos()) if (!vistas.has(comunidad.id)) vistas.set(comunidad.id, comunidad);
  return [...vistas.values()];
}

/** El id de comunidad que pide el navegador; si no llega o no existe, la principal. */
export async function idComunidad(valor: unknown): Promise<string> {
  const ids = (await cargarComunidades()).map((c) => c.id);
  return typeof valor === "string" && ids.includes(valor) ? valor : COMUNIDAD_PRINCIPAL;
}

/** El curso al que pertenece una lección, o null si no existe. */
export async function cursoDeLeccion(leccion: string): Promise<DatosCurso | null> {
  for (const datos of await cargarCursos()) {
    if (datos.curso.modulos.some((m) => m.lecciones.some((l) => l.id === leccion))) return datos;
  }
  return null;
}

export function resumenDe({ curso, comunidad }: DatosCurso): ResumenCurso {
  const modulos = curso.modulos.filter((m) => m.id !== "MC");
  const lecciones = modulos.flatMap((m) => m.lecciones);
  return {
    id: curso.id,
    comunidad: comunidad.id,
    titulo: curso.titulo,
    subtitulo: curso.subtitulo,
    modulos: modulos.length,
    lecciones: lecciones.map((l) => l.id),
    minutos: lecciones.reduce((s, l) => s + l.duracion_min, 0),
  };
}

function moduloDeCoach(base: DatosCurso, propias: LeccionCoach[]): Modulo {
  return {
    id: "MC",
    titulo: `Lecciones de ${base.comunidad.coach}`,
    lecciones: propias.map((l) => ({
      id: idLeccionCoach(l),
      titulo: l.titulo,
      duracion_min: Math.max(1, Math.round(l.contenido.split(/\s+/).length / 150)),
      gratis: true,
      resumen: l.contenido.slice(0, 140).replace(/\s+/g, " ").trim() + "…",
      preguntas_sugeridas: [],
      contenido: l.contenido,
      transcripcion: "",
      deCoach: true,
    })),
  };
}

export function todasLasLecciones(curso: Curso): (Leccion & { modulo: Modulo })[] {
  return curso.modulos.flatMap((modulo) => modulo.lecciones.map((l) => ({ ...l, modulo })));
}
