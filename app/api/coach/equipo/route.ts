import { modificar } from "@/lib/almacen";
import { cuentaPorCorreo, normalizarCorreo } from "@/lib/cuentas";
import { ErrorDeDatos, leerJson, manejar } from "@/lib/http";
import { coachDe, empresaDeCoach, SinPermiso, type Coach } from "@/lib/permisos";
import type { Almacen } from "@/lib/almacen";
import type { Cuenta } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// El equipo de una empresa: el dueño y los administradores cambian el rol de
// alguien (administrador o coach) o lo quitan del equipo; nadie quita ni baja
// de rol al dueño. Solo el dueño le pasa la empresa a otra persona del equipo,
// y él se queda como administrador.

/** Alguien del equipo de la empresa de quien pide, que no sea el dueño ni quien pide. */
function miembroDe(a: Almacen, coach: Coach, correo: unknown): Cuenta {
  const c = cuentaPorCorreo(a, normalizarCorreo(correo));
  if (!c || c.rol !== "coach" || c.empresa !== coach.empresa) throw new ErrorDeDatos("Esa persona no está en tu equipo.");
  if (c.id === coach.cuenta.id) throw new ErrorDeDatos("No puedes cambiar tu propio rol.");
  if (c.rolEmpresa === "dueno") throw new SinPermiso("Al dueño de la empresa no se le puede quitar ni cambiar de rol.");
  return c;
}

// Cambiar el rol: { correo, rol: "admin" | "coach" }.
export const PATCH = manejar(async (req: Request) => {
  const coach = await coachDe(req);
  const datos = await leerJson(req);
  if (datos.rol !== "admin" && datos.rol !== "coach") throw new ErrorDeDatos('El rol debe ser "admin" o "coach".');
  const rol = datos.rol;
  await modificar((a) => {
    empresaDeCoach(a, coach, { administrar: true });
    miembroDe(a, coach, datos.correo).rolEmpresa = rol;
  });
  return new Response(null, { status: 204 });
});

// Quitar a alguien del equipo (?correo=): su cuenta sigue, como alumno. Lo
// que creó se queda en la empresa.
export const DELETE = manejar(async (req: Request) => {
  const coach = await coachDe(req);
  const correo = new URL(req.url).searchParams.get("correo");
  await modificar((a) => {
    empresaDeCoach(a, coach, { administrar: true });
    const c = miembroDe(a, coach, correo);
    c.rol = "alumno";
    delete c.empresa;
    delete c.rolEmpresa;
  });
  return new Response(null, { status: 204 });
});

// Pasarle la empresa a otra persona del equipo: { correo }. Solo el dueño.
export const POST = manejar(async (req: Request) => {
  const coach = await coachDe(req);
  if (!coach.dueno) throw new SinPermiso("Solo el dueño puede pasarle la empresa a otra persona.");
  const datos = await leerJson(req);
  await modificar((a) => {
    const empresa = empresaDeCoach(a, coach);
    const nuevo = miembroDe(a, coach, datos.correo);
    const yo = (a.cuentas ?? []).find((c) => c.id === coach.cuenta.id);
    if (!yo) throw new ErrorDeDatos("No encontramos tu cuenta.");
    nuevo.rolEmpresa = "dueno";
    yo.rolEmpresa = "admin";
    empresa.dueno = nuevo.nombre;
    empresa.actualizadaEn = new Date().toISOString();
  });
  return new Response(null, { status: 204 });
});
