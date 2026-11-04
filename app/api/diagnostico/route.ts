import { consultar, modificar, nuevoId } from "@/lib/almacen";
import { cursoDeLeccion } from "@/lib/curso";
import { calcular, diagnostico as buscarDiagnostico, llevaDiagnostico, respuestasValidas } from "@/lib/diagnosticos";
import { ErrorDeDatos, error, leerJson, manejar, texto } from "@/lib/http";
import { cuentaDeReq, empresaDeDatos } from "@/lib/permisos";
import type { Cuenta, DatosCurso, ResultadoDiagnostico } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// Resultados de un diagnóstico incrustado en una lección (como el Radar de
// INCREASE). El alumno guarda el suyo al revelar su resultado y lo recupera
// en cualquier dispositivo; el equipo de la empresa del curso ve los de todos
// sus alumnos para darles seguimiento.
//   GET  ?leccion=K…&diagnostico=id   el alumno: el suyo; el equipo: los de todos.
//   POST {leccion, diagnostico, respuestas}   guarda (o actualiza) el del alumno.

async function leccionConDiagnostico(leccionValor: unknown, diagnosticoValor: unknown) {
  const leccion = texto(leccionValor, "leccion", 20);
  const id = texto(diagnosticoValor, "diagnostico", 60);
  const d = buscarDiagnostico(id);
  const datos = await cursoDeLeccion(leccion, { borradores: true });
  const contenido = datos?.curso.modulos.flatMap((m) => m.lecciones).find((l) => l.id === leccion)?.contenido ?? "";
  if (!d || !datos || !llevaDiagnostico(contenido, id)) throw new ErrorDeDatos("Esta lección no tiene ese diagnóstico.");
  return { leccion, d, datos };
}

const delEquipo = (cuenta: Cuenta, datos: DatosCurso) => cuenta.rol === "coach" && cuenta.empresa === empresaDeDatos(datos);

/** Lo que ve el navegador: sin el id de la cuenta. */
const vista = ({ cuenta: _cuenta, ...r }: ResultadoDiagnostico) => r;

export const GET = manejar(async (req: Request) => {
  const parametros = new URL(req.url).searchParams;
  const cuenta = await cuentaDeReq(req);
  const { leccion, d, datos } = await leccionConDiagnostico(parametros.get("leccion"), parametros.get("diagnostico"));
  if (delEquipo(cuenta, datos)) {
    const resultados = await consultar((a) =>
      (a.diagnosticos ?? [])
        .filter((r) => r.leccion === leccion && r.diagnostico === d.id)
        .sort((x, y) => y.actualizadoEn.localeCompare(x.actualizadoEn))
        .map(vista),
    );
    return Response.json({ equipo: true, resultados });
  }
  const { suyo, reinicio } = await consultar((a) => ({
    suyo: (a.diagnosticos ?? []).find((r) => r.cuenta === cuenta.id && r.leccion === leccion && r.diagnostico === d.id),
    reinicio: a.reinicios?.[leccion] ?? null,
  }));
  return Response.json({ equipo: false, resultado: suyo ? vista(suyo) : null, reinicio });
});

export const POST = manejar(async (req: Request) => {
  const datosPeticion = await leerJson(req);
  const cuenta = await cuentaDeReq(req);
  const { leccion, d, datos } = await leccionConDiagnostico(datosPeticion.leccion, datosPeticion.diagnostico);
  const respuestas = respuestasValidas(d, datosPeticion.respuestas);
  if (!respuestas) return error("Responde todas las afirmaciones antes de revelar tu resultado.");
  // El equipo de la empresa puede probarlo, pero su resultado no se cuenta con el de sus alumnos.
  if (delEquipo(cuenta, datos)) return Response.json({ guardado: false });

  const r = calcular(d, respuestas);
  const puntos = Object.fromEntries(r.dimensiones.map((x) => [x.dimension.id, x.puntos]));
  await modificar((a) => {
    a.diagnosticos ??= [];
    const ahora = new Date().toISOString();
    const existente = a.diagnosticos.find((x) => x.cuenta === cuenta.id && x.leccion === leccion && x.diagnostico === d.id);
    const cambios = {
      autor: cuenta.nombre,
      correo: cuenta.correo,
      respuestas,
      puntos,
      total: r.total,
      masBajas: r.masBajas.map((x) => x.id),
      actualizadoEn: ahora,
    };
    if (existente) Object.assign(existente, cambios);
    else {
      a.diagnosticos.push({
        id: nuevoId(a),
        diagnostico: d.id,
        leccion,
        curso: datos.curso.id,
        cuenta: cuenta.id,
        creadoEn: ahora,
        ...cambios,
      });
    }
  });
  return Response.json({ guardado: true });
});
