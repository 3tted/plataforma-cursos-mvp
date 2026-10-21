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
  enLaNube: boolean,
  alAvanzar: (fraccion: number) => void,
  /** Lo que dura (segundos), si ya se midió. */
  duracion?: number,
): SubidaDeVideo {
  return enLaNube ? aBlob(destino, archivo, tipo, alAvanzar, duracion) : alServidor(destino, archivo, tipo, alAvanzar, duracion);
}

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

function aBlob(destino: DestinoDeVideo, archivo: File, tipo: string, alAvanzar: (f: number) => void, duracion?: number): SubidaDeVideo {
  const control = new AbortController();
  const listo = (async () => {
    // Primero, cómo subir aquí: almacenamiento público o privado, con o sin clave.
    const forma = await fetch(`${destino.base}/subir`).catch(() => null);
    if (!forma) throw new Error(SIN_CONEXION);
    const datos = (await forma.json().catch(() => ({}))) as { acceso?: "public" | "private"; firmada?: boolean; error?: string };
    if (!forma.ok || !datos.acceso) throw new Error(datos.error ?? GENERICO);
    if (control.signal.aborted) throw new SubidaCancelada();

    let url: string;
    try {
      const subida = datos.firmada ? uploadPresigned : upload;
      const subido = await subida(`${destino.enLaNube}.${TIPOS_VIDEO[tipo]}`, archivo, {
        access: datos.acceso,
        handleUploadUrl: `${destino.base}/subir`,
        contentType: tipo,
        // Con clave, en partes (y reintentando las que fallen) a partir de 50 MB.
        multipart: !datos.firmada && archivo.size > 50 * 1024 * 1024,
        abortSignal: control.signal,
        onUploadProgress: ({ percentage }) => alAvanzar(percentage / 100),
      });
      url = subido.url;
    } catch (e) {
      if (control.signal.aborted) throw new SubidaCancelada();
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
  })();
  return { listo, cancelar: () => control.abort() };
}

// XMLHttpRequest en vez de fetch: es la única forma de mostrar el avance de una subida.
function alServidor(destino: DestinoDeVideo, archivo: File, tipo: string, alAvanzar: (f: number) => void, duracion?: number): SubidaDeVideo {
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
