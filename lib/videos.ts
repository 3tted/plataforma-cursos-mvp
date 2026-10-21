import { promises as fs } from "fs";
import path from "path";
import { del, issueSignedToken, presignUrl, put } from "@vercel/blob";
import { DIRECTORIO_VIDEOS } from "./almacen";
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

/** Con clave: el navegador pide permiso con `upload`; sin clave (OIDC), con `uploadPresigned`. */
export const conClaveDeBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export const videosEnLaNube = () => conClaveDeBlob() || (!!process.env.BLOB_STORE_ID && !!process.env.VERCEL);

/** Carpeta de Blob donde va el video de cada lección (Blob le agrega un sufijo al azar). */
export const rutaEnLaNube = (leccion: string) => `videos/${leccion}`;

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

/** La url con la que el reproductor ve el video guardado en Blob. */
export async function urlParaVer(video: VideoLeccion & { url: string }): Promise<string> {
  if (!esPrivado(video.url)) return video.url;
  const guardado = enlacesFirmados.get(video.archivo);
  if (guardado && guardado.vence - Date.now() > 10 * 60 * 1000) return guardado.url;
  const vence = Date.now() + DURACION_ENLACE;
  const firma = await issueSignedToken({ pathname: video.archivo, operations: ["get"], validUntil: vence });
  const { presignedUrl } = await presignUrl(firma, { operation: "get", pathname: video.archivo, access: "private" });
  enlacesFirmados.set(video.archivo, { url: presignedUrl, vence });
  return presignedUrl;
}

/** Borra el archivo de un video (de Blob o del disco). Si falla, el video ya no se usa: solo se avisa. */
export async function borrarArchivoDeVideo(video: VideoLeccion): Promise<void> {
  try {
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
