import { consultar, modificar } from "@/lib/almacen";
import { iaDisponible } from "@/lib/asistente";
import { nuevaComunidad } from "@/lib/creacion";
import { leerJson, manejar } from "@/lib/http";
import { coachDe, conPermiso } from "@/lib/permisos";

export const dynamic = "force-dynamic";

// Las comunidades de una coach y sus cursos (borradores y publicados).
export const GET = manejar((req: Request) =>
  conPermiso(async () => {
    const autor = coachDe(req, new URL(req.url).searchParams.get("autor"));
    const datos = await consultar((a) => {
      const comunidades = (a.comunidadesCoach ?? []).filter((c) => c.autor === autor);
      const ids = new Set(comunidades.map((c) => c.id));
      const cursos = (a.cursosCoach ?? [])
        .filter((c) => ids.has(c.comunidad))
        .map((c) => ({
          id: c.id,
          comunidad: c.comunidad,
          titulo: c.titulo,
          estado: c.estado,
          origen: c.origen,
          lecciones: c.modulos.reduce((s, m) => s + m.lecciones.length, 0),
          actualizadoEn: c.actualizadoEn,
        }));
      return { comunidades, cursos, ia: iaDisponible() };
    });
    return Response.json(datos);
  }),
);

// Crea una comunidad nueva de la coach.
export const POST = manejar((req: Request) =>
  conPermiso(async () => {
    const datos = await leerJson(req);
    const autor = coachDe(req, datos.autor);
    const comunidad = await modificar((a) => {
      const nueva = nuevaComunidad(a, autor, datos);
      (a.comunidadesCoach ??= []).push(nueva);
      return nueva;
    });
    return Response.json(comunidad, { status: 201 });
  }),
);
