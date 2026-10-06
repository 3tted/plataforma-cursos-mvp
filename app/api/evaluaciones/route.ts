import { cargarEvaluaciones, evaluacionesPublicas } from "@/lib/evaluaciones";
import { manejar } from "@/lib/http";

export const dynamic = "force-dynamic";

// Preguntas del repaso y del examen final, sin las respuestas correctas.
export const GET = manejar(async () => Response.json(evaluacionesPublicas(await cargarEvaluaciones())));
