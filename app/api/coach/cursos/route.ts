import { modificar } from "@/lib/almacen";
import { nuevoCurso } from "@/lib/creacion";
import { leerJson, manejar } from "@/lib/http";
import { coachDe, comunidadDeCoach, conPermiso } from "@/lib/permisos";

export const dynamic = "force-dynamic";

// Crea un borrador de curso en una comunidad de la coach.
export const POST = manejar((req: Request) =>
  conPermiso(async () => {
    const datos = await leerJson(req);
    const autor = coachDe(req, datos.autor);
    const curso = await modificar((a) => {
      const comunidad = comunidadDeCoach(a, datos.comunidad, autor);
      const nuevo = nuevoCurso(a, autor, comunidad.id);
      (a.cursosCoach ??= []).push(nuevo);
      return nuevo;
    });
    return Response.json(curso, { status: 201 });
  }),
);
