import { consultar, modificar } from "@/lib/almacen";
import { CURSO_PRINCIPAL } from "@/lib/curso";
import { error, idNumerico, manejar } from "@/lib/http";
import { coachDelCurso } from "@/lib/permisos";

// Quita una lección pegada por la coach (de un curso de su empresa).
export const DELETE = manejar(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = idNumerico((await params).id);
  const leccion = await consultar((a) => a.leccionesCoach.find((l) => l.id === id));
  if (!leccion) return error("No encontramos esa lección.", 404);
  await coachDelCurso(req, leccion.curso ?? CURSO_PRINCIPAL);
  await modificar((a) => {
    a.leccionesCoach = a.leccionesCoach.filter((l) => l.id !== id);
  });
  return new Response(null, { status: 204 });
});
