import { consultar, modificar } from "@/lib/almacen";
import { iaDisponible } from "@/lib/asistente";
import { diagnosticoLimpio, problemasDe } from "@/lib/diagnosticos";
import {
  diagnosticoDeCoach,
  enEdicion,
  leccionDelDiagnostico,
  ponerComoPrimerPaso,
  quitarDelCurso,
} from "@/lib/diagnosticos-coach";
import { leerJson, manejar } from "@/lib/http";
import { coachDe, conPermiso } from "@/lib/permisos";

export const dynamic = "force-dynamic";

// Un diagnóstico del coach.
//   GET     lo que está editando, qué le falta, su curso y si hay IA.
//   PUT     {diagnostico, primerPaso}  guarda. Completo: se publica y, con
//           primerPaso, queda como la primera lección del curso. Incompleto:
//           si ya lo ven alumnos, se guarda aparte hasta que esté completo.
//   DELETE  lo borra y quita su lección del curso (los resultados se quedan).

type Params = { params: Promise<{ id: string }> };

export const GET = manejar((req: Request, { params }: Params) =>
  conPermiso(async () => {
    const coach = await coachDe(req);
    const { id } = await params;
    const datos = await consultar((a) => {
      const d = diagnosticoDeCoach(a, id, coach);
      const curso = (a.cursosCoach ?? []).find((c) => c.id === d.curso);
      const edicion = enEdicion(d);
      return {
        diagnostico: edicion,
        problemas: problemasDe(edicion),
        publicado: d.publicado === true,
        conCambios: !!d.borrador,
        curso: curso
          ? { id: curso.id, titulo: curso.titulo, estado: curso.estado, primerPaso: !!leccionDelDiagnostico(curso, d.id) }
          : null,
      };
    });
    return Response.json({ ...datos, ia: iaDisponible() });
  }),
);

export const PUT = manejar((req: Request, { params }: Params) =>
  conPermiso(async () => {
    const coach = await coachDe(req);
    const { id } = await params;
    const entrada = await leerJson(req);
    const resultado = await modificar((a) => {
      const d = diagnosticoDeCoach(a, id, coach);
      const limpio = diagnosticoLimpio(d.id, entrada.diagnostico);
      const problemas = problemasDe(limpio);
      const curso = (a.cursosCoach ?? []).find((c) => c.id === d.curso && c.empresa === coach.empresa);
      const ahora = new Date().toISOString();
      if (problemas.length === 0 || !d.publicado) {
        // Completo (o nadie lo ve todavía): es la versión que ven los alumnos.
        Object.assign(d, limpio, { actualizadoEn: ahora });
        delete d.borrador;
        if (problemas.length === 0) d.publicado = true;
      } else {
        d.borrador = limpio;
        d.actualizadoEn = ahora;
      }
      if (curso) {
        const quiere = entrada.primerPaso === true;
        if (quiere && problemas.length === 0) ponerComoPrimerPaso(a, curso, limpio);
        else if (!quiere) quitarDelCurso(curso, d.id);
      }
      return {
        problemas,
        publicado: d.publicado === true,
        conCambios: !!d.borrador,
        primerPaso: !!curso && !!leccionDelDiagnostico(curso, d.id),
      };
    });
    return Response.json(resultado);
  }),
);

export const DELETE = manejar((req: Request, { params }: Params) =>
  conPermiso(async () => {
    const coach = await coachDe(req);
    const { id } = await params;
    await modificar((a) => {
      const d = diagnosticoDeCoach(a, id, coach);
      const curso = (a.cursosCoach ?? []).find((c) => c.id === d.curso && c.empresa === coach.empresa);
      if (curso) quitarDelCurso(curso, d.id);
      a.diagnosticosCoach = (a.diagnosticosCoach ?? []).filter((x) => x.id !== d.id);
    });
    return Response.json({ borrado: true });
  }),
);
