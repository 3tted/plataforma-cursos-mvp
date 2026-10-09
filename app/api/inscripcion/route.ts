import { consultar, modificar, type Almacen } from "@/lib/almacen";
import { cargarCursos, idCurso } from "@/lib/curso";
import { completadasDe, examenesDelCurso, leccionesDelCurso } from "@/lib/evaluaciones";
import { error, leerJson, manejar, texto } from "@/lib/http";
import type { DatosCurso, EstadoInscripcion } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// Inscripción del alumno en dos pasos: primero se une a la comunidad (gratis)
// y después se inscribe a los cursos que quiera. La membresía de pago es
// aparte: abre los módulos de pago. Como el resto del MVP, el alumno se
// identifica por nombre; en la Fase 2 sale de la sesión.

// Quien ya avanzó, publicó o pagó antes de que existiera la inscripción
// cuenta como inscrito: nadie pierde lo que ya tenía.
function estadoDe(a: Almacen, cursos: DatosCurso[], autor: string): EstadoInscripcion {
  const propia = a.inscripciones?.find((i) => i.autor === autor);
  const completadas = completadasDe(a, autor);
  const conAvance = cursos
    .filter((c) => {
      const ids = new Set(leccionesDelCurso(c).flatMap((m) => m.lecciones.map((l) => l.id)));
      return (
        completadas.some((id) => ids.has(id)) ||
        (a.repasos ?? []).some((r) => r.autor === autor && ids.has(r.leccion)) ||
        examenesDelCurso(a, c.curso.id).some((x) => x.autor === autor)
      );
    })
    .map((c) => c.curso.id);
  const cursosInscritos = [...new Set([...(propia?.cursos ?? []), ...conAvance])];
  const participa =
    a.pagos.some((p) => p.autor === autor) ||
    a.publicaciones.some((p) => (p.autor === autor && p.rol === "alumno") || p.comentarios.some((c) => c.autor === autor));
  return { comunidad: Boolean(propia?.comunidad) || participa || cursosInscritos.length > 0, cursos: cursosInscritos };
}

export const GET = manejar(async (req: Request) => {
  const autor = new URL(req.url).searchParams.get("autor")?.trim();
  if (!autor) return error("Falta el nombre del alumno.");
  const cursos = await cargarCursos();
  return Response.json(await consultar((a) => estadoDe(a, cursos, autor)));
});

export const POST = manejar(async (req: Request) => {
  const datos = await leerJson(req);
  const autor = texto(datos.autor, "autor", 60);
  const accion = datos.accion;
  if (accion !== "comunidad" && accion !== "curso") return error('La acción debe ser "comunidad" o "curso".');
  const curso = accion === "curso" ? idCurso(datos.curso) : null;
  const cursos = await cargarCursos();

  const resultado = await modificar((a): EstadoInscripcion | { mensaje: string } => {
    const actual = estadoDe(a, cursos, autor);
    if (curso && !actual.comunidad) return { mensaje: "Primero únete a la comunidad para inscribirte a sus cursos." };
    a.inscripciones ??= [];
    let propia = a.inscripciones.find((i) => i.autor === autor);
    if (!propia) {
      propia = { autor, comunidad: false, cursos: [], desde: new Date().toISOString() };
      a.inscripciones.push(propia);
    }
    propia.comunidad = true;
    if (curso && !propia.cursos.includes(curso)) propia.cursos.push(curso);
    return estadoDe(a, cursos, autor);
  });
  if ("mensaje" in resultado) return error(resultado.mensaje, 409);
  return Response.json(resultado);
});
