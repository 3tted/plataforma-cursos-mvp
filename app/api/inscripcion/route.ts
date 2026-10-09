import { consultar, modificar, type Almacen } from "@/lib/almacen";
import { COMUNIDAD_PRINCIPAL, cargarCursos, idComunidad, idCurso } from "@/lib/curso";
import { completadasDe, examenesDelCurso, leccionesDelCurso } from "@/lib/evaluaciones";
import { error, leerJson, manejar, texto } from "@/lib/http";
import type { DatosCurso, EstadoInscripcion } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// Inscripción del alumno en dos pasos: primero se une a una comunidad (gratis)
// y después se inscribe a los cursos que quiera de ella. La membresía de pago
// es aparte y es de cada comunidad. Como el resto del MVP, el alumno se
// identifica por nombre; en la Fase 2 sale de la sesión.

// Quien ya avanzó, publicó o pagó antes de que existiera la inscripción
// cuenta como inscrito: nadie pierde lo que ya tenía.
function estadoDe(a: Almacen, cursos: DatosCurso[], autor: string): EstadoInscripcion {
  const propia = a.inscripciones?.find((i) => i.autor === autor);
  const completadas = completadasDe(a, autor);
  const conAvance = cursos.filter((c) => {
    const ids = new Set(leccionesDelCurso(c).flatMap((m) => m.lecciones.map((l) => l.id)));
    return (
      completadas.some((id) => ids.has(id)) ||
      (a.repasos ?? []).some((r) => r.autor === autor && ids.has(r.leccion)) ||
      examenesDelCurso(a, c.curso.id).some((x) => x.autor === autor)
    );
  });
  const cursosInscritos = [...new Set([...(propia?.cursos ?? []), ...conAvance.map((c) => c.curso.id)])];

  const comunidades = new Set<string>(propia?.comunidades ?? (propia?.comunidad ? [COMUNIDAD_PRINCIPAL] : []));
  for (const c of cursos) if (cursosInscritos.includes(c.curso.id)) comunidades.add(c.comunidad.id);
  for (const p of a.pagos) if (p.autor === autor) comunidades.add(p.comunidad ?? COMUNIDAD_PRINCIPAL);
  for (const p of a.publicaciones) {
    if ((p.autor === autor && p.rol === "alumno") || p.comentarios.some((c) => c.autor === autor)) {
      comunidades.add(p.comunidad ?? COMUNIDAD_PRINCIPAL);
    }
  }
  return { comunidades: [...comunidades], cursos: cursosInscritos };
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
  const cursos = await cargarCursos();
  const idPedido = accion === "curso" ? await idCurso(datos.curso) : null;
  const curso = idPedido ? cursos.find((c) => c.curso.id === idPedido)! : null;
  const comunidad = curso ? curso.comunidad.id : await idComunidad(datos.comunidad);

  const resultado = await modificar((a): EstadoInscripcion | { mensaje: string } => {
    const actual = estadoDe(a, cursos, autor);
    if (curso && !actual.comunidades.includes(comunidad)) {
      return { mensaje: "Primero únete a la comunidad para inscribirte a sus cursos." };
    }
    a.inscripciones ??= [];
    let propia = a.inscripciones.find((i) => i.autor === autor);
    if (!propia) {
      propia = { autor, comunidades: [], cursos: [], desde: new Date().toISOString() };
      a.inscripciones.push(propia);
    }
    // Las inscripciones de antes guardaban comunidad: true (la principal).
    propia.comunidades = [...new Set([...(propia.comunidades ?? (propia.comunidad ? [COMUNIDAD_PRINCIPAL] : [])), comunidad])];
    delete propia.comunidad;
    if (curso && !propia.cursos.includes(curso.curso.id)) propia.cursos.push(curso.curso.id);
    return estadoDe(a, cursos, autor);
  });
  if ("mensaje" in resultado) return error(resultado.mensaje, 409);
  return Response.json(resultado);
});
