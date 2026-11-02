import { Redis } from "@upstash/redis";
import { promises as fs } from "fs";
import path from "path";
import { migrarACuentas } from "./cuentas";
import { sumarEjemplos } from "./ejemplos";
import type {
  Categoria,
  Comentario,
  ComunidadCreada,
  Cuenta,
  CursoCreado,
  Empresa,
  Inscripcion,
  IntentoExamen,
  Invitacion,
  IntentoRepaso,
  LeccionCoach,
  Pago,
  PreguntaIA,
  Presentacion,
  ProgresoAlumno,
  Publicacion,
  Rol,
  Sesion,
  VideoFuente,
  VideoLeccion,
} from "./tipos";

// Almacén del prototipo: un documento JSON, en un archivo o en Redis (ver
// "Dónde vive el almacén"). Es suficiente para validar el MVP con pocas
// personas; en la Fase 2 se reemplaza por la base de datos de Django (modelos
// Publicacion, Comentario, Pago, etc.).

export interface Almacen {
  siguienteId: number;
  publicaciones: Publicacion[];
  leccionesCoach: LeccionCoach[];
  preguntas: PreguntaIA[];
  pagos: Pago[];
  /** Opcional: los almacenes creados antes de que existieran los videos no lo traen. */
  videos?: VideoLeccion[];
  /** Videos subidos para armar un curso con IA, mientras se arma. */
  fuentesVideo?: VideoFuente[];
  /** Opcionales por la misma razón: llegaron con el repaso y el examen final. */
  progreso?: ProgresoAlumno[];
  repasos?: IntentoRepaso[];
  examenes?: IntentoExamen[];
  /** Alumnos unidos a la comunidad y a cada curso. Opcional: llegó después. */
  inscripciones?: Inscripcion[];
  /** Videos de muestra que ya se sembraron (para no volver a poner uno que la coach quitó). */
  muestras?: string[];
  /** Comunidades cuyas publicaciones de bienvenida ya se sembraron. */
  semillas?: string[];
  /** Empresas de ejemplo ya sembradas (lib/ejemplos.ts), para no volver a poner una que se borró. */
  ejemplos?: string[];
  /** Comunidades y cursos que crean las coaches desde la plataforma. */
  comunidadesCoach?: ComunidadCreada[];
  cursosCoach?: CursoCreado[];
  /** Presentaciones con IA de las lecciones (solo texto: la voz la pone el dispositivo). */
  presentaciones?: Presentacion[];
  /** Empresas (tenants) con su marca. Opcional: llegó después. */
  empresas?: Empresa[];
  /** Cuentas, sesiones abiertas e invitaciones. Opcionales: llegaron con el login (ver lib/cuentas.ts). */
  cuentas?: Cuenta[];
  sesiones?: Sesion[];
  invitaciones?: Invitacion[];
}

const DIRECTORIO =
  process.env.DATA_DIR ??
  (process.env.VERCEL ? "/tmp/plataforma-cursos" : path.join(process.cwd(), ".data"));
const ARCHIVO = path.join(DIRECTORIO, "almacen.json");
/** Los videos de las lecciones se guardan como archivos junto al almacén. */
export const DIRECTORIO_VIDEOS = path.join(DIRECTORIO, "videos");
const SEMILLA = path.join(process.cwd(), "data", "comunidad-seed.json");
const VIDEOS_MUESTRA = path.join(process.cwd(), "data", "videos");

const MAX_PREGUNTAS = 500;
const MAX_INTENTOS = 2000;

interface ComentarioSemilla {
  autor: string;
  rol: Rol;
  haceHoras: number;
  cuerpo: string;
}

interface PublicacionSemilla extends ComentarioSemilla {
  comunidad?: string;
  categoria: Categoria;
  fijada: boolean;
  titulo: string;
  comentarios: ComentarioSemilla[];
}

function haceHoras(horas: number): string {
  return new Date(Date.now() - horas * 3_600_000).toISOString();
}

async function leerSemilla(): Promise<PublicacionSemilla[]> {
  return (JSON.parse(await fs.readFile(SEMILLA, "utf8")) as { publicaciones: PublicacionSemilla[] }).publicaciones;
}
const comunidadDeSemilla = (p: PublicacionSemilla) => p.comunidad ?? "finanzas-claras";

// Convierte las publicaciones de la semilla en publicaciones del almacén.
function publicacionesDeSemilla(semilla: PublicacionSemilla[], primerId: number): { publicaciones: Publicacion[]; siguienteId: number } {
  let id = primerId;
  const publicaciones: Publicacion[] = semilla.map((p) => ({
    id: id++,
    ...(p.comunidad ? { comunidad: p.comunidad } : {}),
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
  return { publicaciones, siguienteId: id };
}

async function sembrar(): Promise<Almacen> {
  const semilla = await leerSemilla();
  const { publicaciones, siguienteId } = publicacionesDeSemilla(semilla, 1);
  const almacen: Almacen = {
    siguienteId,
    publicaciones,
    semillas: [...new Set(semilla.map(comunidadDeSemilla))],
    leccionesCoach: [],
    preguntas: [],
    pagos: [],
    videos: await sembrarVideos(),
    muestras: (await archivosDeMuestra()).map(leccionDeMuestra),
    // La matriz de la coach empieza vacía: solo muestra a quien de verdad avance.
    progreso: [],
    repasos: [],
    examenes: [],
  };
  migrarACuentas(almacen);
  await sumarEjemplos(almacen);
  return almacen;
}

// Videos de muestra que viajan con el proyecto (data/videos/L1.webm…). Se
// copian junto al almacén para que la coach pueda reemplazarlos o quitarlos
// como cualquier video subido.
let listaMuestras: string[] | null = null;
async function archivosDeMuestra(): Promise<string[]> {
  if (listaMuestras) return listaMuestras;
  try {
    listaMuestras = (await fs.readdir(VIDEOS_MUESTRA)).filter((a) => /^[A-Za-z0-9]+\.webm$/.test(a));
  } catch {
    listaMuestras = [];
  }
  return listaMuestras;
}
const leccionDeMuestra = (archivo: string) => archivo.replace(/\.webm$/, "");

async function sembrarVideos(): Promise<VideoLeccion[]> {
  const archivos = await archivosDeMuestra();
  if (archivos.length === 0) return [];
  await fs.mkdir(DIRECTORIO_VIDEOS, { recursive: true });
  const subidoEn = new Date().toISOString();
  return Promise.all(
    archivos.map(async (a) => {
      const leccion = leccionDeMuestra(a);
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

// ---------------------------------------------------------------------------
// Dónde vive el almacén
// ---------------------------------------------------------------------------
// En la computadora es un archivo. En Vercel el servidor corre en varias copias
// y cada una tiene su propio disco temporal: con Redis (Upstash, plan gratuito)
// todas comparten los mismos datos. Basta con definir sus variables de entorno.

// Vercel puede ponerles un prefijo al conectar Upstash (MIPREFIJO_KV_REST_API_URL),
// así que se buscan por cómo terminan.
function variable(...finales: string[]): string | undefined {
  for (const final of finales) {
    const nombre = Object.keys(process.env).find((n) => n === final || n.endsWith(`_${final}`));
    if (nombre && process.env[nombre]) return process.env[nombre];
  }
  return undefined;
}
const URL_REDIS = variable("UPSTASH_REDIS_REST_URL", "KV_REST_API_URL");
const TOKEN_REDIS = variable("UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN");
const redis =
  URL_REDIS && TOKEN_REDIS ? new Redis({ url: URL_REDIS, token: TOKEN_REDIS, automaticDeserialization: false }) : null;
const CLAVE = "plataforma-cursos:almacen";
const CLAVE_VERSION = `${CLAVE}:version`;

/** Dónde se guardan los datos, para mostrarlo en el estado de la plataforma. */
export const ALMACEN_COMPARTIDO = redis !== null;

// Guarda solo si nadie más escribió desde que se leyó (otra copia del servidor).
const GUARDAR_SI_NO_CAMBIO = `
if (redis.call('GET', KEYS[2]) or '') == ARGV[2] then
  redis.call('SET', KEYS[1], ARGV[1])
  redis.call('INCR', KEYS[2])
  return 1
end
return 0`;

interface Lectura {
  texto: string | null;
  version: string | null;
}

async function leerCrudo(): Promise<Lectura> {
  if (redis) {
    const [texto, version] = await redis.mget<[string | null, string | null]>(CLAVE, CLAVE_VERSION);
    return { texto, version };
  }
  try {
    return { texto: await fs.readFile(ARCHIVO, "utf8"), version: null };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { texto: null, version: null };
    throw error;
  }
}

/** Devuelve false si otra copia del servidor escribió primero: hay que volver a leer. */
async function escribirCrudo(almacen: Almacen, version: string | null): Promise<boolean> {
  if (redis) {
    const resultado = await redis.eval<[string, string], number>(
      GUARDAR_SI_NO_CAMBIO,
      [CLAVE, CLAVE_VERSION],
      [JSON.stringify(almacen), String(version ?? "")],
    );
    return Number(resultado) === 1;
  }
  await fs.mkdir(DIRECTORIO, { recursive: true });
  // Escritura atómica: primero a un archivo temporal y luego se renombra,
  // para que un corte a medias nunca deje el JSON dañado.
  // Un temporal por escritura: dos escrituras a la vez no se pisan el archivo.
  const temporal = `${ARCHIVO}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fs.writeFile(temporal, JSON.stringify(almacen, null, 2), "utf8");
  await fs.rename(temporal, ARCHIVO);
  return true;
}

// Fotos de portada: cada una en su propia clave de Redis (o su archivo), fuera
// del documento del almacén, para que no lo haga pesado. En Redis, a
// diferencia de los videos, sobreviven entre copias del servidor en Vercel.
const DIRECTORIO_FOTOS = path.join(DIRECTORIO, "fotos");
const claveFoto = (clave: string) => `${CLAVE}:foto:${clave}`;

export async function guardarFoto(clave: string, tipo: string, datos: Buffer): Promise<void> {
  if (redis) {
    await redis.set(claveFoto(clave), JSON.stringify({ tipo, datos: datos.toString("base64") }));
    return;
  }
  await fs.mkdir(DIRECTORIO_FOTOS, { recursive: true });
  await fs.writeFile(path.join(DIRECTORIO_FOTOS, clave), datos);
  await fs.writeFile(path.join(DIRECTORIO_FOTOS, `${clave}.tipo`), tipo, "utf8");
}

export async function leerFoto(clave: string): Promise<{ tipo: string; datos: Buffer } | null> {
  if (redis) {
    const texto = await redis.get<string>(claveFoto(clave));
    if (!texto) return null;
    const { tipo, datos } = JSON.parse(texto) as { tipo: string; datos: string };
    return { tipo, datos: Buffer.from(datos, "base64") };
  }
  try {
    const [datos, tipo] = await Promise.all([
      fs.readFile(path.join(DIRECTORIO_FOTOS, clave)),
      fs.readFile(path.join(DIRECTORIO_FOTOS, `${clave}.tipo`), "utf8"),
    ]);
    return { tipo, datos };
  } catch {
    return null;
  }
}

export async function borrarFoto(clave: string): Promise<void> {
  if (redis) {
    await redis.del(claveFoto(clave));
    return;
  }
  await Promise.all(
    [clave, `${clave}.tipo`].map((a) => fs.rm(path.join(DIRECTORIO_FOTOS, a), { force: true })),
  );
}

// Lee el almacén; si no existe, lo siembra. `cambiado` indica que hay que guardarlo.
async function cargar(): Promise<{ almacen: Almacen; version: string | null; cambiado: boolean }> {
  const { texto, version } = await leerCrudo();
  if (texto === null) return { almacen: await sembrar(), version, cambiado: true };
  const almacen = JSON.parse(texto) as Almacen;
  let cambiado = false;
  // Los almacenes creados antes del repaso y el examen no traen estas listas.
  if (almacen.progreso === undefined) {
    Object.assign(almacen, { progreso: [], repasos: [], examenes: [] });
    cambiado = true;
  }
  if (await sumarMuestrasNuevas(almacen)) cambiado = true;
  if (await sumarSemillasNuevas(almacen)) cambiado = true;
  if (migrarACuentas(almacen)) cambiado = true;
  if (await sumarEjemplos(almacen)) cambiado = true;
  return { almacen, version, cambiado };
}

// Las comunidades que llegan después (por ejemplo, Vende por WhatsApp)
// reciben su publicación de bienvenida una sola vez en los almacenes que ya
// existían. Los de antes solo tenían sembrada Finanzas Claras.
async function sumarSemillasNuevas(almacen: Almacen): Promise<boolean> {
  const sembradas = new Set(almacen.semillas ?? ["finanzas-claras"]);
  const semilla = await leerSemilla();
  const nuevas = semilla.filter((p) => !sembradas.has(comunidadDeSemilla(p)));
  if (nuevas.length === 0 && almacen.semillas) return false;
  const { publicaciones, siguienteId } = publicacionesDeSemilla(nuevas, almacen.siguienteId);
  almacen.publicaciones.push(...publicaciones);
  almacen.siguienteId = siguienteId;
  almacen.semillas = [...new Set([...sembradas, ...semilla.map(comunidadDeSemilla)])];
  return true;
}

// Los almacenes que ya existían (por ejemplo, el de Redis en Vercel) se
// sembraron con los videos de L1 a L8. Si después llegan videos de muestra
// nuevos (los de otro curso), se agregan una sola vez. La copia en disco no
// hace falta: rutaDelVideo sirve el archivo original de data/videos.
const MUESTRAS_ORIGINALES = ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8"];
async function sumarMuestrasNuevas(almacen: Almacen): Promise<boolean> {
  const sembradas = new Set(almacen.muestras ?? MUESTRAS_ORIGINALES);
  const nuevas = (await archivosDeMuestra()).filter((a) => !sembradas.has(leccionDeMuestra(a)));
  if (nuevas.length === 0 && almacen.muestras) return false;
  almacen.videos ??= [];
  const subidoEn = new Date().toISOString();
  for (const archivo of nuevas) {
    const leccion = leccionDeMuestra(archivo);
    sembradas.add(leccion);
    if (almacen.videos.some((v) => v.leccion === leccion)) continue;
    const { size } = await fs.stat(path.join(VIDEOS_MUESTRA, archivo));
    almacen.videos.push({
      leccion,
      archivo: `${leccion}-muestra.webm`,
      tipo: "video/webm",
      bytes: size,
      nombreOriginal: `video-de-muestra-${leccion}.webm`,
      subidoEn,
    });
  }
  almacen.muestras = [...sembradas];
  return true;
}

// Dentro de una misma copia del servidor, las escrituras se encadenan; entre
// copias, la versión de Redis detecta el choque y el cambio se reintenta.
let cola: Promise<unknown> = Promise.resolve();
const MAX_REINTENTOS = 5;

export function modificar<T>(cambio: (almacen: Almacen) => T): Promise<T> {
  const tarea = cola.then(async () => {
    for (let intento = 0; intento < MAX_REINTENTOS; intento++) {
      const { almacen, version } = await cargar();
      const resultado = cambio(almacen);
      if (almacen.preguntas.length > MAX_PREGUNTAS) {
        almacen.preguntas = almacen.preguntas.slice(-MAX_PREGUNTAS);
      }
      if (almacen.repasos && almacen.repasos.length > MAX_INTENTOS) {
        almacen.repasos = almacen.repasos.slice(-MAX_INTENTOS);
      }
      if (await escribirCrudo(almacen, version)) return resultado;
    }
    throw new Error("No se pudo guardar el cambio: hubo demasiadas escrituras al mismo tiempo.");
  });
  cola = tarea.catch(() => undefined);
  return tarea;
}

export async function consultar<T>(lectura: (almacen: Almacen) => T): Promise<T> {
  await cola;
  const { almacen, version, cambiado } = await cargar();
  // Si otra copia sembró primero, su versión gana y esta escritura se descarta.
  // Es solo poner al día el almacén: si choca con otra escritura, se reintenta
  // en la siguiente lectura y esta consulta responde igual.
  if (cambiado) {
    try {
      await escribirCrudo(almacen, version);
    } catch (e) {
      console.warn("No se pudo poner al día el almacén; se reintenta después.", e);
    }
  }
  return lectura(almacen);
}

// Los videos de muestra viajan con el proyecto: si esta copia del servidor no
// tiene su copia en el disco temporal, se sirve el archivo original.
export async function rutaDelVideo(video: VideoLeccion): Promise<string> {
  const ruta = path.join(DIRECTORIO_VIDEOS, video.archivo);
  if (!video.archivo.endsWith("-muestra.webm")) return ruta;
  try {
    await fs.access(ruta);
    return ruta;
  } catch {
    return path.join(VIDEOS_MUESTRA, `${video.leccion}.webm`);
  }
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
