import { randomBytes } from "crypto";
import { googleConfigurado, rutaPropia, urlDeGoogle } from "@/lib/google";
import { cookie } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Manda a la persona a elegir su cuenta de Google. Lo que hay que recordar al
// regresar (el estado contra falsificaciones, la invitación y a dónde volver)
// viaja en una cookie que dura 10 minutos.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const volver = rutaPropia(url.searchParams.get("volver"));
  if (!googleConfigurado()) {
    const destino = new URL(volver, url.origin);
    destino.searchParams.set("google", "sin-configurar");
    return Response.redirect(destino, 302);
  }
  const estado = randomBytes(16).toString("base64url");
  const recuerdo = JSON.stringify({ estado, invitacion: url.searchParams.get("invitacion") ?? undefined, volver });
  return new Response(null, {
    status: 302,
    headers: { Location: urlDeGoogle(url.origin, estado), "Set-Cookie": cookie(req, "mk_google", recuerdo, 600) },
  });
}
