import { consultar, modificar } from "@/lib/almacen";
import { cuentaPublica } from "@/lib/cuentas";
import { ErrorDeDatos, manejar } from "@/lib/http";
import { aceptarInvitacion, invitacionVigente, vigente } from "@/lib/invitaciones";
import { cuentaDeReq } from "@/lib/permisos";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ codigo: string }> };

// Lo que ve quien abre el enlace de una invitación (no necesita sesión).
export const GET = manejar(async (_req: Request, { params }: Contexto) => {
  const { codigo } = await params;
  return Response.json(
    await consultar((a) => {
      const i = (a.invitaciones ?? []).find((x) => x.codigo === codigo);
      if (!i) return { vigente: false };
      const empresa = (a.empresas ?? []).find((e) => e.id === i.empresa);
      return {
        vigente: vigente(i),
        tipo: i.tipo,
        empresa: i.tipo === "coach" ? (empresa?.nombre ?? null) : (i.nombreEmpresa ?? null),
        creadaPor: i.creadaPor,
      };
    }),
  );
});

// Acepta la invitación con la cuenta que tiene la sesión abierta.
export const POST = manejar(async (req: Request, { params }: Contexto) => {
  const { codigo } = await params;
  const cuenta = await cuentaDeReq(req);
  const actualizada = await modificar((a) => {
    const c = a.cuentas?.find((x) => x.id === cuenta.id);
    if (!c) throw new ErrorDeDatos("No encontramos tu cuenta.");
    aceptarInvitacion(a, invitacionVigente(a, codigo), c);
    return c;
  });
  return Response.json({ cuenta: cuentaPublica(actualizada) });
});
