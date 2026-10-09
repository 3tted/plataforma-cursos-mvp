import { modificar } from "@/lib/almacen";
import { cursoDeLeccion } from "@/lib/curso";
import { calificar, cargarEvaluaciones } from "@/lib/evaluaciones";
import { error, leerJson, manejar, rol, texto } from "@/lib/http";
import type { ResultadoRepaso } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// Repaso de una lección: no cuenta para la calificación, pero se guarda para
// que la coach vea qué preguntas fallan más. Se devuelve la respuesta correcta
// y su explicación, porque el repaso es para aprender.
export const POST = manejar(async (req: Request) => {
  const datos = await leerJson(req);
  const autor = texto(datos.autor, "autor", 60);
  const leccion = texto(datos.leccion, "leccion", 10);
  // Los ids de lección no se repiten entre cursos: la lección dice de qué curso es.
  const curso = await cursoDeLeccion(leccion, { borradores: true });
  const preguntas = curso ? (await cargarEvaluaciones(curso.curso.id)).repaso[leccion] : undefined;
  if (!preguntas) return error("Esta lección no tiene repaso.", 404);

  const { detalle, aciertos, total, fallas } = calificar(preguntas, datos.respuestas);
  // Las respuestas de la coach (vista previa) no cuentan en las estadísticas.
  if (rol(datos.rol) === "alumno") {
    await modificar((a) => {
      (a.repasos ??= []).push({
        autor,
        leccion,
        aciertos,
        total,
        fallas: fallas.map((p) => p.id),
        creadoEn: new Date().toISOString(),
      });
    });
  }

  const resultado: ResultadoRepaso = {
    aciertos,
    total,
    detalle: detalle.map(({ pregunta, acierto }) => ({
      id: pregunta.id,
      acierto,
      correcta: pregunta.correcta,
      explicacion: pregunta.explicacion ?? "",
    })),
  };
  return Response.json(resultado);
});
