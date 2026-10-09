import { consultar, modificar } from "@/lib/almacen";
import { cargarCurso, idCurso } from "@/lib/curso";
import { cargarEvaluaciones, construirMatriz } from "@/lib/evaluaciones";
import { error, manejar } from "@/lib/http";

export const dynamic = "force-dynamic";

// Matriz de la coach para un curso (?curso=id): el expediente de cada alumno
// en ese curso y las preguntas que más se fallan.
export const GET = manejar(async (req: Request) => {
  const id = await idCurso(new URL(req.url).searchParams.get("curso"));
  const [curso, ev] = await Promise.all([cargarCurso(id), cargarEvaluaciones(id)]);
  return Response.json(await consultar((a) => construirMatriz(a, curso, ev)));
});

// Quita a un alumno de la matriz: su avance, sus repasos, sus intentos de
// examen y sus inscripciones (sirve para limpiar alumnos de prueba). Con
// &todo=1 también borra lo que escribió o hizo en la plataforma: sus
// preguntas al asistente, sus pagos, sus publicaciones, sus comentarios y sus
// "Me sirve". Como el resto del MVP, el permiso se simula con el encabezado
// X-Rol; en la Fase 2 lo valida la sesión.
export const DELETE = manejar(async (req: Request) => {
  if (req.headers.get("x-rol") !== "coach") return error("Solo la coach puede quitar alumnos.", 403);
  const parametros = new URL(req.url).searchParams;
  const autor = parametros.get("autor");
  if (!autor) return error("Falta el nombre del alumno.");
  const todo = parametros.get("todo") === "1";
  const borrados = await modificar((a) => {
    const total = () =>
      (a.progreso?.length ?? 0) + (a.repasos?.length ?? 0) + (a.examenes?.length ?? 0) + (a.inscripciones?.length ?? 0);
    const antes = total();
    a.progreso = (a.progreso ?? []).filter((p) => p.autor !== autor);
    a.repasos = (a.repasos ?? []).filter((r) => r.autor !== autor);
    a.examenes = (a.examenes ?? []).filter((x) => x.autor !== autor);
    a.inscripciones = (a.inscripciones ?? []).filter((i) => i.autor !== autor);
    let otros = 0;
    if (todo) {
      const contar = <T,>(lista: T[], queda: (x: T) => boolean) => {
        const filtrada = lista.filter(queda);
        otros += lista.length - filtrada.length;
        return filtrada;
      };
      a.preguntas = contar(a.preguntas, (p) => p.autor !== autor);
      a.pagos = contar(a.pagos, (p) => p.autor !== autor);
      a.publicaciones = contar(a.publicaciones, (p) => p.autor !== autor).map((p) => ({
        ...p,
        comentarios: contar(p.comentarios, (c) => c.autor !== autor),
        reacciones: contar(p.reacciones, (r) => r !== autor),
      }));
    }
    return antes - total() + otros;
  });
  if (borrados === 0) return error("No encontramos a ese alumno en la matriz.", 404);
  return Response.json({ borrados });
});
