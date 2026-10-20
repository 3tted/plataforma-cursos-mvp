import { consultar } from "@/lib/almacen";
import { COMUNIDAD_PRINCIPAL, CURSO_PRINCIPAL, cargarCursos } from "@/lib/curso";
import { manejar } from "@/lib/http";
import { cuentaDeReq } from "@/lib/permisos";

export const dynamic = "force-dynamic";

// Lo que una persona ha aportado en la plataforma: publicaciones, comentarios
// y preguntas al asistente. En el MVP no hay cuentas, así que se busca por el
// nombre con el que firma; en la Fase 2 se busca por el id del usuario.
export const GET = manejar(async (req: Request) => {
  const autor = (await cuentaDeReq(req)).nombre;

  // Cada aporte dice de qué comunidad es, para filtrarlos en el perfil.
  const comunidadDeCurso = new Map((await cargarCursos()).map((c) => [c.curso.id, c.comunidad.id]));
  const perfil = await consultar((a) => ({
    publicaciones: a.publicaciones
      .filter((p) => p.autor === autor)
      .map((p) => ({
        id: p.id,
        comunidad: p.comunidad ?? COMUNIDAD_PRINCIPAL,
        titulo: p.titulo,
        categoria: p.categoria,
        creadaEn: p.creadaEn,
      })),
    comentarios: a.publicaciones.flatMap((p) =>
      p.comentarios
        .filter((c) => c.autor === autor)
        .map((c) => ({
          id: c.id,
          comunidad: p.comunidad ?? COMUNIDAD_PRINCIPAL,
          publicacion: p.titulo,
          cuerpo: c.cuerpo,
          creadoEn: c.creadoEn,
        })),
    ),
    preguntas: a.preguntas
      .filter((q) => q.autor === autor)
      .map((q) => ({
        id: q.id,
        comunidad: comunidadDeCurso.get(q.curso ?? CURSO_PRINCIPAL) ?? COMUNIDAD_PRINCIPAL,
        pregunta: q.pregunta,
        creadaEn: q.creadaEn,
      })),
  }));
  return Response.json(perfil);
});
