// Subida de un video desde el navegador, con avance y opción de cancelar. Con
// Vercel Blob conectado, el archivo va directo a Blob (sin el límite de 4 MB
// de las peticiones al servidor) y luego se anota. Sin Blob, va al servidor
// como hasta ahora. Cada destino tiene su ruta base (ver lib/videos.ts).

import { upload, uploadPresigned } from "@vercel/blob/client";
import { TIPOS_VIDEO } from "./reglas-video";

export interface SubidaDeVideo {
  /** Se cumple al terminar con lo que respondió el servidor; si falla, el error trae un mensaje para mostrar. */
  listo: Promise<unknown>;
  cancelar: () => void;
}

/** A dónde va: `base` es la ruta de la API; `enLaNube`, el nombre en Blob sin extensión. */
export interface DestinoDeVideo {
  base: string;
  enLaNube: string;
}

/** El video de una lección. */
export const destinoDeLeccion = (leccion: string): DestinoDeVideo => ({ base: `/api/videos/${leccion}`, enLaNube: `videos/${leccion}` });

/** Error de una subida cancelada a propósito: no se muestra como falla. */
export class SubidaCancelada extends Error {}

const SIN_CONEXION = "Se cortó la conexión mientras subía el video. Revisa tu internet e inténtalo de nuevo.";
const GENERICO = "No se pudo subir el video. Inténtalo de nuevo.";

export function subirVideo(
  destino: DestinoDeVideo,
  archivo: File,
  tipo: string,
  alAvanzar: (fraccion: number) => void,
  /** Lo que dura (segundos), si ya se midió. */
  duracion?: number,
): SubidaDeVideo {
  const control = new AbortController();
  let cancelarAlServidor: (() => void) | null = null;
  const listo = (async () => {
    // Primero se le pregunta al servidor cómo subir: a Blob (público o privado, con o sin clave) o a él mismo.
    const forma = await fetch(`${destino.base}/subir`, { signal: control.signal }).catch(() => null);
    if (control.signal.aborted) throw new SubidaCancelada();
    if (!forma) throw new Error(SIN_CONEXION);
    const datos = (await forma.json().catch(() => ({}))) as FormaDeSubir & { error?: string };
    if (!forma.ok) throw new Error(datos.error ?? GENERICO);
    if (datos.nube && datos.acceso) return aBlob(destino, archivo, tipo, alAvanzar, duracion, datos, control.signal);
    const alServidor = aServidor(destino, archivo, tipo, alAvanzar, duracion);
    cancelarAlServidor = alServidor.cancelar;
    return alServidor.listo;
  })();
  return {
    listo,
    cancelar: () => {
      control.abort();
      cancelarAlServidor?.();
    },
  };
}

type FormaDeSubir = { nube?: boolean; acceso?: "public" | "private"; firmada?: boolean };

/** Cuánto dura un video, leyendo solo su encabezado (null si el navegador no lo puede abrir). */
export function medirDuracion(archivo: File): Promise<number | null> {
  return new Promise((resolver) => {
    const url = URL.createObjectURL(archivo);
    const video = document.createElement("video");
    const terminar = (valor: number | null) => {
      URL.revokeObjectURL(url);
      resolver(valor);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => terminar(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => terminar(null);
    video.src = url;
  });
}

async function respuesta(res: Response | null): Promise<unknown> {
  if (!res) throw new Error(SIN_CONEXION);
  const datos = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(datos.error ?? GENERICO);
  return datos;
}

async function aBlob(
  destino: DestinoDeVideo,
  archivo: File,
  tipo: string,
  alAvanzar: (f: number) => void,
  duracion: number | undefined,
  forma: FormaDeSubir,
  senal: AbortSignal,
): Promise<unknown> {
  let url: string;
  try {
    const subida = forma.firmada ? uploadPresigned : upload;
    const subido = await subida(`${destino.enLaNube}.${TIPOS_VIDEO[tipo]}`, archivo, {
      access: forma.acceso!,
      handleUploadUrl: `${destino.base}/subir`,
      contentType: tipo,
      // Con clave, en partes (y reintentando las que fallen) a partir de 50 MB.
      multipart: !forma.firmada && archivo.size > 50 * 1024 * 1024,
      abortSignal: senal,
      onUploadProgress: ({ percentage }) => alAvanzar(percentage / 100),
    });
    url = subido.url;
  } catch (e) {
    if (senal.aborted) throw new SubidaCancelada();
    console.error("Subida a Vercel Blob", e);
    throw new Error(GENERICO);
  }
  return respuesta(
    await fetch(destino.base, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, nombre: archivo.name, ...(duracion ? { duracion } : {}) }),
    }).catch(() => null),
  );
}

// XMLHttpRequest en vez de fetch: es la única forma de mostrar el avance de una subida.
function aServidor(destino: DestinoDeVideo, archivo: File, tipo: string, alAvanzar: (f: number) => void, duracion?: number): SubidaDeVideo {
  const xhr = new XMLHttpRequest();
  const listo = new Promise<unknown>((resolver, rechazar) => {
    xhr.open("PUT", destino.base);
    xhr.setRequestHeader("Content-Type", tipo);
    xhr.setRequestHeader("X-Nombre-Archivo", encodeURIComponent(archivo.name));
    if (duracion) xhr.setRequestHeader("X-Duracion", String(duracion));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) alAvanzar(e.loaded / e.total);
    };
    xhr.onload = () => {
      let datos: { error?: string } = {};
      try {
        datos = JSON.parse(xhr.responseText) as { error?: string };
      } catch {
        // respuesta sin JSON (por ejemplo, el límite de tamaño del servidor publicado)
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolver(datos);
      rechazar(
        new Error(
          datos.error ??
            (xhr.status === 413 ? "El video es demasiado pesado para el servidor publicado. Prueba con uno más corto." : GENERICO),
        ),
      );
    };
    xhr.onerror = () => rechazar(new Error(SIN_CONEXION));
    xhr.onabort = () => rechazar(new SubidaCancelada());
    xhr.send(archivo);
  });
  return { listo, cancelar: () => xhr.abort() };
}
