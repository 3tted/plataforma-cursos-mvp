import { randomBytes } from "crypto";
import { modificar } from "@/lib/almacen";
import { cifrarContrasena, cuentaPorCorreo, normalizarCorreo } from "@/lib/cuentas";
import { error, leerJson, manejar } from "@/lib/http";
import { cuentaDeReq, SinPermiso } from "@/lib/permisos";
import { cerrarOtrasSesiones } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Sin correos en el MVP, quien olvida su contraseña le escribe al equipo de
// Merkatics: con su correo ({ correo }) se le pone una contraseña temporal,
// que se muestra una sola vez para dársela. Sus sesiones abiertas se cierran.
export const POST = manejar(async (req: Request) => {
  const admin = await cuentaDeReq(req);
  if (!admin.admin) throw new SinPermiso("Solo el equipo de Merkatics restablece contraseñas.");
  const correo = normalizarCorreo((await leerJson(req)).correo);
  const temporal = randomBytes(6).toString("base64url");
  const cifrada = await cifrarContrasena(temporal);
  const cuenta = await modificar((a) => {
    const c = cuentaPorCorreo(a, correo);
    if (!c) return null;
    c.contrasena = cifrada;
    delete c.bloqueadaHasta;
    delete c.intentosFallidos;
    cerrarOtrasSesiones(a, c.id, null);
    return c;
  });
  if (!cuenta) return error("No hay ninguna cuenta con ese correo.", 404);
  return Response.json({ nombre: cuenta.nombre, correo: cuenta.correo, contrasena: temporal });
});
