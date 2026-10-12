import { modificar } from "@/lib/almacen";
import { cursoDeLeccion } from "@/lib/curso";
import { error, leerJson, manejar } from "@/lib/http";
import { generarPresentacion } from "@/lib/presentacion-ia";
import type { Presentacion } from "@/lib/tipos";

export const dynamic = "force-dynamic";
// Generar las diapositivas suele tardar de 10 a 30 segundos.
export const maxDuration = 60;

// Presentación con IA de una lección: diapositivas y narración (texto). La voz
// la pone el dispositivo de quien la ve, así que no se guarda ningún audio.
// Como el resto del MVP, el permiso de coach se simula con el encabezado X-Rol.

type Contexto = { params: Promise<{ leccion: string }> };

// Genera (o vuelve a generar) la presentación con el texto guardado de la lección.
export const POST = manejar(async (req: Request, contexto: Contexto) => {
  if (req.headers.get("x-rol") !== "coach") return error("Solo la coach puede generar presentaciones.", 403);
  const { leccion: id } = await contexto.params;
  const datos = await cursoDeLeccion(id, { borradores: true });
  const leccion = datos?.curso.modulos.flatMap((m) => m.lecciones).find((l) => l.id === id);
  if (!leccion) return error("No encontramos esa lección.", 404);

  const diapositivas = await generarPresentacion(leccion);
  // Recién generada lleva voz; después la coach decide si se queda o no.
  const presentacion: Presentacion = { leccion: id, diapositivas, creadaEn: new Date().toISOString(), conVoz: true };
  await modificar((a) => {
    a.presentaciones = [...(a.presentaciones ?? []).filter((p) => p.leccion !== id), presentacion];
  });
  return Response.json(presentacion, { status: 201 });
});

// La coach decide si la presentación lleva voz: { conVoz: boolean }.
export const PATCH = manejar(async (req: Request, contexto: Contexto) => {
  if (req.headers.get("x-rol") !== "coach") return error("Solo la coach puede cambiar la presentación.", 403);
  const { leccion: id } = await contexto.params;
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
  if (req.headers.get("x-rol") !== "coach") return error("Solo la coach puede quitar presentaciones.", 403);
  const { leccion: id } = await contexto.params;
  await modificar((a) => {
    a.presentaciones = (a.presentaciones ?? []).filter((p) => p.leccion !== id);
  });
  return new Response(null, { status: 204 });
});
