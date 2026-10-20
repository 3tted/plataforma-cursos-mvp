import { modificar } from "@/lib/almacen";
import { COMUNIDAD_PRINCIPAL } from "@/lib/curso";
import { ErrorDeDatos, idNumerico, manejar } from "@/lib/http";
import { coachDe, exigirComunidad } from "@/lib/permisos";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string; comentario: string }> };

// La coach puede borrar cualquier comentario en las comunidades de su empresa.
export const DELETE = manejar(async (req: Request, { params }: Contexto) => {
  const coach = await coachDe(req);
  const { id, comentario } = await params;
  const idPublicacion = idNumerico(id);
  const idComentario = idNumerico(comentario);
  const publicacion = await modificar((a) => {
    const p = a.publicaciones.find((x) => x.id === idPublicacion);
    if (!p) throw new ErrorDeDatos("La publicación no existe.");
    exigirComunidad(a, p.comunidad ?? COMUNIDAD_PRINCIPAL, coach);
    const antes = p.comentarios.length;
    p.comentarios = p.comentarios.filter((c) => c.id !== idComentario);
    if (p.comentarios.length === antes) throw new ErrorDeDatos("El comentario no existe.");
    return p;
  });
  return Response.json(publicacion);
});
