import { modificar } from "@/lib/almacen";
import { cursoDeLeccion } from "@/lib/curso";
import { error, leerJson, manejar } from "@/lib/http";
import { coachDeLaLeccion } from "@/lib/permisos";
import { diapositivasEditadas, generarPresentacion, opcionesDe } from "@/lib/presentacion-ia";
import type { Presentacion } from "@/lib/tipos";

export const dynamic = "force-dynamic";
// Generar las diapositivas suele tardar de 10 a 30 segundos.
export const maxDuration = 60;

// Presentación con IA de una lección: diapositivas y narración (texto). La voz
// la pone el dispositivo de quien la ve, así que no se guarda ningún audio.
// Solo una coach de la empresa dueña del curso la cambia.

type Contexto = { params: Promise<{ leccion: string }> };

// Genera (o vuelve a generar) la presentación con el texto guardado de la lección.
// El cuerpo (opcional) trae lo que pide la coach: { minutos, diapositivas, tono, indicaciones }.
export const POST = manejar(async (req: Request, contexto: Contexto) => {
  const { leccion: id } = await contexto.params;
  await coachDeLaLeccion(req, id);
  const datos = await cursoDeLeccion(id, { borradores: true });
  const leccion = datos?.curso.modulos.flatMap((m) => m.lecciones).find((l) => l.id === id);
  if (!leccion) return error("No encontramos esa lección.", 404);

  const opciones = opcionesDe(await req.json().catch(() => ({})));
  const diapositivas = await generarPresentacion(leccion, opciones);
  // Recién generada lleva voz; después la coach decide si se queda o no.
  const presentacion: Presentacion = {
    leccion: id,
    diapositivas,
    creadaEn: new Date().toISOString(),
    conVoz: true,
    ...(Object.keys(opciones).length ? { opciones } : {}),
  };
  await modificar((a) => {
    a.presentaciones = [...(a.presentaciones ?? []).filter((p) => p.leccion !== id), presentacion];
  });
  return Response.json(presentacion, { status: 201 });
});

// Guarda lo que la coach editó a mano: { diapositivas }. La voz y lo que pidió se quedan igual.
export const PUT = manejar(async (req: Request, contexto: Contexto) => {
  const { leccion: id } = await contexto.params;
  await coachDeLaLeccion(req, id);
  const diapositivas = diapositivasEditadas((await leerJson(req)).diapositivas);
  const editada = await modificar((a) => {
    const p = (a.presentaciones ?? []).find((x) => x.leccion === id);
    if (p) Object.assign(p, { diapositivas, editadaEn: new Date().toISOString() });
    return p ?? null;
  });
  if (!editada) return error("Esta lección no tiene presentación.", 404);
  return Response.json(editada);
});

// La coach decide si la presentación lleva voz: { conVoz: boolean }.
export const PATCH = manejar(async (req: Request, contexto: Contexto) => {
  const { leccion: id } = await contexto.params;
  await coachDeLaLeccion(req, id);
  const datos = await leerJson(req);
  if (typeof datos.conVoz !== "boolean") return error("Falta indicar si lleva voz.");
  const cambiada = await modificar((a) => {
    const p = (a.presentaciones ?? []).find((x) => x.leccion === id);
    if (p) p.conVoz = datos.conVoz as boolean;
    return p ?? null;
  });
  if (!cambiada) return error("Esta lección no tiene presentación.", 404);
  return Response.json(cambiada);
});

export const DELETE = manejar(async (req: Request, contexto: Contexto) => {
  const { leccion: id } = await contexto.params;
  await coachDeLaLeccion(req, id);
  await modificar((a) => {
    a.presentaciones = (a.presentaciones ?? []).filter((p) => p.leccion !== id);
  });
  return new Response(null, { status: 204 });
});
