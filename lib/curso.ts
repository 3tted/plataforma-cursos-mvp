import { promises as fs } from "fs";
import path from "path";
import { consultar } from "./almacen";
import type { Curso, DatosCurso, Leccion, LeccionCoach, Modulo } from "./tipos";

const DATOS = path.join(process.cwd(), "data");
const SEPARADOR_TRANSCRIPCION = "<!-- transcripcion -->";

interface LeccionArchivo extends Omit<Leccion, "contenido" | "transcripcion"> {
  archivo: string;
}

interface CursoArchivo extends Omit<Curso, "modulos"> {
  modulos: (Omit<Modulo, "lecciones"> & { lecciones: LeccionArchivo[] })[];
}

let cacheBase: DatosCurso | null = null;

async function cargarLeccion({ archivo, ...meta }: LeccionArchivo): Promise<Leccion> {
  const texto = await fs.readFile(path.join(DATOS, archivo), "utf8");
  const [contenido, transcripcion = ""] = texto.split(SEPARADOR_TRANSCRIPCION);
  return { ...meta, contenido: contenido.trim(), transcripcion: transcripcion.trim() };
}

async function cargarCursoBase(): Promise<DatosCurso> {
  if (cacheBase && process.env.NODE_ENV === "production") return cacheBase;
  const archivo = JSON.parse(await fs.readFile(path.join(DATOS, "curso.json"), "utf8")) as {
    comunidad: DatosCurso["comunidad"];
    curso: CursoArchivo;
  };
  const modulos = await Promise.all(
    archivo.curso.modulos.map(async (m) => ({
      ...m,
      lecciones: await Promise.all(m.lecciones.map(cargarLeccion)),
    })),
  );
  cacheBase = { comunidad: archivo.comunidad, curso: { ...archivo.curso, modulos } };
  return cacheBase;
}

export function idLeccionCoach(leccion: LeccionCoach): string {
  return `C${leccion.id}`;
}

// El curso completo: las lecciones del archivo más las que la coach agrega
// desde su panel, y el video que la coach haya subido a cada una. El
// asistente de IA responde con base en todas (con su texto y transcripción).
export async function cargarCurso(): Promise<DatosCurso> {
  const base = await cargarCursoBase();
  const { propias, videos } = await consultar((a) => ({ propias: a.leccionesCoach, videos: a.videos ?? [] }));
  if (propias.length === 0 && videos.length === 0) return base;

  const modulos = propias.length ? [...base.curso.modulos, moduloDeCoach(base, propias)] : base.curso.modulos;
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
