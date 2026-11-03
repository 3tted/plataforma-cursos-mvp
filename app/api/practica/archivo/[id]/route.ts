import { consultar } from "@/lib/almacen";
import { cursoDeLeccion } from "@/lib/curso";
import { error, idNumerico, manejar } from "@/lib/http";
import { cuentaDeReq, empresaDeDatos } from "@/lib/permisos";
import { responderArchivoPractica } from "@/lib/practicas";

export const dynamic = "force-dynamic";

// Descarga el archivo de una práctica: solo el alumno que lo subió o el equipo
// de la empresa dueña del curso.

type Contexto = { params: Promise<{ id: string }> };

export const GET = manejar(async (req: Request, contexto: Contexto) => {
  const id = idNumerico((await contexto.params).id);
  const cuenta = await cuentaDeReq(req);
  const entrega = await consultar((a) => (a.entregas ?? []).find((e) => e.id === id));
  if (!entrega?.archivo) return error("No encontramos ese archivo.", 404);
  if (entrega.cuenta !== cuenta.id) {
    const datos = await cursoDeLeccion(entrega.leccion, { borradores: true });
    const delEquipo = !!datos && cuenta.rol === "coach" && cuenta.empresa === empresaDeDatos(datos);
    if (!delEquipo) return error("Este archivo es de otra persona.", 403);
  }
  return responderArchivoPractica(entrega.archivo);
});
