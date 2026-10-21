import { promises as fs } from "fs";
import path from "path";
import { del, head, issueSignedToken, presignUrl, put } from "@vercel/blob";
import {
  handleUpload,
  handleUploadPresigned,
  type HandleUploadBody,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";
import { DIRECTORIO_VIDEOS, consultar } from "./almacen";
import { error, leerJson } from "./http";
import { MAX_BYTES_VIDEO, TIPOS_VIDEO, tamañoLegible } from "./reglas-video";
import type { VideoLeccion } from "./tipos";

// Dónde viven los videos de las lecciones. Con Vercel Blob conectado, el
// navegador los sube directo a Blob: no pasan por el servidor, así que no hay
// límite de 4 MB ni se pierden con el disco temporal de Vercel. Sin Blob (en
// local), se guardan como archivos en DATA_DIR/videos, como siempre. Los videos
// de muestra viajan con el proyecto.
//
// Blob se conecta de dos formas: con la clave BLOB_READ_WRITE_TOKEN (la de
// antes) o, en los almacenamientos nuevos, con BLOB_STORE_ID y la identidad
// que Vercel le da a la app (OIDC), sin clave.
//
// Cada subida tiene su ruta base (la de una lección o la del video para armar
// un curso): GET y POST en <base>/subir dan el permiso para subir a Blob, y PUT
// en <base> recibe el archivo (sin Blob) o anota el que ya se subió (con Blob).

/** Con clave: el navegador pide permiso con `upload`; sin clave (OIDC), con `uploadPresigned`. */
export const conClaveDeBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export const videosEnLaNube = () => conClaveDeBlob() || (!!process.env.BLOB_STORE_ID && !!process.env.VERCEL);

/** Carpeta de Blob donde va el video de cada lección (Blob le agrega un sufijo al azar). */
export const rutaEnLaNube = (leccion: string) => `videos/${leccion}`;

/** Donde va en Blob el video con el que la IA arma un curso. */
export const PREFIJO_FUENTE = "videos/fuente";

/** ¿La url es de un archivo de Vercel Blob? */
export function esUrlDeBlob(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

const esPrivado = (url: string) => new URL(url).hostname.includes(".private.");

export type AccesoDeBlob = "public" | "private";
let acceso: Promise<AccesoDeBlob> | null = null;

/**
 * Si el almacenamiento es público o privado (se elige al crearlo en Vercel).
 * Se averigua una vez escribiendo un archivito de prueba y se recuerda.
 */
export function accesoDeLaNube(): Promise<AccesoDeBlob> {
  acceso ??= (async () => {
    for (const intento of ["public", "private"] as const) {
      try {
        const prueba = await put("videos/.acceso.txt", "ok", {
          access: intento,
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "text/plain",
        });
        await del(prueba.url).catch(() => {});
        return intento;
      } catch (e) {
        console.warn(`Vercel Blob no aceptó acceso ${intento}`, e);
      }
    }
    throw new Error("No se pudo conectar con Vercel Blob.");
  })().catch((e) => {
    acceso = null;
    throw e;
  });
  return acceso;
}

// En un almacenamiento privado, el reproductor necesita un enlace firmado. Se
// reusa mientras le queden más de 10 minutos.
const enlacesFirmados = new Map<string, { url: string; vence: number }>();
const DURACION_ENLACE = 6 * 60 * 60 * 1000;

/** La url con la que se lee un video guardado en Blob (el reproductor, o la IA que lo ve). */
export async function urlParaVer(video: { archivo: string; url: string }): Promise<string> {
  if (!esPrivado(video.url)) return video.url;
  const guardado = enlacesFirmados.get(video.archivo);
  if (guardado && guardado.vence - Date.now() > 10 * 60 * 1000) return guardado.url;
  const vence = Date.now() + DURACION_ENLACE;
  const firma = await issueSignedToken({ pathname: video.archivo, operations: ["get"], validUntil: vence });
  const { presignedUrl } = await presignUrl(firma, { operation: "get", pathname: video.archivo, access: "private" });
  enlacesFirmados.set(video.archivo, { url: presignedUrl, vence });
  return presignedUrl;
}

/**
 * Borra el archivo de un video (de Blob o del disco) si ya nada lo usa: las
 * lecciones de un curso armado desde un video comparten el archivo. Se llama
 * después de quitar el registro. Si falla, el video ya no se usa: solo se avisa.
 */
export async function borrarArchivoDeVideo(video: { archivo: string; url?: string }): Promise<void> {
  try {
    const enUso = await consultar(
      (a) => (a.videos ?? []).some((v) => v.archivo === video.archivo) || (a.fuentesVideo ?? []).some((f) => f.archivo === video.archivo),
    );
    if (enUso) return;
    if (video.url) {
      enlacesFirmados.delete(video.archivo);
      if (videosEnLaNube()) await del(video.url);
      return;
    }
    await fs.rm(path.join(DIRECTORIO_VIDEOS, video.archivo), { force: true });
  } catch (e) {
    console.warn("No se pudo borrar el archivo del video", video.archivo, e);
  }
}

// ---------------------------------------------------------------------------
// Recibir una subida
// ---------------------------------------------------------------------------

const REGLAS = { allowedContentTypes: Object.keys(TIPOS_VIDEO), maximumSizeInBytes: MAX_BYTES_VIDEO };

/**
 * GET <base>/subir: cómo subir aquí. Sin Blob, al servidor ({ nube: false });
 * con Blob, si el almacenamiento es público o privado y si hay clave.
 */
export async function formaDeSubir(): Promise<Response> {
  if (!videosEnLaNube()) return Response.json({ nube: false });
  return Response.json({ nube: true, acceso: await accesoDeLaNube(), firmada: !conClaveDeBlob() });
}

/**
 * POST <base>/subir: el permiso para que el navegador suba a Blob, solo a
 * `<prefijo>.<extensión>`, solo videos y hasta el tamaño máximo. `revisar`
 * confirma que quien sube puede hacerlo (lanza si no).
 */
export async function permisoDeSubir(req: Request, prefijo: string, revisar: () => Promise<unknown>): Promise<Response> {
  if (!videosEnLaNube()) return error("Este servidor guarda los videos en su disco: súbelo de la forma normal.");
  const body = (await req.json()) as HandleUploadBody | HandleUploadPresignedBody;
  const validar = async (pathname: string) => {
    if (!pathname.startsWith(`${prefijo}.`)) throw new Error("Ruta de video no permitida.");
    await revisar();
  };
  if (body.type === "blob.generate-presigned-url") {
    const respuesta = await handleUploadPresigned({
      body,
      request: req,
      getSignedToken: async (pathname) => {
        await validar(pathname);
        const token = await issueSignedToken({ pathname, operations: ["put"], ...REGLAS });
        return { token, urlOptions: { ...REGLAS, addRandomSuffix: true } };
      },
    });
    return Response.json(respuesta);
  }
  const respuesta = await handleUpload({
    body: body as HandleUploadBody,
    request: req,
    onBeforeGenerateToken: async (pathname) => {
      await validar(pathname);
      return { ...REGLAS, addRandomSuffix: true };
    },
  });
  return Response.json(respuesta);
}

/** Un video recibido: guardado en el disco o ya en Blob. */
export interface VideoRecibido {
  archivo: string;
  url?: string;
  tipo: string;
  bytes: number;
  nombreOriginal: string;
  subidoEn: string;
  /** Lo que dura según el navegador, si lo mandó (segundos). */
  duracion?: number;
}

const DEMASIADO_PESADO = `El video pesa más de ${tamañoLegible(MAX_BYTES_VIDEO)}. Expórtalo en menor calidad o recórtalo.`;

const duracionValida = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 24 * 3600 ? Math.round(n * 10) / 10 : undefined;
};

/**
 * PUT <base>: con JSON ({ url, nombre, duracion }) anota un video que el
 * navegador ya subió a Blob, revisando en Blob que esté bajo `prefijo` y sea
 * video. Si no, el archivo llega tal cual en el cuerpo y se escribe al disco
 * como `<nombre>-<marca>.<ext>` mientras llega, sin cargarlo en memoria.
 */
export async function recibirVideo(req: Request, nombre: string, prefijo: string): Promise<VideoRecibido | Response> {
  if ((req.headers.get("content-type") ?? "").startsWith("application/json")) {
    if (!videosEnLaNube()) return error("Este servidor no tiene Vercel Blob conectado.");
    const datos = await leerJson(req);
    if (!esUrlDeBlob(datos.url)) return error("Esa dirección no es de un video subido a la plataforma.");
    const info = await head(datos.url).catch(() => null);
    if (!info) return error("No encontramos el video subido. Inténtalo de nuevo.", 404);
    if (!info.pathname.startsWith(`${prefijo}.`)) return error("Ese video no es de aquí.", 403);
    const tipo = info.contentType.split(";")[0].trim();
    if (!TIPOS_VIDEO[tipo]) return error("Sube el video en MP4, WebM o MOV.", 415);
    if (info.size > MAX_BYTES_VIDEO) return error(DEMASIADO_PESADO, 413);
    return {
      archivo: info.pathname,
      url: info.url,
      tipo,
      bytes: info.size,
      nombreOriginal: typeof datos.nombre === "string" && datos.nombre.trim() ? datos.nombre.trim().slice(0, 120) : "video",
      subidoEn: new Date().toISOString(),
      duracion: duracionValida(datos.duracion),
    };
  }

  const tipo = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  const extension = TIPOS_VIDEO[tipo];
  if (!extension) return error("Sube el video en MP4, WebM o MOV.", 415);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES_VIDEO) return error(DEMASIADO_PESADO, 413);
  if (!req.body) return error("No llegó ningún archivo.");

  let nombreOriginal = "video";
  try {
    nombreOriginal = decodeURIComponent(req.headers.get("x-nombre-archivo") ?? "video").slice(0, 120);
  } catch {
    // nombre con codificación rota: se queda el genérico
  }

  await fs.mkdir(DIRECTORIO_VIDEOS, { recursive: true });
  const marca = Date.now();
  const temporal = path.join(DIRECTORIO_VIDEOS, `.${nombre}-${marca}.subiendo`);
  const archivo = await fs.open(temporal, "w");
  let bytes = 0;
  let cabecera = Buffer.alloc(0);
  try {
    const lector = req.body.getReader();
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES_VIDEO) {
        await lector.cancel();
        throw new Error("demasiado-grande");
      }
      if (cabecera.length < 12) cabecera = Buffer.concat([cabecera, Buffer.from(value.subarray(0, 12))]);
      await archivo.write(value);
    }
  } catch (e) {
    await archivo.close();
    await fs.rm(temporal, { force: true });
    if ((e as Error).message === "demasiado-grande") return error(DEMASIADO_PESADO, 413);
    return error("La subida se interrumpió. Revisa tu conexión e inténtalo de nuevo.", 400);
  }
  await archivo.close();

  if (bytes === 0 || !pareceVideo(cabecera)) {
    await fs.rm(temporal, { force: true });
    return error("El archivo no parece un video MP4, WebM o MOV.", 415);
  }
  const final = `${nombre}-${marca}.${extension}`;
  await fs.rename(temporal, path.join(DIRECTORIO_VIDEOS, final));
  return {
    archivo: final,
    tipo,
    bytes,
    nombreOriginal,
    subidoEn: new Date(marca).toISOString(),
    duracion: duracionValida(req.headers.get("x-duracion")),
  };
}

// MP4 y MOV traen "ftyp" en los bytes 4 a 8; WebM empieza con la firma EBML.
function pareceVideo(cabecera: Buffer): boolean {
  const ftyp = cabecera.subarray(4, 8).toString("latin1") === "ftyp";
  const ebml = cabecera.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  return ftyp || ebml;
}

/** El video de una lección listo para guardarse (sin tramo: el video completo). */
export function videoDeLeccion(leccion: string, v: VideoRecibido, tramo?: { inicio: number; fin: number }): VideoLeccion {
  return {
    leccion,
    archivo: v.archivo,
    ...(v.url ? { url: v.url } : {}),
    tipo: v.tipo,
    bytes: v.bytes,
    nombreOriginal: v.nombreOriginal,
    subidoEn: v.subidoEn,
    ...(tramo ? tramo : {}),
  };
}
