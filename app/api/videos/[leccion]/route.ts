import { createReadStream, promises as fs } from "fs";
import { Readable } from "stream";
import { consultar, modificar, rutaDelVideo } from "@/lib/almacen";
import { cursoDeLeccion } from "@/lib/curso";
import { coachDeLaLeccion } from "@/lib/permisos";
import { error, leerJson, manejar } from "@/lib/http";
import type { VideoLeccion } from "@/lib/tipos";
import { borrarArchivoDeVideo, recibirVideo, rutaEnLaNube, urlParaVer, videoDeLeccion } from "@/lib/videos";

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
// Sin Blob, el archivo llega tal cual en el cuerpo y se escribe al disco; con
// Blob, el navegador ya lo subió y aquí solo se anota (ver lib/videos.ts).
export const PUT = manejar(async (req: Request, contexto: Contexto) => {
  const leccion = await leccionExistente(contexto);
  if (!leccion) return error("No encontramos esa lección.", 404);
  await coachDeLaLeccion(req, leccion);
  const recibido = await recibirVideo(req, leccion, rutaEnLaNube(leccion));
  if (recibido instanceof Response) return recibido;
  const nuevo = videoDeLeccion(leccion, recibido);
  const anterior = await modificar((a) => {
    const lista = a.videos ?? [];
    const previo = lista.find((v) => v.leccion === leccion);
    a.videos = [...lista.filter((v) => v.leccion !== leccion), nuevo];
    return previo;
  });
  // El video reemplazado ya no se usa: se borra (si otra lección no comparte el archivo).
  if (anterior) await borrarArchivoDeVideo(anterior);
  return Response.json(nuevo, { status: 201 });
});

// ---------------------------------------------------------------- PATCH
// Ajusta el tramo del video que es de esta lección ({ inicio, fin } en segundos).
export const PATCH = manejar(async (req: Request, contexto: Contexto) => {
  const leccion = await leccionExistente(contexto);
  if (!leccion) return error("No encontramos esa lección.", 404);
  await coachDeLaLeccion(req, leccion);
  const datos = await leerJson(req);
  const inicio = Number(datos.inicio);
  const fin = Number(datos.fin);
  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || inicio < 0 || fin > 24 * 3600) {
    return error("Escribe el inicio y el fin como minutos y segundos, por ejemplo 6:10.");
  }
  if (fin - inicio < 5) return error("El fin tiene que quedar al menos 5 segundos después del inicio.");
  const video = await modificar((a) => {
    const v = (a.videos ?? []).find((x) => x.leccion === leccion);
    if (v) Object.assign(v, { inicio: Math.round(inicio), fin: Math.round(fin) });
    return v;
  });
  if (!video) return error("Esta lección no tiene video.", 404);
  return Response.json(video);
});

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
