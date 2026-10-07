import { modificar } from "@/lib/almacen";
import { ErrorDeDatos, error, idNumerico, manejar } from "@/lib/http";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string; comentario: string }> };

// La coach puede borrar cualquier comentario de su comunidad (permiso simulado con X-Rol).
export const DELETE = manejar(async (req: Request, { params }: Contexto) => {
  if (req.headers.get("x-rol") !== "coach") return error("Solo la coach puede borrar comentarios.", 403);
  const { id, comentario } = await params;
  const idPublicacion = idNumerico(id);
  const idComentario = idNumerico(comentario);
  const publicacion = await modificar((a) => {
    const p = a.publicaciones.find((x) => x.id === idPublicacion);
    if (!p) throw new ErrorDeDatos("La publicación no existe.");
    const antes = p.comentarios.length;
    p.comentarios = p.comentarios.filter((c) => c.id !== idComentario);
    if (p.comentarios.length === antes) throw new ErrorDeDatos("El comentario no existe.");
    return p;
  });
  return Response.json(publicacion);
});
