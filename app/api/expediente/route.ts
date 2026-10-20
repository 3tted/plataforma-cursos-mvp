import { consultar } from "@/lib/almacen";
import { cargarCurso, idCurso } from "@/lib/curso";
import { cargarEvaluaciones, expedienteDe } from "@/lib/evaluaciones";
import { manejar } from "@/lib/http";
import { cuentaDeReq, empresaDeDatos, SinPermiso } from "@/lib/permisos";

export const dynamic = "force-dynamic";

// Expediente de un alumno en un curso: avance por módulo, repaso, examen final
// y estado. El alumno ve el suyo; la coach, el de cualquier alumno de los
// cursos de su empresa (?autor=).
export const GET = manejar(async (req: Request) => {
  const parametros = new URL(req.url).searchParams;
  const cuenta = await cuentaDeReq(req);
  const id = await idCurso(parametros.get("curso"));
  const [curso, ev] = await Promise.all([cargarCurso(id), cargarEvaluaciones(id)]);
  const pedido = parametros.get("autor")?.trim();
  const deOtro = !!pedido && pedido !== cuenta.nombre;
  if (deOtro && (cuenta.rol !== "coach" || cuenta.empresa !== empresaDeDatos(curso))) {
    throw new SinPermiso("Solo ves tu propio expediente.");
  }
  const autor = deOtro ? pedido : cuenta.nombre;
  return Response.json(await consultar((a) => expedienteDe(a, curso, ev, autor)));
});
