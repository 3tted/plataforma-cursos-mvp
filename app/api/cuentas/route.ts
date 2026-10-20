import { modificar } from "@/lib/almacen";
import {
  cifrarContrasena,
  contrasenaCorrecta,
  correoValido,
  cuentaPorCorreo,
  cuentaPorNombre,
  cuentaPublica,
  MIN_CONTRASENA,
  normalizarCorreo,
  nuevoIdCuenta,
} from "@/lib/cuentas";
import { ErrorDeDatos, leerJson, manejar, texto } from "@/lib/http";
import { aceptarInvitacion, invitacionVigente } from "@/lib/invitaciones";
import { cuentaDeReq } from "@/lib/permisos";
import { abrirSesion, cerrarOtrasSesiones, cookieDeSesion, huellaDe } from "@/lib/sesion";
import type { Cuenta } from "@/lib/tipos";

export const dynamic = "force-dynamic";

function contrasenaNueva(valor: unknown): string {
  const c = typeof valor === "string" ? valor : "";
  if (c.length < MIN_CONTRASENA) throw new ErrorDeDatos(`La contraseña necesita al menos ${MIN_CONTRASENA} caracteres.`);
  if (c.length > 200) throw new ErrorDeDatos("La contraseña es demasiado larga.");
  return c;
}

// Crear una cuenta: { nombre, correo, contrasena, invitacion? }. Sin
// invitación es de alumno; con una invitación vigente, de coach.
export const POST = manejar(async (req: Request) => {
  const datos = await leerJson(req);
  const nombre = texto(datos.nombre, "nombre", 60);
  if (nombre.length < 2) throw new ErrorDeDatos("Escribe tu nombre (al menos 2 letras).");
  const correo = normalizarCorreo(datos.correo);
  if (!correoValido(correo)) throw new ErrorDeDatos("Escribe un correo válido, por ejemplo ana@correo.com.");
  const contrasena = await cifrarContrasena(contrasenaNueva(datos.contrasena));
  const { cuenta, token } = await modificar((a) => {
    if (cuentaPorCorreo(a, correo)) throw new ErrorDeDatos("Ya hay una cuenta con ese correo. Entra con ella.");
    if (cuentaPorNombre(a, nombre)) {
      throw new ErrorDeDatos("Ya hay alguien con ese nombre en la plataforma. Agrega tu apellido o una inicial.");
    }
    const invitacion = datos.invitacion ? invitacionVigente(a, datos.invitacion) : null;
    const cuenta: Cuenta = { id: nuevoIdCuenta(), correo, nombre, rol: "alumno", contrasena, creadaEn: new Date().toISOString() };
    if (invitacion) aceptarInvitacion(a, invitacion, cuenta);
    a.cuentas = [...(a.cuentas ?? []), cuenta];
    return { cuenta, token: abrirSesion(a, cuenta.id) };
  });
  return Response.json(
    { cuenta: cuentaPublica(cuenta) },
    { status: 201, headers: { "Set-Cookie": cookieDeSesion(req, token) } },
  );
});

// Cambiar lo propio: { bio } o { contrasenaActual, contrasenaNueva }.
export const PATCH = manejar(async (req: Request) => {
  const cuenta = await cuentaDeReq(req);
  const datos = await leerJson(req);
  let nueva: { sal: string; hash: string } | null = null;
  if (datos.contrasenaNueva !== undefined) {
    // Quien ya tiene contraseña (o usa la de demo) confirma la actual; quien solo entra con Google, no.
    if ((cuenta.contrasena || cuenta.demo) && !(await contrasenaCorrecta(cuenta, String(datos.contrasenaActual ?? "")))) {
      throw new ErrorDeDatos("Tu contraseña actual no coincide.");
    }
    nueva = await cifrarContrasena(contrasenaNueva(datos.contrasenaNueva));
  }
  const h = huellaDe(req);
  const actualizada = await modificar((a) => {
    const c = a.cuentas?.find((x) => x.id === cuenta.id);
    if (!c) throw new ErrorDeDatos("No encontramos tu cuenta.");
    if (typeof datos.bio === "string") {
      const bio = datos.bio.trim().slice(0, 160);
      if (bio) c.bio = bio;
      else delete c.bio;
    }
    if (nueva) {
      c.contrasena = nueva;
      // Las sesiones abiertas en otros equipos se cierran.
      cerrarOtrasSesiones(a, c.id, h);
    }
    return c;
  });
  return Response.json({ cuenta: cuentaPublica(actualizada) });
});
