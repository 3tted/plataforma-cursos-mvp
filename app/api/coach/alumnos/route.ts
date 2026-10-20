import { consultar, modificar } from "@/lib/almacen";
import { COMUNIDAD_PRINCIPAL, CURSO_PRINCIPAL, cargarCursos } from "@/lib/curso";
import { cargarEvaluaciones, construirMatriz, leccionesDelCurso } from "@/lib/evaluaciones";
import { error, manejar } from "@/lib/http";
import { coachDe, coachDelCurso, empresaDeDatos } from "@/lib/permisos";

export const dynamic = "force-dynamic";

// Matriz de la coach para un curso (?curso=id): el expediente de cada alumno
// en ese curso y las preguntas que más se fallan.
export const GET = manejar(async (req: Request) => {
  const { datos: curso } = await coachDelCurso(req, new URL(req.url).searchParams.get("curso"));
  const id = curso.curso.id;
  const ev = await cargarEvaluaciones(id);
  return Response.json(await consultar((a) => construirMatriz(a, curso, ev)));
});

// Quita a un alumno de los cursos de la empresa de la coach: su avance en
// ellos, sus repasos, sus intentos de examen y sus inscripciones (sirve para
// limpiar alumnos de prueba). Con &todo=1 también borra lo que escribió o hizo
// en las comunidades de la empresa: sus preguntas al asistente, sus pagos, sus
// publicaciones, sus comentarios y sus "Me sirve". Lo que tenga en otras
// empresas no se toca.
export const DELETE = manejar(async (req: Request) => {
  const coach = await coachDe(req);
  const parametros = new URL(req.url).searchParams;
  const autor = parametros.get("autor");
  if (!autor) return error("Falta el nombre del alumno.");
  const todo = parametros.get("todo") === "1";
  const suyos = (await cargarCursos({ borradores: true })).filter((d) => empresaDeDatos(d) === coach.empresa);
  const cursos = new Set(suyos.map((d) => d.curso.id));
  const comunidades = new Set(suyos.map((d) => d.comunidad.id));
  const lecciones = new Set(suyos.flatMap((d) => leccionesDelCurso(d).flatMap((m) => m.lecciones.map((l) => l.id))));
  const deCurso = (curso: string | undefined) => cursos.has(curso ?? CURSO_PRINCIPAL);
  const deComunidad = (comunidad: string | undefined) => comunidades.has(comunidad ?? COMUNIDAD_PRINCIPAL);

  const borrados = await modificar((a) => {
    let total = 0;
    const contar = <T,>(lista: T[], queda: (x: T) => boolean) => {
      const filtrada = lista.filter(queda);
      total += lista.length - filtrada.length;
      return filtrada;
    };
    for (const p of a.progreso ?? []) {
      if (p.autor !== autor) continue;
      p.completadas = contar(p.completadas, (l) => !lecciones.has(l));
    }
    a.repasos = contar(a.repasos ?? [], (r) => r.autor !== autor || !lecciones.has(r.leccion));
    a.examenes = contar(a.examenes ?? [], (x) => x.autor !== autor || !deCurso(x.curso));
    for (const i of a.inscripciones ?? []) {
      if (i.autor !== autor) continue;
      i.cursos = contar(i.cursos, (c) => !cursos.has(c));
      if (i.comunidades) i.comunidades = contar(i.comunidades, (c) => !comunidades.has(c));
      if (i.comunidad && comunidades.has(COMUNIDAD_PRINCIPAL)) {
        delete i.comunidad;
        total++;
      }
    }
    if (todo) {
      a.preguntas = contar(a.preguntas, (q) => q.autor !== autor || !deCurso(q.curso));
      a.pagos = contar(a.pagos, (p) => p.autor !== autor || !deComunidad(p.comunidad));
      a.publicaciones = contar(a.publicaciones, (p) => p.autor !== autor || !deComunidad(p.comunidad)).map((p) =>
        deComunidad(p.comunidad)
          ? {
              ...p,
              comentarios: contar(p.comentarios, (c) => c.autor !== autor),
              reacciones: contar(p.reacciones, (r) => r !== autor),
            }
          : p,
      );
    }
    return total;
  });
  if (borrados === 0) return error("No encontramos a ese alumno en tus cursos.", 404);
  return Response.json({ borrados });
});
