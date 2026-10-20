import { consultar } from "@/lib/almacen";
import { cursoDeLeccion } from "@/lib/curso";
import { error, leerJson, manejar } from "@/lib/http";
import { coachDeLaLeccion } from "@/lib/permisos";
import { rehacerDiapositiva } from "@/lib/presentacion-ia";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Contexto = { params: Promise<{ leccion: string }> };

// Rehace una diapositiva con la IA desde el editor de la presentación:
// { diapositivas, indice, indicacion }. Devuelve { diapositiva } sin guardarla;
// la coach la revisa y guarda todo junto.
export const POST = manejar(async (req: Request, contexto: Contexto) => {
  const { leccion: id } = await contexto.params;
  await coachDeLaLeccion(req, id);
  const datos = await leerJson(req);
  const curso = await cursoDeLeccion(id, { borradores: true });
  const leccion = curso?.curso.modulos.flatMap((m) => m.lecciones).find((l) => l.id === id);
  if (!leccion) return error("No encontramos esa lección.", 404);
  if (!Array.isArray(datos.diapositivas)) return error("Faltan las diapositivas.");
  const indice = Number(datos.indice);
  if (!Number.isInteger(indice)) return error("Falta cuál diapositiva rehacer.");
  // Con lo mismo que se pidió al generarla (tono, largo e indicaciones).
  const opciones = await consultar((a) => (a.presentaciones ?? []).find((p) => p.leccion === id)?.opciones);
  const diapositiva = await rehacerDiapositiva(
    leccion,
    datos.diapositivas,
    indice,
    typeof datos.indicacion === "string" ? datos.indicacion : "",
    opciones ?? {},
  );
  return Response.json({ diapositiva });
});
