import { consultar } from "@/lib/almacen";
import { cargarCurso, idCurso } from "@/lib/curso";
import { cargarEvaluaciones, expedienteDe } from "@/lib/evaluaciones";
import { error, manejar } from "@/lib/http";

export const dynamic = "force-dynamic";

// Expediente de un alumno en un curso: avance por módulo, repaso, examen final y estado.
export const GET = manejar(async (req: Request) => {
  const parametros = new URL(req.url).searchParams;
  const autor = parametros.get("autor")?.trim();
  if (!autor) return error("Falta el nombre del alumno.");
  const id = idCurso(parametros.get("curso"));
  const [curso, ev] = await Promise.all([cargarCurso(id), cargarEvaluaciones(id)]);
  return Response.json(await consultar((a) => expedienteDe(a, curso, ev, autor)));
});
