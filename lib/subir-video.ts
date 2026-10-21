// Subida del video de una lección desde el navegador, con avance y opción de
// cancelar. Con Vercel Blob conectado, el archivo va directo a Blob (sin el
// límite de 4 MB de las peticiones al servidor) y luego se anota en la
// lección. Sin Blob, va al servidor como hasta ahora.

import { upload } from "@vercel/blob/client";
import { TIPOS_VIDEO } from "./reglas-video";

export interface SubidaDeVideo {
  /** Se cumple al terminar; si falla, el error trae un mensaje para mostrar. */
  listo: Promise<void>;
  cancelar: () => void;
}

/** Error de una subida cancelada a propósito: no se muestra como falla. */
export class SubidaCancelada extends Error {}

const SIN_CONEXION = "Se cortó la conexión mientras subía el video. Revisa tu internet e inténtalo de nuevo.";
const GENERICO = "No se pudo subir el video. Inténtalo de nuevo.";

export function subirVideo(
  leccion: string,
  archivo: File,
  tipo: string,
  enLaNube: boolean,
  alAvanzar: (fraccion: number) => void,
): SubidaDeVideo {
  return enLaNube ? aBlob(leccion, archivo, tipo, alAvanzar) : alServidor(leccion, archivo, tipo, alAvanzar);
}

function aBlob(leccion: string, archivo: File, tipo: string, alAvanzar: (f: number) => void): SubidaDeVideo {
  const control = new AbortController();
  const listo = (async () => {
    let url: string;
    try {
      const subido = await upload(`videos/${leccion}.${TIPOS_VIDEO[tipo]}`, archivo, {
        access: "public",
        handleUploadUrl: `/api/videos/${leccion}/subir`,
        contentType: tipo,
        // En partes (y reintentando las que fallen) a partir de 50 MB.
        multipart: archivo.size > 50 * 1024 * 1024,
        abortSignal: control.signal,
        onUploadProgress: ({ percentage }) => alAvanzar(percentage / 100),
      });
      url = subido.url;
    } catch (e) {
      if (control.signal.aborted) throw new SubidaCancelada();
      console.error("Subida a Vercel Blob", e);
      throw new Error(GENERICO);
    }
    const res = await fetch(`/api/videos/${leccion}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, nombre: archivo.name }),
    }).catch(() => null);
    if (!res) throw new Error(SIN_CONEXION);
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? GENERICO);
  })();
  return { listo, cancelar: () => control.abort() };
}

// XMLHttpRequest en vez de fetch: es la única forma de mostrar el avance de una subida.
function alServidor(leccion: string, archivo: File, tipo: string, alAvanzar: (f: number) => void): SubidaDeVideo {
  const xhr = new XMLHttpRequest();
  const listo = new Promise<void>((resolver, rechazar) => {
    xhr.open("PUT", `/api/videos/${leccion}`);
    xhr.setRequestHeader("Content-Type", tipo);
    xhr.setRequestHeader("X-Nombre-Archivo", encodeURIComponent(archivo.name));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) alAvanzar(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolver();
      let mensaje = GENERICO;
      try {
        mensaje = (JSON.parse(xhr.responseText) as { error?: string }).error ?? mensaje;
      } catch {
        // respuesta sin JSON (por ejemplo, el límite de tamaño del servidor publicado)
        if (xhr.status === 413) mensaje = "El video es demasiado pesado para el servidor publicado. Prueba con uno más corto.";
      }
      rechazar(new Error(mensaje));
    };
    xhr.onerror = () => rechazar(new Error(SIN_CONEXION));
    xhr.onabort = () => rechazar(new SubidaCancelada());
    xhr.send(archivo);
  });
  return { listo, cancelar: () => xhr.abort() };
}
