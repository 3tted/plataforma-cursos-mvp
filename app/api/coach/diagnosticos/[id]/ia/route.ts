import { consultar } from "@/lib/almacen";
import { iaDisponible } from "@/lib/asistente";
import { generarDiagnostico, pedidoDe, revisarPreguntas, sugerirPreguntas } from "@/lib/diagnostico-ia";
import { diagnosticoLimpio } from "@/lib/diagnosticos";
import { contextoDe, diagnosticoDeCoach } from "@/lib/diagnosticos-coach";
import { ErrorDeDatos, leerJson, manejar } from "@/lib/http";
import { coachDe, conPermiso } from "@/lib/permisos";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// La IA ayuda con un diagnóstico del coach. No guarda nada: devuelve una
// propuesta y el coach decide en el editor.
//   {accion: "generar", tema, para?, preguntas, areas, tipo, indicaciones?}  → {diagnostico}
//   {accion: "sugerir", diagnostico, area, cantidad, tipo}                    → {preguntas}
//   {accion: "revisar", diagnostico}                                          → {revision}

export const POST = manejar((req: Request, { params }: { params: Promise<{ id: string }> }) =>
  conPermiso(async () => {
    const coach = await coachDe(req);
    const { id } = await params;
    const datos = await leerJson(req);
    if (!iaDisponible()) throw new ErrorDeDatos("La IA no está conectada en este momento. Puedes armarlo tú mismo.");
    const contexto = await consultar((a) => contextoDe(a, diagnosticoDeCoach(a, id, coach)));
    const actual = () => diagnosticoLimpio(id, datos.diagnostico);
    const tipo = datos.tipo === "opciones" || datos.tipo === "mixto" ? datos.tipo : "escala";
    switch (datos.accion) {
      case "generar":
        return Response.json({ diagnostico: await generarDiagnostico(id, pedidoDe(datos), contexto) });
      case "sugerir":
        return Response.json({
          preguntas: await sugerirPreguntas(actual(), Number(datos.area) || 0, Number(datos.cantidad) || 3, tipo, contexto),
        });
      case "revisar":
        return Response.json({ revision: await revisarPreguntas(actual()) });
      default:
        throw new ErrorDeDatos("Acción no válida.");
    }
  }),
);
