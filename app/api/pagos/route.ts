import { randomInt } from "crypto";
import { modificar, nuevoId } from "@/lib/almacen";
import { cargarComunidades, idComunidad } from "@/lib/curso";
import { ErrorDeDatos, leerJson, manejar, texto } from "@/lib/http";
import type { MetodoPago, Pago } from "@/lib/tipos";

// PAGOS SIMULADOS. No se contacta a ningún proveedor ni se cobra nada: se
// generan referencias ficticias para mostrar cómo se vería el flujo con OXXO,
// SPEI o Mercado Pago. En la Fase 2 esta ruta llamará al proveedor elegido
// (Mercado Pago, Conekta u otro) en modo sandbox.

const METODOS: MetodoPago[] = ["oxxo", "spei", "mercadopago"];

function digitos(n: number): string {
  return Array.from({ length: n }, () => randomInt(10)).join("");
}

export const POST = manejar(async (req: Request) => {
  const datos = await leerJson(req);
  const metodo = datos.metodo as MetodoPago;
  if (!METODOS.includes(metodo)) throw new ErrorDeDatos("Método de pago no válido.");
  const autor = texto(datos.autor, "autor", 60);
  const id = await idComunidad(datos.comunidad);
  const comunidad = (await cargarComunidades()).find((c) => c.id === id)!;

  const pago = await modificar((a) => {
    const nuevo: Pago = {
      id: nuevoId(a),
      comunidad: comunidad.id,
      autor,
      metodo,
      monto: comunidad.precio_mensual,
      referencia: metodo === "oxxo" ? digitos(14) : metodo === "spei" ? digitos(7) : `MP-DEMO-${digitos(8)}`,
      estado: "pendiente",
      creadoEn: new Date().toISOString(),
    };
    if (metodo === "oxxo") nuevo.venceEn = new Date(Date.now() + 3 * 24 * 3_600_000).toISOString();
    // CLABE claramente ficticia: empieza con ceros para que nadie la confunda con una real.
    if (metodo === "spei") nuevo.clabe = `000000${digitos(12)}`;
    a.pagos.push(nuevo);
    return nuevo;
  });
  return Response.json(pago, { status: 201 });
});
