import { idCurso } from "@/lib/curso";
import { cargarEvaluaciones, evaluacionesPublicas } from "@/lib/evaluaciones";
import { manejar } from "@/lib/http";

export const dynamic = "force-dynamic";

// Preguntas del repaso y del examen final de un curso, sin las respuestas correctas.
export const GET = manejar(async (req: Request) =>
  Response.json(evaluacionesPublicas(await cargarEvaluaciones(await idCurso(new URL(req.url).searchParams.get("curso"), { borradores: true })))),
);
