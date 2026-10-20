import { modificar } from "@/lib/almacen";
import { COMUNIDAD_PRINCIPAL } from "@/lib/curso";
import { error, idNumerico, manejar } from "@/lib/http";
import { coachDe, exigirComunidad } from "@/lib/permisos";

export const dynamic = "force-dynamic";

// La coach modera las comunidades de su empresa: puede borrar cualquier
// publicación (con sus comentarios).
export const DELETE = manejar(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const coach = await coachDe(req);
  const id = idNumerico((await params).id);
  const borrada = await modificar((a) => {
    const p = a.publicaciones.find((x) => x.id === id);
    if (p) exigirComunidad(a, p.comunidad ?? COMUNIDAD_PRINCIPAL, coach);
    const antes = a.publicaciones.length;
    a.publicaciones = a.publicaciones.filter((p) => p.id !== id);
    return a.publicaciones.length < antes;
  });
  if (!borrada) return error("La publicación no existe.", 404);
  return Response.json({ id });
});
