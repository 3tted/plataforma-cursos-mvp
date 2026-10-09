import { modificar, nuevoId } from "@/lib/almacen";
import { cargarCurso, idCurso } from "@/lib/curso";
import { calificar, cargarEvaluaciones, completadasDe, examenesDelCurso, leccionesDelCurso } from "@/lib/evaluaciones";
import { error, leerJson, manejar, rol, texto } from "@/lib/http";
import type { ResultadoExamen } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// Examen final de un curso: se presenta al completar todas las lecciones, se
// aprueba con el porcentaje de data/evaluaciones.json y tiene intentos
// limitados. No revela las respuestas correctas, solo qué lecciones repasar.
export const POST = manejar(async (req: Request) => {
  const datos = await leerJson(req);
  const autor = texto(datos.autor, "autor", 60);
  const vistaPrevia = rol(datos.rol) === "coach";
  const id = await idCurso(datos.curso, { borradores: true });
  const [ev, curso] = await Promise.all([cargarEvaluaciones(id), cargarCurso(id)]);

  const { aciertos, total, fallas } = calificar(ev.examenFinal.preguntas, datos.respuestas);
  const puntaje = Math.round((aciertos / total) * 100);
  const aprobado = puntaje >= ev.aprobarCon;
  const resultado: ResultadoExamen = {
    aciertos,
    total,
    puntaje,
    aprobado,
    repasar: [...new Set(fallas.map((p) => p.leccion).filter((l): l is string => Boolean(l)))],
    intentosUsados: 0,
    intentosMaximos: ev.intentosExamen,
    vistaPrevia,
  };
  // La coach puede presentarlo para revisarlo: su intento no se guarda.
  if (vistaPrevia) return Response.json(resultado);

  const ids = leccionesDelCurso(curso).flatMap((m) => m.lecciones.map((l) => l.id));
  // Las reglas se revisan dentro de la misma escritura que guarda el intento,
  // para que dos envíos seguidos no se salten el límite.
  const guardado = await modificar((a): { status: number; mensaje: string } | { intentosUsados: number } => {
    a.examenes ??= [];
    const propios = examenesDelCurso(a, id).filter((x) => x.autor === autor);
    const completadas = completadasDe(a, autor);
    if (ids.some((id) => !completadas.includes(id))) {
      return { status: 403, mensaje: "Completa todas las lecciones del curso para presentar el examen final." };
    }
    if (propios.some((x) => x.aprobado)) return { status: 409, mensaje: "Ya aprobaste este examen." };
    if (propios.length >= ev.intentosExamen) {
      return { status: 409, mensaje: "Ya usaste todos tus intentos. Habla con tu coach para repasar los temas." };
    }
    a.examenes.push({
      id: nuevoId(a),
      autor,
      curso: id,
      aciertos,
      total,
      puntaje,
      aprobado,
      fallas: fallas.map((p) => p.id),
      creadoEn: new Date().toISOString(),
    });
    return { intentosUsados: propios.length + 1 };
  });
  if ("mensaje" in guardado) return error(guardado.mensaje, guardado.status);

  return Response.json({ ...resultado, intentosUsados: guardado.intentosUsados });
});
