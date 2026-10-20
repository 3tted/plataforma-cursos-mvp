import { consultar, modificar } from "@/lib/almacen";
import {
  contrasenaCorrecta,
  contrasenaDemoPublica,
  CUENTAS_DEMO,
  cuentaPorCorreo,
  cuentaPublica,
  normalizarCorreo,
} from "@/lib/cuentas";
import { googleConfigurado } from "@/lib/google";
import { error, ErrorDeDatos, leerJson, manejar } from "@/lib/http";
import { abrirSesion, cerrarSesionEn, cookieDeSesion, cookieSinSesion, cuentaEn, huellaDe } from "@/lib/sesion";

export const dynamic = "force-dynamic";

const MAX_INTENTOS = 8;
const BLOQUEO_MS = 15 * 60_000;

// La sesión de quien entra. GET: la cuenta con sesión (o null) y cómo se
// puede entrar (Google, cuentas de demostración). POST: entrar con correo y
// contraseña. DELETE: salir.
export const GET = manejar(async (req: Request) => {
  const h = huellaDe(req);
  const cuenta = await consultar((a) => cuentaEn(a, h));
  const contrasena = contrasenaDemoPublica();
  return Response.json({
    cuenta: cuenta ? cuentaPublica(cuenta) : null,
    google: googleConfigurado(),
    demo: contrasena ? { contrasena, cuentas: CUENTAS_DEMO.map(({ nombre, correo, detalle }) => ({ nombre, correo, detalle })) } : null,
  });
});

export const POST = manejar(async (req: Request) => {
  const datos = await leerJson(req);
  const correo = normalizarCorreo(datos.correo);
  const contrasena = typeof datos.contrasena === "string" ? datos.contrasena : "";
  if (!correo || !contrasena) throw new ErrorDeDatos("Escribe tu correo y tu contraseña.");
  const cuenta = await consultar((a) => cuentaPorCorreo(a, correo) ?? null);
  const noCoincide = "El correo o la contraseña no coinciden.";
  if (!cuenta) return error(noCoincide, 401);
  if (cuenta.bloqueadaHasta && Date.parse(cuenta.bloqueadaHasta) > Date.now()) {
    return error("Hubo demasiados intentos con esta cuenta. Espera 15 minutos y vuelve a intentarlo.", 429);
  }
  if (!(await contrasenaCorrecta(cuenta, contrasena))) {
    await modificar((a) => {
      const c = a.cuentas?.find((x) => x.id === cuenta.id);
      if (!c) return;
      c.intentosFallidos = (c.intentosFallidos ?? 0) + 1;
      if (c.intentosFallidos >= MAX_INTENTOS) {
        c.bloqueadaHasta = new Date(Date.now() + BLOQUEO_MS).toISOString();
        delete c.intentosFallidos;
      }
    });
    return error(noCoincide, 401);
  }
  const token = await modificar((a) => {
    const c = a.cuentas?.find((x) => x.id === cuenta.id);
    if (c) {
      delete c.intentosFallidos;
      delete c.bloqueadaHasta;
    }
    return abrirSesion(a, cuenta.id);
  });
  return Response.json({ cuenta: cuentaPublica(cuenta) }, { headers: { "Set-Cookie": cookieDeSesion(req, token) } });
});

export const DELETE = manejar(async (req: Request) => {
  const h = huellaDe(req);
  if (h) await modificar((a) => cerrarSesionEn(a, h));
  return new Response(null, { status: 204, headers: { "Set-Cookie": cookieSinSesion(req) } });
});
