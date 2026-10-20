import { promises as fs } from "fs";
import path from "path";
import { consultar, type Almacen } from "./almacen";
import { etiquetaGratis } from "./gratis";
import type { Comunidad, CursoCreado, Curso, DatosCurso, Leccion, LeccionCoach, MarcaEmpresa, Modulo, ResumenCurso } from "./tipos";

const DATOS = path.join(process.cwd(), "data");
const SEPARADOR_TRANSCRIPCION = "<!-- transcripcion -->";

// Cursos de la plataforma. Unos viajan con el proyecto (data/*.json) y otros
// los crea la coach desde su panel (se guardan en el almacén). Los ids de
// lección no se repiten entre cursos (L1…, P1…, W1…, K1…), así que el avance
// de cada alumno sigue siendo una sola lista de lecciones.
export const CURSO_PRINCIPAL = "finanzas-negocio";
export const COMUNIDAD_PRINCIPAL = "finanzas-claras";
const ARCHIVOS: Record<string, string> = {
  [CURSO_PRINCIPAL]: "curso.json",
  "precios-servicios": "cursos/precios-servicios.json",
  // De otra comunidad (Vende por WhatsApp): su archivo trae su propia comunidad.
  "ventas-whatsapp": "cursos/ventas-whatsapp.json",
};
const IDS_ARCHIVO = Object.keys(ARCHIVOS);

/** Para leer también los borradores (el editor de la coach y su vista previa). */
interface Opciones {
  borradores?: boolean;
  /** Empresa de la coach: suma sus cursos subidos a la página sin publicar. */
  deEmpresa?: string;
}

const visible = (c: CursoCreado, { borradores = false, deEmpresa }: Opciones) =>
  borradores || c.estado === "publicado" || (!!deEmpresa && c.empresa === deEmpresa && c.enPagina === true);

/** El curso que pide el navegador; si no llega o no existe, el principal. */
export async function idCurso(valor: unknown, opciones: Opciones = {}): Promise<string> {
  if (typeof valor !== "string") return CURSO_PRINCIPAL;
  if (valor in ARCHIVOS) return valor;
  const existe = await consultar((a) => (a.cursosCoach ?? []).some((c) => c.id === valor && visible(c, opciones)));
  return existe ? valor : CURSO_PRINCIPAL;
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

async function cargarCursoDeArchivo(id: string): Promise<DatosCurso> {
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

/** La marca de una empresa, si ya eligió su color. */
export function marcaDe(a: Almacen, empresa: string | undefined): { marca?: MarcaEmpresa } {
  const e = (a.empresas ?? []).find((x) => x.id === empresa);
  return e?.color ? { marca: { nombre: e.nombre, color: e.color, ...(e.logo ? { logo: e.logo } : {}) } } : {};
}

/** La comunidad que creó una coach, en la forma que usa el resto de la plataforma. */
export function comunidadCreadaDe(a: Almacen, id: string): Comunidad | null {
  const c = (a.comunidadesCoach ?? []).find((x) => x.id === id);
  if (!c) return null;
  return {
    id: c.id,
    nombre: c.nombre,
    coach: c.coach,
    coach_titulo: c.coach_titulo,
    descripcion: c.descripcion,
    ...(c.acerca ? { acerca: c.acerca } : {}),
    ...(c.foto ? { foto: c.foto } : {}),
    ...(c.empresa ? { empresa: c.empresa } : {}),
    ...marcaDe(a, c.empresa),
    precio_mensual: c.precio_mensual,
    moneda: c.moneda,
  };
}

/** Un curso creado por la coach, en la misma forma que los cursos de archivo. */
export function datosDeCursoCreado(c: CursoCreado, comunidad: Comunidad): DatosCurso {
  return {
    comunidad,
    curso: {
      id: c.id,
      ...(c.estado !== "publicado" ? { sinPublicar: true } : {}),
      ...(c.foto ? { foto: c.foto } : {}),
      titulo: c.titulo,
      subtitulo: c.subtitulo,
      aprenderas: c.aprenderas,
      requisitos: c.requisitos,
      preguntas_sugeridas: c.preguntas_sugeridas,
      modulos: c.modulos.map((m) => ({
        id: m.id,
        titulo: m.titulo,
        lecciones: m.lecciones.map((l) => ({
          id: l.id,
          titulo: l.titulo,
          duracion_min: l.duracion_min,
          gratis: l.gratis,
          resumen: l.resumen,
          preguntas_sugeridas: l.preguntas_sugeridas,
          contenido: l.contenido,
          transcripcion: l.transcripcion,
        })),
      })),
    },
  };
}

const sinComunidad = (c: CursoCreado): Comunidad => ({
  id: "",
  nombre: "Sin comunidad",
  coach: c.autor,
  coach_titulo: "Coach",
  descripcion: "",
  precio_mensual: 0,
  moneda: "MXN",
  ...(c.empresa ? { empresa: c.empresa } : {}),
});

async function cargarCursosCreados(opciones: Opciones = {}): Promise<DatosCurso[]> {
  return consultar((a) =>
    (a.cursosCoach ?? [])
      .filter((c) => visible(c, opciones))
      .flatMap((c) => {
        // Un borrador sin comunidad todavía: la coach lo edita y le sube videos.
        const comunidad = c.comunidad ? comunidadCreadaDe(a, c.comunidad) : sinComunidad(c);
        return comunidad ? [datosDeCursoCreado(c, comunidad)] : [];
      }),
  );
}

export function idLeccionCoach(leccion: LeccionCoach): string {
  return `C${leccion.id}`;
}

// Un curso completo: sus lecciones, más (en el curso principal) las que la
// coach pega desde su panel, y el video que la coach haya subido a cada una.
// El asistente de IA responde con base en todas.
export async function cargarCurso(id: string = CURSO_PRINCIPAL, opciones: Opciones = {}): Promise<DatosCurso> {
  let base: DatosCurso;
  if (id in ARCHIVOS) {
    base = await cargarCursoDeArchivo(id);
  } else {
    const creado = (await cargarCursosCreados(opciones)).find((c) => c.curso.id === id);
    base = creado ?? (await cargarCursoDeArchivo(CURSO_PRINCIPAL));
  }
  const { propias, videos, presentaciones } = await consultar((a) => ({
    propias: a.leccionesCoach,
    videos: a.videos ?? [],
    presentaciones: a.presentaciones ?? [],
  }));
  const suyas = propias.filter((l) => (l.curso ?? CURSO_PRINCIPAL) === base.curso.id);
  const conPropias = suyas.length > 0;
  if (!conPropias && videos.length === 0 && presentaciones.length === 0) return base;

  const modulos = conPropias ? [...base.curso.modulos, moduloDeCoach(base, suyas)] : base.curso.modulos;
  const porLeccion = new Map(videos.map((v) => [v.leccion, v]));
  const presentacionDe = new Map(presentaciones.map((p) => [p.leccion, p]));
  return {
    ...base,
    curso: {
      ...base.curso,
      modulos: modulos.map((m) => ({
        ...m,
        lecciones: m.lecciones.map((l) => {
          const video = porLeccion.get(l.id);
          const presentacion = presentacionDe.get(l.id);
          const conPresentacion = presentacion
            ? {
                ...l,
                presentacion: {
                  diapositivas: presentacion.diapositivas,
                  creadaEn: presentacion.creadaEn,
                  conVoz: presentacion.conVoz !== false,
                  ...(presentacion.opciones ? { opciones: presentacion.opciones } : {}),
                },
              }
            : l;
          if (!video) return conPresentacion;
          return {
            ...conPresentacion,
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

/** Todos los cursos: los de archivo y los publicados por las coaches (o también borradores). */
export async function cargarCursos(opciones: Opciones = {}): Promise<DatosCurso[]> {
  const deArchivo = await Promise.all(IDS_ARCHIVO.map((id) => cargarCurso(id)));
  const creados = await cargarCursosCreados(opciones);
  return [...deArchivo, ...(await Promise.all(creados.map((c) => cargarCurso(c.curso.id, opciones))))];
}

/** Las comunidades con cursos, en el orden de los cursos. */
export async function cargarComunidades(): Promise<DatosCurso["comunidad"][]> {
  const vistas = new Map<string, DatosCurso["comunidad"]>();
  for (const { comunidad } of await cargarCursos()) if (!vistas.has(comunidad.id)) vistas.set(comunidad.id, comunidad);
  // Las que creó una coach cuentan aunque todavía no publiquen un curso (para cobrar y publicar).
  for (const c of await consultar((a) => (a.comunidadesCoach ?? []).map((x) => comunidadCreadaDe(a, x.id)!))) {
    if (!vistas.has(c.id)) vistas.set(c.id, c);
  }
  return [...vistas.values()];
}

/** El id de comunidad que pide el navegador; si no llega o no existe, la principal. */
export async function idComunidad(valor: unknown): Promise<string> {
  const ids = (await cargarComunidades()).map((c) => c.id);
  return typeof valor === "string" && ids.includes(valor) ? valor : COMUNIDAD_PRINCIPAL;
}

/** El curso al que pertenece una lección, o null si no existe. */
export async function cursoDeLeccion(leccion: string, opciones: Opciones = {}): Promise<DatosCurso | null> {
  for (const datos of await cargarCursos(opciones)) {
    if (datos.curso.modulos.some((m) => m.lecciones.some((l) => l.id === leccion))) return datos;
  }
  return null;
}

/** ¿Es un curso que viaja con el proyecto (y no uno creado por una coach)? */
export function esCursoDeArchivo(id: string): boolean {
  return id in ARCHIVOS;
}

export function resumenDe({ curso, comunidad }: DatosCurso): ResumenCurso {
  const modulos = curso.modulos.filter((m) => m.id !== "MC");
  const lecciones = modulos.flatMap((m) => m.lecciones);
  return {
    id: curso.id,
    comunidad: comunidad.id,
    empresa: comunidad.empresa ?? "merkatics",
    titulo: curso.titulo,
    subtitulo: curso.subtitulo,
    modulos: modulos.length,
    lecciones: lecciones.map((l) => l.id),
    minutos: lecciones.reduce((s, l) => s + l.duracion_min, 0),
    gratis: etiquetaGratis(modulos),
    publicado: !curso.sinPublicar,
    ...(curso.foto ? { foto: curso.foto } : {}),
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
