import { modificar } from "@/lib/almacen";
import { error, idNumerico, manejar } from "@/lib/http";

export const dynamic = "force-dynamic";

// La coach modera su comunidad: puede borrar cualquier publicación (con sus
// comentarios). Como el resto del MVP, el permiso se simula con el
// encabezado X-Rol; en la Fase 2 lo valida la sesión.
export const DELETE = manejar(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  if (req.headers.get("x-rol") !== "coach") return error("Solo la coach puede borrar publicaciones.", 403);
  const id = idNumerico((await params).id);
  const borrada = await modificar((a) => {
    const antes = a.publicaciones.length;
    a.publicaciones = a.publicaciones.filter((p) => p.id !== id);
    return a.publicaciones.length < antes;
  });
  if (!borrada) return error("La publicación no existe.", 404);
  return Response.json({ id });
});
