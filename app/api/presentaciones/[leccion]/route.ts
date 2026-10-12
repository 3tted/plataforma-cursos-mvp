import { modificar } from "@/lib/almacen";
import { cursoDeLeccion } from "@/lib/curso";
import { error, manejar } from "@/lib/http";
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
  const presentacion: Presentacion = { leccion: id, diapositivas, creadaEn: new Date().toISOString() };
  await modificar((a) => {
    a.presentaciones = [...(a.presentaciones ?? []).filter((p) => p.leccion !== id), presentacion];
  });
  return Response.json(presentacion, { status: 201 });
});

export const DELETE = manejar(async (req: Request, contexto: Contexto) => {
  if (req.headers.get("x-rol") !== "coach") return error("Solo la coach puede quitar presentaciones.", 403);
  const { leccion: id } = await contexto.params;
  await modificar((a) => {
    a.presentaciones = (a.presentaciones ?? []).filter((p) => p.leccion !== id);
  });
  return new Response(null, { status: 204 });
});
