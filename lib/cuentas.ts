import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { Almacen } from "./almacen";
import type { Cuenta, CuentaPublica, Empresa, Rol, RolEmpresa } from "./tipos";

// Cuentas de la plataforma: correo y contraseña (cifrada con scrypt) o Google.
// El nombre de cada cuenta no se repite, porque es con el que se firma lo que
// hace (publicaciones, avance, cursos); así los datos de antes de las cuentas
// siguen siendo de la misma persona.

const scryptAsync = promisify(scrypt) as (clave: string, sal: string, largo: number) => Promise<Buffer>;

/** La empresa de las comunidades de ejemplo (Finanzas Claras, Vende por WhatsApp). */
export const EMPRESA_MERKATICS = "merkatics";

// ---------------------------------------------------------------- cuentas de demostración

/**
 * Contraseña de las cuentas de demostración. En el servidor se cambia con la
 * variable CONTRASENA_DEMO, y con CUENTAS_DEMO=0 dejan de funcionar.
 */
const CONTRASENA_DEMO_DEL_PROYECTO = "merkatics-demo";

export function contrasenaDemo(): string | null {
  if (process.env.CUENTAS_DEMO === "0") return null;
  return process.env.CONTRASENA_DEMO || CONTRASENA_DEMO_DEL_PROYECTO;
}

/** La pantalla de entrada la muestra solo si es la del proyecto: si se cambió en el servidor, es privada. */
export function contrasenaDemoPublica(): string | null {
  return process.env.CUENTAS_DEMO === "0" || process.env.CONTRASENA_DEMO ? null : CONTRASENA_DEMO_DEL_PROYECTO;
}

/** Cuentas ficticias para presentar la plataforma. Correos de example.com (reservado, no llega a nadie). */
export const CUENTAS_DEMO: { nombre: string; correo: string; rol: Rol; rolEmpresa?: RolEmpresa; admin?: boolean; detalle: string }[] = [
  {
    nombre: "Equipo Merkatics",
    correo: "equipo@example.com",
    rol: "coach",
    rolEmpresa: "dueno",
    admin: true,
    detalle: "Dueña de la empresa Merkatics; invita empresas nuevas",
  },
  {
    nombre: "Daniela Ortega",
    correo: "daniela.ortega@example.com",
    rol: "coach",
    rolEmpresa: "coach",
    detalle: "Coach de Finanzas Claras",
  },
  {
    nombre: "Mariana Ibarra",
    correo: "mariana.ibarra@example.com",
    rol: "coach",
    rolEmpresa: "coach",
    detalle: "Coach de Vende por WhatsApp",
  },
  { nombre: "Lucía Herrera", correo: "lucia.herrera@example.com", rol: "alumno", detalle: "Alumna" },
];

// ---------------------------------------------------------------- utilidades

export const slug = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "empresa";

/** Para comparar nombres sin importar mayúsculas, acentos ni espacios de más. */
const clave = (nombre: string) => slug(nombre.trim());

export const normalizarCorreo = (correo: unknown) => (typeof correo === "string" ? correo.trim().toLowerCase() : "");
export const correoValido = (correo: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) && correo.length <= 120;

export const MIN_CONTRASENA = 8;

export function cuentaPorNombre(a: Almacen, nombre: string): Cuenta | undefined {
  const buscada = clave(nombre);
  return (a.cuentas ?? []).find((c) => clave(c.nombre) === buscada);
}

export function cuentaPorCorreo(a: Almacen, correo: string): Cuenta | undefined {
  return (a.cuentas ?? []).find((c) => c.correo === correo);
}

export const nuevoIdCuenta = () => `u_${randomBytes(9).toString("base64url")}`;

/** Un id de empresa que no se repite, a partir de su nombre. */
export function idEmpresaLibre(a: Almacen, nombre: string): string {
  const base = slug(nombre);
  let id = base;
  for (let n = 2; (a.empresas ?? []).some((e) => e.id === id); n++) id = `${base}-${n}`;
  return id;
}

/** Un nombre que no usa otra cuenta: si ya existe, se le agrega un número. */
export function nombreLibre(a: Almacen, nombre: string): string {
  let libre = nombre;
  for (let n = 2; cuentaPorNombre(a, libre); n++) libre = `${nombre} ${n}`;
  return libre;
}

export async function cifrarContrasena(contrasena: string): Promise<{ sal: string; hash: string }> {
  const sal = randomBytes(16).toString("base64");
  return { sal, hash: (await scryptAsync(contrasena, sal, 64)).toString("base64") };
}

/** ¿La contraseña es la de la cuenta? Las de demo sin contraseña propia usan la de demostración. */
export async function contrasenaCorrecta(cuenta: Cuenta, contrasena: string): Promise<boolean> {
  if (cuenta.contrasena) {
    const guardado = Buffer.from(cuenta.contrasena.hash, "base64");
    const calculado = await scryptAsync(contrasena, cuenta.contrasena.sal, 64);
    return calculado.length === guardado.length && timingSafeEqual(calculado, guardado);
  }
  const demo = contrasenaDemo();
  if (!cuenta.demo || !demo) return false;
  const a = Buffer.from(contrasena);
  const b = Buffer.from(demo);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function cuentaPublica(c: Cuenta): CuentaPublica {
  return {
    nombre: c.nombre,
    correo: c.correo,
    rol: c.rol,
    ...(c.empresa ? { empresa: c.empresa } : {}),
    dueno: c.rolEmpresa === "dueno",
    admin: c.admin === true,
    conContrasena: !!c.contrasena,
    conGoogle: !!c.google,
    demo: c.demo === true && !c.contrasena,
    ...(c.bio ? { bio: c.bio } : {}),
    desde: c.creadaEn,
  };
}

// ---------------------------------------------------------------- paso a cuentas

/**
 * Los almacenes de antes del login no tienen cuentas. La primera vez se crean
 * las de demostración y una cuenta de demo para cada coach que ya tenía
 * comunidades o cursos (con su empresa), para que nada se quede sin dueña.
 * Cada comunidad y cada curso queda anotado con su empresa.
 */
export function migrarACuentas(a: Almacen): boolean {
  if (a.cuentas) return false;
  const ahora = new Date().toISOString();
  a.cuentas = [];
  a.sesiones = [];
  a.invitaciones ??= [];
  a.empresas ??= [];

  const empresa = (id: string, nombre: string, dueno: string): Empresa => {
    const nueva: Empresa = { id, dueno, nombre, creadaEn: ahora, actualizadaEn: ahora };
    a.empresas!.push(nueva);
    return nueva;
  };
  const merkatics =
    a.empresas.find((e) => e.id === EMPRESA_MERKATICS) ?? empresa(EMPRESA_MERKATICS, "Merkatics", "Equipo Merkatics");

  for (const d of CUENTAS_DEMO) {
    a.cuentas.push({
      id: nuevoIdCuenta(),
      correo: d.correo,
      nombre: d.nombre,
      rol: d.rol,
      ...(d.rol === "coach" ? { empresa: merkatics.id, rolEmpresa: d.rolEmpresa ?? "coach" } : {}),
      ...(d.admin ? { admin: true } : {}),
      demo: true,
      creadaEn: ahora,
    });
  }

  // Las coaches que ya crearon algo: cada una, dueña de su empresa.
  const autores = new Set([
    ...(a.comunidadesCoach ?? []).map((c) => c.autor),
    ...(a.cursosCoach ?? []).map((c) => c.autor),
    ...a.empresas.filter((e) => e.id !== merkatics.id).map((e) => e.dueno),
  ]);
  for (const autor of autores) {
    if (cuentaPorNombre(a, autor)) continue;
    const suya = a.empresas.find((e) => e.dueno === autor) ?? empresa(idEmpresaLibre(a, autor), autor, autor);
    const base = slug(autor).replace(/-/g, ".");
    let correo = `${base}@example.com`;
    for (let n = 2; cuentaPorCorreo(a, correo); n++) correo = `${base}${n}@example.com`;
    a.cuentas.push({
      id: nuevoIdCuenta(),
      correo,
      nombre: autor,
      rol: "coach",
      empresa: suya.id,
      rolEmpresa: "dueno",
      demo: true,
      creadaEn: ahora,
    });
  }

  const empresaDe = (autor: string) => cuentaPorNombre(a, autor)?.empresa ?? merkatics.id;
  for (const c of a.comunidadesCoach ?? []) c.empresa ??= empresaDe(c.autor);
  for (const c of a.cursosCoach ?? []) c.empresa ??= empresaDe(c.autor);
  return true;
}
