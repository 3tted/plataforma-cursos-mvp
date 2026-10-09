import { consultar, modificar } from "@/lib/almacen";
import { cargarCurso, idCurso } from "@/lib/curso";
import { cargarEvaluaciones, construirMatriz } from "@/lib/evaluaciones";
import { error, manejar } from "@/lib/http";

export const dynamic = "force-dynamic";

// Matriz de la coach para un curso (?curso=id): el expediente de cada alumno
// en ese curso y las preguntas que más se fallan.
export const GET = manejar(async (req: Request) => {
  const id = idCurso(new URL(req.url).searchParams.get("curso"));
  const [curso, ev] = await Promise.all([cargarCurso(id), cargarEvaluaciones(id)]);
  return Response.json(await consultar((a) => construirMatriz(a, curso, ev)));
});

// Quita a un alumno de la matriz: su avance, sus repasos y sus intentos de
// examen (sirve para limpiar alumnos de prueba). Como el resto del MVP, el
// permiso se simula con el encabezado X-Rol; en la Fase 2 lo valida la sesión.
export const DELETE = manejar(async (req: Request) => {
  if (req.headers.get("x-rol") !== "coach") return error("Solo la coach puede quitar alumnos.", 403);
  const autor = new URL(req.url).searchParams.get("autor");
  if (!autor) return error("Falta el nombre del alumno.");
  const borrados = await modificar((a) => {
    const antes = (a.progreso?.length ?? 0) + (a.repasos?.length ?? 0) + (a.examenes?.length ?? 0);
    a.progreso = (a.progreso ?? []).filter((p) => p.autor !== autor);
    a.repasos = (a.repasos ?? []).filter((r) => r.autor !== autor);
    a.examenes = (a.examenes ?? []).filter((x) => x.autor !== autor);
    return antes - (a.progreso.length + a.repasos.length + a.examenes.length);
  });
  if (borrados === 0) return error("No encontramos a ese alumno en la matriz.", 404);
  return Response.json({ borrados });
});
