import { modificar } from "@/lib/almacen";
import { ErrorDeDatos, leerJson, manejar } from "@/lib/http";
import { coachDe, conPermiso, cursoDeCoach, destinoDeCurso } from "@/lib/permisos";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

// Pone un curso en una comunidad de la coach, lo cambia de comunidad o lo deja
// sin comunidad (""). Uno publicado no se mueve: sus alumnos están inscritos
// en esa comunidad.
export const POST = manejar((req: Request, contexto: Contexto) =>
  conPermiso(async () => {
    const { id } = await contexto.params;
    const datos = await leerJson(req);
    const autor = coachDe(req, datos.autor);
    const curso = await modificar((a) => {
      const c = cursoDeCoach(a, id, autor);
      const destino = destinoDeCurso(a, datos.comunidad, autor);
      if (destino !== c.comunidad && c.estado === "publicado") {
        throw new ErrorDeDatos("Despublica el curso para cambiarlo de comunidad.");
      }
      c.comunidad = destino;
      c.actualizadoEn = new Date().toISOString();
      return c;
    });
    return Response.json(curso);
  }),
);
