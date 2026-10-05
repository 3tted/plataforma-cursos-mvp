import { consultar, contarMiembros } from "@/lib/almacen";
import { manejar } from "@/lib/http";
import type { ResumenCoach } from "@/lib/tipos";

export const dynamic = "force-dynamic";

const SEMANA_MS = 7 * 24 * 3_600_000;

export const GET = manejar(async () => {
  const resumen = await consultar((a): ResumenCoach => {
    const conteo = new Map<string, number>();
    for (const q of a.preguntas) for (const id of q.citas) conteo.set(id, (conteo.get(id) ?? 0) + 1);

    const hace7Dias = Date.now() - SEMANA_MS;
    return {
      miembros: contarMiembros(a),
      publicaciones: a.publicaciones.length,
      preguntasSemana: a.preguntas.filter((q) => Date.parse(q.creadaEn) >= hace7Dias).length,
      preguntas: [...a.preguntas].reverse().slice(0, 100),
      leccionesConsultadas: [...conteo]
        .map(([id, total]) => ({ id, total }))
        .sort((x, y) => y.total - x.total)
        .slice(0, 8),
      pagos: [...a.pagos].reverse().slice(0, 20),
      ingresosSimulados: a.pagos.filter((p) => p.estado === "pagado").reduce((s, p) => s + p.monto, 0),
      leccionesCoach: a.leccionesCoach,
    };
  });
  return Response.json(resumen);
});
