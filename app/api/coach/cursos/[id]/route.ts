import { borrarFoto, consultar, modificar } from "@/lib/almacen";
import { aplicarEdicion } from "@/lib/creacion";
import { ErrorDeDatos, leerJson, manejar } from "@/lib/http";
import { coachDe, conPermiso, cursoDeCoach } from "@/lib/permisos";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

// El curso completo, para el editor (con respuestas correctas: es de la coach).
export const GET = manejar((req: Request, contexto: Contexto) =>
  conPermiso(async () => {
    const { id } = await contexto.params;
    const coach = await coachDe(req);
    return Response.json(await consultar((a) => cursoDeCoach(a, id, coach)));
  }),
);

// Guarda lo que trae el editor. Un curso publicado se puede seguir editando.
export const PUT = manejar((req: Request, contexto: Contexto) =>
  conPermiso(async () => {
    const { id } = await contexto.params;
    const datos = await leerJson(req);
    const coach = await coachDe(req);
    const entrada = datos.curso;
    if (!entrada || typeof entrada !== "object") throw new ErrorDeDatos("Falta el curso.");
    const guardado = await modificar((a) => {
      const actual = cursoDeCoach(a, id, coach);
      const nuevo = aplicarEdicion(a, actual, entrada as Record<string, unknown>);
      a.cursosCoach = (a.cursosCoach ?? []).map((c) => (c.id === id ? nuevo : c));
      return nuevo;
    });
    return Response.json(guardado);
  }),
);

// Borra un borrador (uno publicado primero se despublica).
export const DELETE = manejar((req: Request, contexto: Contexto) =>
  conPermiso(async () => {
    const { id } = await contexto.params;
    const coach = await coachDe(req);
    await modificar((a) => {
      const curso = cursoDeCoach(a, id, coach);
      if (curso.estado === "publicado") throw new ErrorDeDatos("Primero despublica el curso para poder borrarlo.");
      a.cursosCoach = (a.cursosCoach ?? []).filter((c) => c.id !== id);
      // Sus presentaciones con IA se van con él.
      const lecciones = new Set(curso.modulos.flatMap((m) => m.lecciones.map((l) => l.id)));
      a.presentaciones = (a.presentaciones ?? []).filter((p) => !lecciones.has(p.leccion));
    });
    await borrarFoto(`curso-${id}`);
    return new Response(null, { status: 204 });
  }),
);
