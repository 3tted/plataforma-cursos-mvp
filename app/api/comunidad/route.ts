import { consultar } from "@/lib/almacen";
import { cargarCursos, idComunidad } from "@/lib/curso";
import { manejar } from "@/lib/http";
import { miembrosDeComunidad } from "@/lib/tendencias";
import type { ResumenComunidad } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// Miembros activos de una comunidad (?comunidad=id).
export const GET = manejar(async (req: Request) => {
  const comunidad = await idComunidad(new URL(req.url).searchParams.get("comunidad"));
  const cursos = new Set((await cargarCursos()).filter((c) => c.comunidad.id === comunidad).map((c) => c.curso.id));
  const resumen: ResumenComunidad = { miembros: await consultar((a) => miembrosDeComunidad(a, comunidad, cursos)) };
  return Response.json(resumen);
});
