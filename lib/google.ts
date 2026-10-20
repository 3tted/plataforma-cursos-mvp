// Entrar con Google (OAuth 2.0 con código de autorización). Funciona cuando
// el servidor tiene GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET (las credenciales
// se crean en Google Cloud; la dirección de regreso autorizada es
// <sitio>/api/auth/google/callback). Sin ellas, el botón no aparece.

const AUTORIZAR = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const PERFIL = "https://openidconnect.googleapis.com/v1/userinfo";

/** Solo rutas de esta misma plataforma ("/algo"), nunca otro sitio. */
export const rutaPropia = (valor: string | null) => (valor && /^\/(?!\/)[^\s\\]*$/.test(valor) ? valor : "/");

export const googleConfigurado = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const regresoDeGoogle = (origen: string) => `${origen}/api/auth/google/callback`;

export function urlDeGoogle(origen: string, estado: string): string {
  const url = new URL(AUTORIZAR);
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: regresoDeGoogle(origen),
    response_type: "code",
    scope: "openid email profile",
    state: estado,
    prompt: "select_account",
  }).toString();
  return url.toString();
}

export interface PerfilGoogle {
  sub: string;
  correo: string;
  nombre: string;
}

/** Cambia el código que manda Google por el perfil de la persona (solo con correo verificado). */
export async function perfilDeGoogle(origen: string, codigo: string): Promise<PerfilGoogle | null> {
  const token = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: codigo,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: regresoDeGoogle(origen),
      grant_type: "authorization_code",
    }),
  });
  if (!token.ok) return null;
  const { access_token } = (await token.json()) as { access_token?: string };
  if (!access_token) return null;
  const res = await fetch(PERFIL, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!res.ok) return null;
  const p = (await res.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string };
  if (!p.sub || !p.email || p.email_verified !== true) return null;
  const correo = p.email.toLowerCase();
  return { sub: p.sub, correo, nombre: (p.name ?? "").trim().slice(0, 60) || correo.split("@")[0] };
}
