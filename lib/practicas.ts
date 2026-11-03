import { promises as fs } from "fs";
import path from "path";
import { del, put } from "@vercel/blob";
import { DIRECTORIO_PRACTICAS } from "./almacen";
import { EXTENSIONES_PRACTICA } from "./reglas-practica";
import { accesoDeLaNube, urlParaVer, videosEnLaNube } from "./videos";
import type { EntregaPractica, EntregaVista } from "./tipos";

// Archivos de las prácticas: lo que sube el alumno en una lección que pide
// práctica (un PDF, un Word, una hoja de cálculo, una presentación o una
// foto). Son chicos, así que pasan por el servidor: van a Vercel Blob cuando
// está conectado y, si no (en local), a DATA_DIR/practicas.

/** El tipo del archivo por su extensión, confirmado con sus primeros bytes; null si no se acepta. */
export function tipoDePractica(nombre: string, datos: Buffer): string | null {
  const extension = nombre.toLowerCase().split(".").pop() ?? "";
  const tipo = EXTENSIONES_PRACTICA[extension];
  if (!tipo) return null;
  const firma = datos.subarray(0, 4);
  const coincide =
    extension === "pdf"
      ? firma.toString("latin1") === "%PDF"
      : extension === "png"
        ? firma.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
        : extension === "jpg" || extension === "jpeg"
          ? datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff
          : // Word, Excel y PowerPoint son archivos ZIP por dentro.
            firma.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  return coincide ? tipo : null;
}

const nombreSeguro = (nombre: string) =>
  nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.-]+/g, "-")
    .slice(-60);

/** Guarda el archivo de una entrega y devuelve dónde quedó. */
export async function guardarArchivoPractica(
  entrega: number,
  nombre: string,
  tipo: string,
  datos: Buffer,
): Promise<{ ruta: string; url?: string }> {
  const base = `${entrega}-${nombreSeguro(nombre)}`;
  if (videosEnLaNube()) {
    const subido = await put(`practicas/${base}`, datos, {
      access: await accesoDeLaNube(),
      addRandomSuffix: true,
      contentType: tipo,
    });
    return { ruta: subido.pathname, url: subido.url };
  }
  await fs.mkdir(DIRECTORIO_PRACTICAS, { recursive: true });
  const ruta = `${Date.now().toString(36)}-${base}`;
  await fs.writeFile(path.join(DIRECTORIO_PRACTICAS, ruta), datos);
  return { ruta };
}

/** Borra el archivo de una entrega. Si falla, el registro ya no lo usa: solo se avisa. */
export async function borrarArchivoPractica(archivo: NonNullable<EntregaPractica["archivo"]>): Promise<void> {
  try {
    if (archivo.url) await del(archivo.url);
    else await fs.rm(path.join(DIRECTORIO_PRACTICAS, path.basename(archivo.ruta)), { force: true });
  } catch (e) {
    console.warn("No se pudo borrar el archivo de una práctica", e);
  }
}

/** La respuesta que entrega el archivo al navegador (ya con el permiso revisado). */
export async function responderArchivoPractica(archivo: NonNullable<EntregaPractica["archivo"]>): Promise<Response> {
  if (archivo.url) {
    const url = await urlParaVer({ archivo: archivo.ruta, url: archivo.url });
    return Response.redirect(url, 302);
  }
  const datos = await fs.readFile(path.join(DIRECTORIO_PRACTICAS, path.basename(archivo.ruta)));
  return new Response(new Uint8Array(datos), {
    headers: {
      "Content-Type": archivo.tipo,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(archivo.nombre)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

export function vistaDeEntrega(e: EntregaPractica): EntregaVista {
  return {
    id: e.id,
    leccion: e.leccion,
    autor: e.autor,
    texto: e.texto,
    ...(e.archivo
      ? { archivo: { nombre: e.archivo.nombre, tipo: e.archivo.tipo, bytes: e.archivo.bytes, url: `/api/practica/archivo/${e.id}` } }
      : {}),
    enviadaEn: e.enviadaEn,
    actualizadaEn: e.actualizadaEn,
  };
}
