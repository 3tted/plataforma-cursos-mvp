import { consultar } from "@/lib/almacen";
import { COMUNIDAD_PRINCIPAL, CURSO_PRINCIPAL, cargarCursos, idComunidad } from "@/lib/curso";
import { manejar } from "@/lib/http";
import type { ResumenComunidad } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// Miembros activos de una comunidad (?comunidad=id): alumnos que publicaron o
// comentaron en ella, que le preguntaron al asistente de uno de sus cursos o
// que se unieron.
export const GET = manejar(async (req: Request) => {
  const comunidad = await idComunidad(new URL(req.url).searchParams.get("comunidad"));
  const cursos = new Set((await cargarCursos()).filter((c) => c.comunidad.id === comunidad).map((c) => c.curso.id));
  const miembros = await consultar((a) => {
    const nombres = new Set<string>();
    for (const p of a.publicaciones) {
      if ((p.comunidad ?? COMUNIDAD_PRINCIPAL) !== comunidad) continue;
      if (p.rol === "alumno") nombres.add(p.autor);
      for (const c of p.comentarios) if (c.rol === "alumno") nombres.add(c.autor);
    }
    for (const q of a.preguntas) if (cursos.has(q.curso ?? CURSO_PRINCIPAL)) nombres.add(q.autor);
    for (const i of a.inscripciones ?? []) {
      const suyas = i.comunidades ?? (i.comunidad ? [COMUNIDAD_PRINCIPAL] : []);
      if (suyas.includes(comunidad)) nombres.add(i.autor);
    }
    return nombres.size;
  });
  const resumen: ResumenComunidad = { miembros };
  return Response.json(resumen);
});
