import { createReadStream, promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";
import { head } from "@vercel/blob";
import { DIRECTORIO_VIDEOS, consultar, modificar, rutaDelVideo } from "@/lib/almacen";
import { cursoDeLeccion } from "@/lib/curso";
import { coachDeLaLeccion } from "@/lib/permisos";
import { error, leerJson, manejar } from "@/lib/http";
import { MAX_BYTES_VIDEO, TIPOS_VIDEO, tamañoLegible } from "@/lib/reglas-video";
import type { VideoLeccion } from "@/lib/tipos";
import { borrarArchivoDeVideo, esUrlDeBlob, rutaEnLaNube, urlParaVer, videosEnLaNube } from "@/lib/videos";

export const dynamic = "force-dynamic";

// Videos de lección. Con Vercel Blob conectado, el navegador los sube directo
// a Blob (ver ./subir) y aquí solo se anotan; el reproductor va a su url. Sin
// Blob (en local), llegan aquí y se guardan como archivos en DATA_DIR/videos
// (la carpeta .data/videos).
//
// Subirlo o quitarlo es solo para las coaches de la empresa dueña del curso.

type Contexto = { params: Promise<{ leccion: string }> };

async function leccionExistente(contexto: Contexto): Promise<string | null> {
  const { leccion } = await contexto.params;
  return (await cursoDeLeccion(leccion, { borradores: true })) ? leccion : null;
}

async function videoDe(leccion: string): Promise<VideoLeccion | undefined> {
  return consultar((a) => (a.videos ?? []).find((v) => v.leccion === leccion));
}

// MP4 y MOV traen "ftyp" en los bytes 4 a 8; WebM empieza con la firma EBML.
function pareceVideo(cabecera: Buffer): boolean {
  const ftyp = cabecera.subarray(4, 8).toString("latin1") === "ftyp";
  const ebml = cabecera.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  return ftyp || ebml;
}

// ---------------------------------------------------------------- GET
// Responde por rangos (206) para que el reproductor pueda adelantar y
// empezar a reproducir sin descargar el archivo completo.
export const GET = manejar(async (req: Request, contexto: Contexto) => {
  const leccion = await leccionExistente(contexto);
  const video = leccion ? await videoDe(leccion) : undefined;
  if (!video) return error("Esta lección no tiene video.", 404);
  // En Vercel Blob: el reproductor sigue a su url (Blob también responde por rangos).
  if (video.url) return Response.redirect(await urlParaVer({ ...video, url: video.url }), 302);

  const ruta = await rutaDelVideo(video);
  const { size } = await fs.stat(ruta).catch(() => ({ size: -1 }));
  if (size < 0) return error("No encontramos el archivo del video.", 404);

  const comunes = {
    "Content-Type": video.tipo,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };
  const rango = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (!rango || (!rango[1] && !rango[2])) {
    const flujo = Readable.toWeb(createReadStream(ruta)) as unknown as ReadableStream<Uint8Array>;
    return new Response(flujo, { headers: { ...comunes, "Content-Length": String(size) } });
  }

  let inicio = rango[1] ? Number(rango[1]) : size - Number(rango[2]);
  let fin = rango[1] && rango[2] ? Number(rango[2]) : size - 1;
  inicio = Math.max(0, inicio);
  fin = Math.min(fin, size - 1);
  if (inicio > fin || inicio >= size) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  const flujo = Readable.toWeb(createReadStream(ruta, { start: inicio, end: fin })) as unknown as ReadableStream<Uint8Array>;
  return new Response(flujo, {
    status: 206,
    headers: {
      ...comunes,
      "Content-Length": String(fin - inicio + 1),
      "Content-Range": `bytes ${inicio}-${fin}/${size}`,
    },
  });
});

// ---------------------------------------------------------------- PUT
// El archivo llega tal cual en el cuerpo (no como formulario) y se escribe al
// disco mientras llega, sin cargarlo completo en memoria.
export const PUT = manejar(async (req: Request, contexto: Contexto) => {
  const leccion = await leccionExistente(contexto);
  if (!leccion) return error("No encontramos esa lección.", 404);
  await coachDeLaLeccion(req, leccion);

  // Ya subido a Vercel Blob desde el navegador: solo se anota ({ url, nombre }).
  if ((req.headers.get("content-type") ?? "").startsWith("application/json")) return anotarDeBlob(req, leccion);

  const tipo = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  const extension = TIPOS_VIDEO[tipo];
  if (!extension) return error("Sube el video en MP4, WebM o MOV.", 415);
  const declarado = Number(req.headers.get("content-length") ?? 0);
  if (declarado > MAX_BYTES_VIDEO) {
    return error(`El video pesa más de ${tamañoLegible(MAX_BYTES_VIDEO)}. Expórtalo en menor calidad o recórtalo.`, 413);
  }
  if (!req.body) return error("No llegó ningún archivo.");

  let nombreOriginal = "video";
  try {
    nombreOriginal = decodeURIComponent(req.headers.get("x-nombre-archivo") ?? "video").slice(0, 120);
  } catch {
    // nombre con codificación rota: se queda el genérico
  }

  await fs.mkdir(DIRECTORIO_VIDEOS, { recursive: true });
  const marca = Date.now();
  const temporal = path.join(DIRECTORIO_VIDEOS, `.${leccion}-${marca}.subiendo`);
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
    if ((e as Error).message === "demasiado-grande") {
      return error(`El video pesa más de ${tamañoLegible(MAX_BYTES_VIDEO)}. Expórtalo en menor calidad o recórtalo.`, 413);
    }
    return error("La subida se interrumpió. Revisa tu conexión e inténtalo de nuevo.", 400);
  }
  await archivo.close();

  if (bytes === 0 || !pareceVideo(cabecera)) {
    await fs.rm(temporal, { force: true });
    return error("El archivo no parece un video MP4, WebM o MOV.", 415);
  }

  const final = `${leccion}-${marca}.${extension}`;
  await fs.rename(temporal, path.join(DIRECTORIO_VIDEOS, final));
  const nuevo: VideoLeccion = {
    leccion,
    archivo: final,
    tipo,
    bytes,
    nombreOriginal,
    subidoEn: new Date(marca).toISOString(),
  };
  const anterior = await modificar((a) => {
    const lista = a.videos ?? [];
    const previo = lista.find((v) => v.leccion === leccion);
    a.videos = [...lista.filter((v) => v.leccion !== leccion), nuevo];
    return previo;
  });
  // El video reemplazado ya no se usa: se borra.
  if (anterior) await borrarArchivoDeVideo(anterior);
  return Response.json(nuevo, { status: 201 });
});

/** Anota un video que el navegador ya subió a Vercel Blob, revisando en Blob que sea de esta lección y sea video. */
async function anotarDeBlob(req: Request, leccion: string): Promise<Response> {
  if (!videosEnLaNube()) return error("Este servidor no tiene Vercel Blob conectado.");
  const datos = await leerJson(req);
  if (!esUrlDeBlob(datos.url)) return error("Esa dirección no es de un video subido a la plataforma.");
  const info = await head(datos.url).catch(() => null);
  if (!info) return error("No encontramos el video subido. Inténtalo de nuevo.", 404);
  if (!info.pathname.startsWith(`${rutaEnLaNube(leccion)}.`)) return error("Ese video no es de esta lección.", 403);
  const tipo = info.contentType.split(";")[0].trim();
  if (!TIPOS_VIDEO[tipo]) return error("Sube el video en MP4, WebM o MOV.", 415);
  if (info.size > MAX_BYTES_VIDEO) return error(`El video pesa más de ${tamañoLegible(MAX_BYTES_VIDEO)}.`, 413);
  const nombre = typeof datos.nombre === "string" && datos.nombre.trim() ? datos.nombre.trim().slice(0, 120) : "video";
  const nuevo: VideoLeccion = {
    leccion,
    archivo: info.pathname,
    url: info.url,
    tipo,
    bytes: info.size,
    nombreOriginal: nombre,
    subidoEn: new Date().toISOString(),
  };
  const anterior = await modificar((a) => {
    const lista = a.videos ?? [];
    const previo = lista.find((v) => v.leccion === leccion);
    a.videos = [...lista.filter((v) => v.leccion !== leccion), nuevo];
    return previo;
  });
  if (anterior && anterior.url !== nuevo.url) await borrarArchivoDeVideo(anterior);
  return Response.json(nuevo, { status: 201 });
}

// ---------------------------------------------------------------- DELETE
export const DELETE = manejar(async (req: Request, contexto: Contexto) => {
  const leccion = await leccionExistente(contexto);
  if (!leccion) return error("No encontramos esa lección.", 404);
  await coachDeLaLeccion(req, leccion);
  const quitado = await modificar((a) => {
    const lista = a.videos ?? [];
    a.videos = lista.filter((v) => v.leccion !== leccion);
    return lista.find((v) => v.leccion === leccion);
  });
  if (quitado) await borrarArchivoDeVideo(quitado);
  return new Response(null, { status: 204 });
});
