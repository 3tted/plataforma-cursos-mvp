import { modificar } from "@/lib/almacen";
import { cuentaPorCorreo, nombreLibre, nuevoIdCuenta } from "@/lib/cuentas";
import { perfilDeGoogle, rutaPropia } from "@/lib/google";
import { ErrorDeDatos } from "@/lib/http";
import { aceptarInvitacion, invitacionVigente } from "@/lib/invitaciones";
import { abrirSesion, cookie, cookieDeSesion, leerCookie } from "@/lib/sesion";
import type { Cuenta } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// Regreso de Google: con el perfil verificado se entra a la cuenta de ese
// Google o de ese correo; si no hay, se crea (de alumno, o de coach con una
// invitación). Cualquier problema regresa a la plataforma con un aviso (?google=).
export async function GET(req: Request) {
  const url = new URL(req.url);
  let recuerdo: { estado?: string; invitacion?: string; volver?: string } | null = null;
  try {
    recuerdo = JSON.parse(leerCookie(req, "mk_google") ?? "");
  } catch {
    recuerdo = null;
  }
  const volver = rutaPropia(recuerdo?.volver ?? null);
  const irA = (destino: URL, ...cookies: string[]) => {
    const h = new Headers({ Location: destino.toString() });
    for (const c of [...cookies, cookie(req, "mk_google", "", 0)]) h.append("Set-Cookie", c);
    return new Response(null, { status: 302, headers: h });
  };
  const conAviso = (motivo: string) => {
    const destino = new URL(volver, url.origin);
    destino.searchParams.set("google", motivo);
    return irA(destino);
  };

  if (url.searchParams.get("error")) return conAviso("cancelado");
  const codigo = url.searchParams.get("code");
  if (!recuerdo?.estado || recuerdo.estado !== url.searchParams.get("state") || !codigo) return conAviso("fallo");

  const perfil = await perfilDeGoogle(url.origin, codigo).catch(() => null);
  if (!perfil) return conAviso("fallo");

  const invitacion = recuerdo.invitacion;
  let token: string;
  try {
    token = await modificar((a) => {
      let cuenta: Cuenta | undefined = a.cuentas?.find((c) => c.google === perfil.sub) ?? cuentaPorCorreo(a, perfil.correo);
      if (!cuenta) {
        cuenta = {
          id: nuevoIdCuenta(),
          correo: perfil.correo,
          nombre: nombreLibre(a, perfil.nombre),
          rol: "alumno",
          creadaEn: new Date().toISOString(),
        };
        a.cuentas = [...(a.cuentas ?? []), cuenta];
      }
      cuenta.google ??= perfil.sub;
      if (invitacion && cuenta.rol !== "coach") aceptarInvitacion(a, invitacionVigente(a, invitacion), cuenta);
      return abrirSesion(a, cuenta.id);
    });
  } catch (e) {
    if (e instanceof ErrorDeDatos) return conAviso("invitacion");
    throw e;
  }
  return irA(new URL(volver, url.origin), cookieDeSesion(req, token));
}
