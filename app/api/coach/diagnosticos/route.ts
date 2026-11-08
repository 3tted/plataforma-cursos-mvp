import { consultar, modificar, nuevoId } from "@/lib/almacen";
import { iaDisponible } from "@/lib/asistente";
import { diagnosticoVacio } from "@/lib/diagnosticos";
import { resumenDiagnostico, type DiagnosticoGuardado } from "@/lib/diagnosticos-coach";
import { leerJson, manejar } from "@/lib/http";
import { coachDe, conPermiso, cursoDeCoach, exigirEmpresaActiva } from "@/lib/permisos";

export const dynamic = "force-dynamic";

// Diagnósticos que crea el coach para empezar sus cursos.
//   GET  ?curso=c…   el diagnóstico de ese curso (o null) y si hay IA.
//   POST {curso}     crea uno vacío para ese curso (o devuelve el que ya tiene).

export const GET = manejar((req: Request) =>
  conPermiso(async () => {
    const coach = await coachDe(req);
    const curso = new URL(req.url).searchParams.get("curso");
    const datos = await consultar((a) => {
      const c = cursoDeCoach(a, curso, coach);
      const d = (a.diagnosticosCoach ?? []).find((x) => x.curso === c.id) as DiagnosticoGuardado | undefined;
      return d ? resumenDiagnostico(d, c) : null;
    });
    return Response.json({ diagnostico: datos, ia: iaDisponible() });
  }),
);

export const POST = manejar((req: Request) =>
  conPermiso(async () => {
    const coach = await coachDe(req);
    const datos = await leerJson(req);
    const id = await modificar((a) => {
      const c = cursoDeCoach(a, datos.curso, coach);
      const ya = (a.diagnosticosCoach ?? []).find((x) => x.curso === c.id);
      if (ya) return ya.id;
      exigirEmpresaActiva(a, coach);
      const ahora = new Date().toISOString();
      const nuevo = `dx-${nuevoId(a)}`;
      (a.diagnosticosCoach ??= []).push({
        ...diagnosticoVacio(nuevo, c.titulo ? `Diagnóstico: ${c.titulo}`.slice(0, 120) : ""),
        empresa: coach.empresa,
        curso: c.id,
        autor: coach.nombre,
        creadoEn: ahora,
        actualizadoEn: ahora,
      });
      return nuevo;
    });
    return Response.json({ id }, { status: 201 });
  }),
);
