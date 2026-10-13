import { consultar, contarMiembros } from "@/lib/almacen";
import { COMUNIDAD_PRINCIPAL, CURSO_PRINCIPAL, cargarCurso, cargarCursos, idComunidad, idCurso } from "@/lib/curso";
import { manejar } from "@/lib/http";
import { miembrosDeComunidad } from "@/lib/tendencias";
import type { ResumenCoach } from "@/lib/tipos";

export const dynamic = "force-dynamic";

const SEMANA_MS = 7 * 24 * 3_600_000;

// Resumen del panel de la coach. Con ?curso=id se limita a lo que eligió en el
// panel: las preguntas al asistente y las lecciones más consultadas de ese
// curso, y los miembros, publicaciones y pagos de su comunidad. Con
// ?comunidad=id (el inicio de la coach), lo de toda esa comunidad y sus cursos.
// Sin parámetros, cuenta todo.
export const GET = manejar(async (req: Request) => {
  const parametros = new URL(req.url).searchParams;
  const pedido = parametros.get("curso");
  const pedidaComunidad = parametros.get("comunidad");
  const cursosDe = async (comunidad: string) =>
    new Set((await cargarCursos()).filter((c) => c.comunidad.id === comunidad).map((c) => c.curso.id));
  const alcance: { curso: string | null; comunidad: string; cursos: Set<string> } | null = pedido
    ? await (async () => {
        const datos = await cargarCurso(await idCurso(pedido, { borradores: true }), { borradores: true });
        const comunidad = datos.comunidad.id;
        return { curso: datos.curso.id, comunidad, cursos: await cursosDe(comunidad) };
      })()
    : pedidaComunidad
      ? await (async () => {
          const comunidad = await idComunidad(pedidaComunidad);
          return { curso: null, comunidad, cursos: await cursosDe(comunidad) };
        })()
      : null;

  const resumen = await consultar((a): Omit<ResumenCoach, "titulos"> => {
    const deCurso = (q: { curso?: string }) => q.curso ?? CURSO_PRINCIPAL;
    const preguntas = alcance
      ? a.preguntas.filter((q) => (alcance.curso ? deCurso(q) === alcance.curso : alcance.cursos.has(deCurso(q))))
      : a.preguntas;
    const publicaciones = alcance
      ? a.publicaciones.filter((p) => (p.comunidad ?? COMUNIDAD_PRINCIPAL) === alcance.comunidad)
      : a.publicaciones;
    const pagos = alcance ? a.pagos.filter((p) => (p.comunidad ?? COMUNIDAD_PRINCIPAL) === alcance.comunidad) : a.pagos;

    const conteo = new Map<string, number>();
    for (const q of preguntas) for (const id of q.citas) conteo.set(id, (conteo.get(id) ?? 0) + 1);

    const hace7Dias = Date.now() - SEMANA_MS;
    return {
      miembros: alcance ? miembrosDeComunidad(a, alcance.comunidad, alcance.cursos) : contarMiembros(a),
      publicaciones: publicaciones.length,
      preguntasSemana: preguntas.filter((q) => Date.parse(q.creadaEn) >= hace7Dias).length,
      preguntas: [...preguntas].reverse().slice(0, 100),
      leccionesConsultadas: [...conteo]
        .map(([id, total]) => ({ id, total }))
        .sort((x, y) => y.total - x.total)
        .slice(0, 8),
      pagos: [...pagos].reverse().slice(0, 20),
      ingresosSimulados: pagos.filter((p) => p.estado === "pagado").reduce((s, p) => s + p.monto, 0),
      leccionesCoach: a.leccionesCoach,
    };
  });
  // Títulos de las lecciones citadas, de cualquier curso.
  const citadas = new Set([...resumen.preguntas.flatMap((q) => q.citas), ...resumen.leccionesConsultadas.map((l) => l.id)]);
  const titulos: Record<string, string> = {};
  for (const c of await cargarCursos({ borradores: true }))
    for (const m of c.curso.modulos) for (const l of m.lecciones) if (citadas.has(l.id)) titulos[l.id] = l.titulo;
  return Response.json({ ...resumen, titulos } satisfies ResumenCoach);
});
