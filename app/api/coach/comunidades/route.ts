import fs from "node:fs/promises";
import path from "node:path";
import { DIRECTORIO_VIDEOS, consultar, modificar } from "@/lib/almacen";
import { iaDisponible } from "@/lib/asistente";
import { nuevaComunidad } from "@/lib/creacion";
import { leerJson, manejar } from "@/lib/http";
import { coachDe, comunidadDeCoach, conPermiso } from "@/lib/permisos";

export const dynamic = "force-dynamic";

// Las comunidades de una coach y sus cursos (borradores y publicados).
export const GET = manejar((req: Request) =>
  conPermiso(async () => {
    const autor = coachDe(req, new URL(req.url).searchParams.get("autor"));
    const datos = await consultar((a) => {
      const comunidades = (a.comunidadesCoach ?? []).filter((c) => c.autor === autor);
      // Sus cursos: los que están en sus comunidades y los que todavía no tienen una.
      const cursos = (a.cursosCoach ?? [])
        .filter((c) => c.autor === autor)
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

// Borra una comunidad de la coach con todo lo suyo: sus cursos, los videos de
// sus lecciones, sus publicaciones, pagos y lo que los alumnos llevaban en
// ella (inscripción, avance, repasos, exámenes y preguntas al asistente).
export const DELETE = manejar((req: Request) =>
  conPermiso(async () => {
    const parametros = new URL(req.url).searchParams;
    const autor = coachDe(req, parametros.get("autor"));
    const { videos, borrado } = await modificar((a) => {
      const comunidad = comunidadDeCoach(a, parametros.get("id"), autor);
      const cursos = (a.cursosCoach ?? []).filter((c) => c.comunidad === comunidad.id);
      const ids = new Set(cursos.map((c) => c.id));
      const lecciones = new Set(cursos.flatMap((c) => c.modulos.flatMap((m) => m.lecciones.map((l) => l.id))));
      const videos = (a.videos ?? []).filter((v) => lecciones.has(v.leccion));

      a.comunidadesCoach = (a.comunidadesCoach ?? []).filter((c) => c.id !== comunidad.id);
      a.cursosCoach = (a.cursosCoach ?? []).filter((c) => !ids.has(c.id));
      a.videos = (a.videos ?? []).filter((v) => !lecciones.has(v.leccion));
      a.publicaciones = a.publicaciones.filter((p) => p.comunidad !== comunidad.id);
      a.pagos = a.pagos.filter((p) => p.comunidad !== comunidad.id);
      a.preguntas = a.preguntas.filter((p) => !p.curso || !ids.has(p.curso));
      a.inscripciones = (a.inscripciones ?? []).map((i) => ({
        ...i,
        ...(i.comunidades ? { comunidades: i.comunidades.filter((c) => c !== comunidad.id) } : {}),
        cursos: i.cursos.filter((c) => !ids.has(c)),
      }));
      a.progreso = (a.progreso ?? []).map((p) => ({ ...p, completadas: p.completadas.filter((l) => !lecciones.has(l)) }));
      a.repasos = (a.repasos ?? []).filter((r) => !lecciones.has(r.leccion));
      a.examenes = (a.examenes ?? []).filter((x) => !x.curso || !ids.has(x.curso));
      a.semillas = (a.semillas ?? []).filter((s) => s !== comunidad.id);
      return { videos, borrado: { comunidad: comunidad.id, cursos: [...ids] } };
    });
    await Promise.all(videos.map((v) => fs.rm(path.join(DIRECTORIO_VIDEOS, v.archivo), { force: true })));
    return Response.json(borrado);
  }),
);
