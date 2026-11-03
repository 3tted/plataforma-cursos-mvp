import { consultar, modificar, nuevoId } from "@/lib/almacen";
import { cursoDeLeccion } from "@/lib/curso";
import { llevaPlan } from "@/lib/diagnosticos";
import { ErrorDeDatos, error, leerJson, manejar, texto } from "@/lib/http";
import { cuentaDeReq, empresaDeDatos } from "@/lib/permisos";
import { diasValidos, planPorDias } from "@/lib/planes";
import type { AvancePlan, Cuenta, DatosCurso } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// Avance de un plan por días incrustado en una lección (como el plan de 7 días
// de INCREASE). El alumno marca cada día y anota su evidencia; se guarda con
// cada cambio. El equipo de la empresa del curso ve el avance de sus alumnos.
//   GET  ?leccion=K…&plan=id   el alumno: el suyo; el equipo: los de todos.
//   POST {leccion, plan, dias}   guarda el avance del alumno.

async function leccionConPlan(leccionValor: unknown, planValor: unknown) {
  const leccion = texto(leccionValor, "leccion", 20);
  const id = texto(planValor, "plan", 60);
  const plan = planPorDias(id);
  const datos = await cursoDeLeccion(leccion, { borradores: true });
  const contenido = datos?.curso.modulos.flatMap((m) => m.lecciones).find((l) => l.id === leccion)?.contenido ?? "";
  if (!plan || !datos || !llevaPlan(contenido, id)) throw new ErrorDeDatos("Esta lección no tiene ese plan.");
  return { leccion, plan, datos };
}

const delEquipo = (cuenta: Cuenta, datos: DatosCurso) => cuenta.rol === "coach" && cuenta.empresa === empresaDeDatos(datos);

const vista = ({ cuenta: _cuenta, ...a }: AvancePlan) => a;

export const GET = manejar(async (req: Request) => {
  const parametros = new URL(req.url).searchParams;
  const cuenta = await cuentaDeReq(req);
  const { leccion, plan, datos } = await leccionConPlan(parametros.get("leccion"), parametros.get("plan"));
  if (delEquipo(cuenta, datos)) {
    const avances = await consultar((a) =>
      (a.planes ?? [])
        .filter((x) => x.leccion === leccion && x.plan === plan.id)
        .sort((x, y) => y.actualizadoEn.localeCompare(x.actualizadoEn))
        .map(vista),
    );
    return Response.json({ equipo: true, avances });
  }
  const suyo = await consultar((a) => (a.planes ?? []).find((x) => x.cuenta === cuenta.id && x.leccion === leccion && x.plan === plan.id));
  return Response.json({ equipo: false, avance: suyo ? vista(suyo) : null });
});

export const POST = manejar(async (req: Request) => {
  const datosPeticion = await leerJson(req);
  const cuenta = await cuentaDeReq(req);
  const { leccion, plan, datos } = await leccionConPlan(datosPeticion.leccion, datosPeticion.plan);
  const dias = diasValidos(plan, datosPeticion.dias);
  if (!dias) return error("No pudimos leer tu avance. Recarga la página e inténtalo de nuevo.");
  // El equipo de la empresa puede probarlo, pero su avance no se cuenta con el de sus alumnos.
  if (delEquipo(cuenta, datos)) return Response.json({ guardado: false });
  await modificar((a) => {
    a.planes ??= [];
    const ahora = new Date().toISOString();
    const existente = a.planes.find((x) => x.cuenta === cuenta.id && x.leccion === leccion && x.plan === plan.id);
    if (existente) Object.assign(existente, { dias, autor: cuenta.nombre, correo: cuenta.correo, actualizadoEn: ahora });
    else {
      a.planes.push({
        id: nuevoId(a),
        plan: plan.id,
        leccion,
        curso: datos.curso.id,
        cuenta: cuenta.id,
        autor: cuenta.nombre,
        correo: cuenta.correo,
        dias,
        actualizadoEn: ahora,
      });
    }
  });
  return Response.json({ guardado: true });
});
