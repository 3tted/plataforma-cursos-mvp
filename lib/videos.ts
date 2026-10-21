import { promises as fs } from "fs";
import path from "path";
import { del } from "@vercel/blob";
import { DIRECTORIO_VIDEOS } from "./almacen";
import type { VideoLeccion } from "./tipos";

// Dónde viven los videos de las lecciones. Con Vercel Blob conectado
// (BLOB_READ_WRITE_TOKEN), el navegador los sube directo a Blob: no pasan
// por el servidor, así que no hay límite de 4 MB ni se pierden con el disco
// temporal de Vercel. Sin Blob (en local), se guardan como archivos en
// DATA_DIR/videos, como siempre. Los videos de muestra viajan con el proyecto.

export const videosEnLaNube = () => !!process.env.BLOB_READ_WRITE_TOKEN;

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

/** Borra el archivo de un video (de Blob o del disco). Si falla, el video ya no se usa: solo se avisa. */
export async function borrarArchivoDeVideo(video: VideoLeccion): Promise<void> {
  try {
    if (video.url) {
      if (videosEnLaNube()) await del(video.url);
      return;
    }
    await fs.rm(path.join(DIRECTORIO_VIDEOS, video.archivo), { force: true });
  } catch (e) {
    console.warn("No se pudo borrar el archivo del video", video.archivo, e);
  }
}
