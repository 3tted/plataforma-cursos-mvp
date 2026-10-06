import { consultar } from "@/lib/almacen";
import { cargarCurso } from "@/lib/curso";
import { cargarEvaluaciones, expedienteDe } from "@/lib/evaluaciones";
import { error, manejar } from "@/lib/http";

export const dynamic = "force-dynamic";

// Expediente de un alumno: avance por módulo, repaso, examen final y estado.
export const GET = manejar(async (req: Request) => {
  const autor = new URL(req.url).searchParams.get("autor")?.trim();
  if (!autor) return error("Falta el nombre del alumno.");
  const [curso, ev] = await Promise.all([cargarCurso(), cargarEvaluaciones()]);
  return Response.json(await consultar((a) => expedienteDe(a, curso, ev, autor)));
});
