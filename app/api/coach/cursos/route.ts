import { modificar } from "@/lib/almacen";
import { nuevoCurso } from "@/lib/creacion";
import { leerJson, manejar } from "@/lib/http";
import { coachDe, conPermiso, destinoDeCurso } from "@/lib/permisos";

export const dynamic = "force-dynamic";

// Crea un borrador de curso: en una comunidad de la coach o, si no manda
// comunidad, suelto (lo pone en una comunidad después).
export const POST = manejar((req: Request) =>
  conPermiso(async () => {
    const datos = await leerJson(req);
    const coach = await coachDe(req);
    const curso = await modificar((a) => {
      const nuevo = nuevoCurso(a, coach, destinoDeCurso(a, datos.comunidad, coach));
      (a.cursosCoach ??= []).push(nuevo);
      return nuevo;
    });
    return Response.json(curso, { status: 201 });
  }),
);
