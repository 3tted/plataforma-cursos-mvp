import { consultar, modificar } from "@/lib/almacen";
import { error, ErrorDeDatos, leerJson, manejar } from "@/lib/http";
import { nuevaInvitacion, vigente } from "@/lib/invitaciones";
import { coachDe, empresaDeCoach, SinPermiso } from "@/lib/permisos";

export const dynamic = "force-dynamic";

// El equipo de la empresa y sus invitaciones. Todas sus coaches ven el
// equipo; la dueña invita coaches y el equipo de Merkatics invita empresas nuevas.
export const GET = manejar(async (req: Request) => {
  const coach = await coachDe(req);
  return Response.json(
    await consultar((a) => ({
      equipo: (a.cuentas ?? [])
        .filter((c) => c.rol === "coach" && c.empresa === coach.empresa)
        .map((c) => ({ nombre: c.nombre, correo: c.correo, dueno: c.rolEmpresa === "dueno" })),
      invitaciones: (a.invitaciones ?? [])
        .filter((i) => vigente(i))
        .filter((i) => (i.tipo === "coach" ? coach.dueno && i.empresa === coach.empresa : coach.cuenta.admin === true))
        .map(({ codigo, tipo, nombreEmpresa, creadaPor, creadaEn, venceEn }) => ({
          codigo,
          tipo,
          nombreEmpresa,
          creadaPor,
          creadaEn,
          venceEn,
        })),
    })),
  );
});

// Nueva invitación: { tipo: "coach" } (la dueña, a su empresa) o
// { tipo: "empresa", nombreEmpresa? } (el equipo de Merkatics).
export const POST = manejar(async (req: Request) => {
  const coach = await coachDe(req);
  const datos = await leerJson(req);
  const tipo = datos.tipo === "empresa" ? "empresa" : "coach";
  if (tipo === "empresa" && !coach.cuenta.admin) throw new SinPermiso("Solo el equipo de Merkatics invita empresas nuevas.");
  const nombreEmpresa = typeof datos.nombreEmpresa === "string" ? datos.nombreEmpresa.trim().slice(0, 60) : "";
  if (nombreEmpresa.includes("�")) throw new ErrorDeDatos("El nombre tiene caracteres que no se pudieron leer.");
  const invitacion = await modificar((a) => {
    if (tipo === "coach") empresaDeCoach(a, coach, { dueno: true });
    return nuevaInvitacion(a, {
      tipo,
      ...(tipo === "coach" ? { empresa: coach.empresa } : nombreEmpresa ? { nombreEmpresa } : {}),
      creadaPor: coach.nombre,
    });
  });
  return Response.json(invitacion, { status: 201 });
});

// Cancela una invitación sin usar (?codigo=).
export const DELETE = manejar(async (req: Request) => {
  const coach = await coachDe(req);
  const codigo = new URL(req.url).searchParams.get("codigo");
  const quitada = await modificar((a) => {
    const i = (a.invitaciones ?? []).find((x) => x.codigo === codigo && vigente(x));
    if (!i) return false;
    const puede = i.tipo === "coach" ? coach.dueno && i.empresa === coach.empresa : coach.cuenta.admin === true;
    if (!puede) throw new SinPermiso("Esta invitación no es tuya.");
    a.invitaciones = (a.invitaciones ?? []).filter((x) => x !== i);
    return true;
  });
  return quitada ? new Response(null, { status: 204 }) : error("No encontramos esa invitación.", 404);
});
