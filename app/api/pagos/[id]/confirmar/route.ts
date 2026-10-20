import { modificar } from "@/lib/almacen";
import { ErrorDeDatos, idNumerico, manejar } from "@/lib/http";
import { cuentaDeReq, SinPermiso } from "@/lib/permisos";

// Simula el aviso (webhook) que en producción enviaría el proveedor de pagos
// cuando el alumno paga en OXXO, transfiere por SPEI o paga en Mercado Pago.
export const POST = manejar(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const cuenta = await cuentaDeReq(req);
    const id = idNumerico((await params).id);
    const pago = await modificar((a) => {
      const p = a.pagos.find((x) => x.id === id);
      if (!p) throw new ErrorDeDatos("El pago no existe.");
      if (p.autor !== cuenta.nombre) throw new SinPermiso("Ese pago es de otra persona.");
      p.estado = "pagado";
      return p;
    });
    return Response.json(pago);
  },
);
