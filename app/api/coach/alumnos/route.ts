import { consultar } from "@/lib/almacen";
import { cargarCurso } from "@/lib/curso";
import { cargarEvaluaciones, construirMatriz } from "@/lib/evaluaciones";
import { manejar } from "@/lib/http";

export const dynamic = "force-dynamic";

// Matriz de la coach: el expediente de cada alumno y las preguntas que más se fallan.
export const GET = manejar(async () => {
  const [curso, ev] = await Promise.all([cargarCurso(), cargarEvaluaciones()]);
  return Response.json(await consultar((a) => construirMatriz(a, curso, ev)));
});
