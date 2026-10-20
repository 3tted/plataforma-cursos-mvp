import { createHash, randomBytes } from "crypto";
import { consultar, type Almacen } from "./almacen";
import type { Cuenta } from "./tipos";

// Sesiones: al entrar, el servidor da un token al azar que el navegador guarda
// en una cookie HttpOnly (ningún script de la página la puede leer). En el
// almacén solo queda su huella SHA-256, así que copiar el almacén no sirve
// para entrar. "Salir" borra la sesión.

const COOKIE = "mk_sesion";
const DURACION_MS = 30 * 24 * 3_600_000;
const MAX_SESIONES = 2000;

const huella = (token: string) => createHash("sha256").update(token).digest("hex");

/** Lee una cookie de la petición. */
export function leerCookie(req: Request, nombre: string): string | null {
  for (const parte of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nombre) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** La huella de la sesión que trae la petición (o null si no trae). */
export function huellaDe(req: Request): string | null {
  const token = leerCookie(req, COOKIE);
  return token ? huella(token) : null;
}

/** La cuenta de una sesión vigente, dentro de una lectura o un cambio del almacén. */
export function cuentaEn(a: Almacen, huellaSesion: string | null): Cuenta | null {
  if (!huellaSesion) return null;
  const s = (a.sesiones ?? []).find((x) => x.huella === huellaSesion);
  if (!s || Date.parse(s.venceEn) <= Date.now()) return null;
  return (a.cuentas ?? []).find((c) => c.id === s.cuenta) ?? null;
}

/** La cuenta con sesión abierta en esta petición, o null. */
export async function cuentaDe(req: Request): Promise<Cuenta | null> {
  const h = huellaDe(req);
  return h ? consultar((a) => cuentaEn(a, h)) : null;
}

/** Abre una sesión (dentro de un cambio del almacén) y devuelve el token para la cookie. */
export function abrirSesion(a: Almacen, cuenta: string): string {
  const ahora = Date.now();
  const token = randomBytes(32).toString("base64url");
  a.sesiones = (a.sesiones ?? []).filter((s) => Date.parse(s.venceEn) > ahora).slice(-(MAX_SESIONES - 1));
  a.sesiones.push({
    huella: huella(token),
    cuenta,
    creadaEn: new Date(ahora).toISOString(),
    venceEn: new Date(ahora + DURACION_MS).toISOString(),
  });
  return token;
}

/** Cierra la sesión de la petición (dentro de un cambio del almacén). */
export function cerrarSesionEn(a: Almacen, huellaSesion: string | null): void {
  if (huellaSesion) a.sesiones = (a.sesiones ?? []).filter((s) => s.huella !== huellaSesion);
}

/** Cierra todas las sesiones de una cuenta menos la actual (al cambiar la contraseña). */
export function cerrarOtrasSesiones(a: Almacen, cuenta: string, actual: string | null): void {
  a.sesiones = (a.sesiones ?? []).filter((s) => s.cuenta !== cuenta || s.huella === actual);
}

const segura = (req: Request) =>
  new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";

export function cookie(req: Request, nombre: string, valor: string, maxAgeSegundos: number): string {
  return [
    `${nombre}=${encodeURIComponent(valor)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSegundos}`,
    ...(segura(req) ? ["Secure"] : []),
  ].join("; ");
}

export const cookieDeSesion = (req: Request, token: string) => cookie(req, COOKIE, token, DURACION_MS / 1000);
export const cookieSinSesion = (req: Request) => cookie(req, COOKIE, "", 0);
