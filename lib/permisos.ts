import type { Almacen } from "./almacen";
import { EMPRESA_MERKATICS } from "./cuentas";
import { cursoDeLeccion, cargarCurso, idCurso } from "./curso";
import { ErrorDeDatos, SinPermiso, SinSesion } from "./http";
import { cuentaDe } from "./sesion";
import type { ComunidadCreada, Cuenta, CursoCreado, DatosCurso, Empresa } from "./tipos";

// Permisos: el servidor sabe quién hace cada petición por su sesión (cookie),
// nunca por lo que diga el navegador. Las coaches solo manejan lo de su
// empresa: sus comunidades, sus cursos y sus alumnos. Las comunidades de
// ejemplo son de la empresa Merkatics.

export { SinPermiso, SinSesion };

/** La coach con sesión abierta y su empresa. */
export interface Coach {
  cuenta: Cuenta;
  nombre: string;
  empresa: string;
  /** Dueña de la empresa: cambia la marca e invita coaches. */
  dueno: boolean;
}

/** La cuenta con sesión abierta (o un 401 si no hay). */
export async function cuentaDeReq(req: Request): Promise<Cuenta> {
  const cuenta = await cuentaDe(req);
  if (!cuenta) throw new SinSesion("Entra a tu cuenta para continuar.");
  return cuenta;
}

export function comoCoach(cuenta: Cuenta): Coach {
  if (cuenta.rol !== "coach" || !cuenta.empresa) throw new SinPermiso("Esta acción es solo para coaches.");
  return { cuenta, nombre: cuenta.nombre, empresa: cuenta.empresa, dueno: cuenta.rolEmpresa === "dueno" };
}

/** La coach que hace la petición (o un error si no es coach). */
export async function coachDe(req: Request): Promise<Coach> {
  return comoCoach(await cuentaDeReq(req));
}

/** La coach que hace la petición, o null si quien pide no es coach (para lo que también ven los alumnos). */
export async function coachOpcional(req: Request): Promise<Coach | null> {
  const cuenta = await cuentaDe(req);
  return cuenta?.rol === "coach" && cuenta.empresa ? comoCoach(cuenta) : null;
}

/** La empresa dueña de un curso ya cargado (las comunidades de ejemplo son de Merkatics). */
export const empresaDeDatos = (d: DatosCurso) => d.comunidad.empresa ?? EMPRESA_MERKATICS;

/** La empresa dueña de una comunidad (creada o de ejemplo). */
export function empresaDeComunidad(a: Almacen, id: string): string {
  return (a.comunidadesCoach ?? []).find((c) => c.id === id)?.empresa ?? EMPRESA_MERKATICS;
}

export function comunidadDeCoach(a: Almacen, id: unknown, coach: Coach): ComunidadCreada {
  const c = (a.comunidadesCoach ?? []).find((x) => x.id === id);
  if (!c) throw new ErrorDeDatos("No encontramos esa comunidad.");
  if ((c.empresa ?? EMPRESA_MERKATICS) !== coach.empresa) throw new SinPermiso("Esta comunidad es de otra empresa.");
  return c;
}

/** La empresa de la coach; con `dueno`, solo si la coach es su dueña. */
export function empresaDeCoach(a: Almacen, coach: Coach, { dueno = false } = {}): Empresa {
  const e = (a.empresas ?? []).find((x) => x.id === coach.empresa);
  if (!e) throw new ErrorDeDatos("No encontramos tu empresa.");
  if (dueno && !coach.dueno) throw new SinPermiso("Solo la dueña de la empresa puede hacer esto.");
  return e;
}

export function cursoDeCoach(a: Almacen, id: unknown, coach: Coach): CursoCreado {
  const c = (a.cursosCoach ?? []).find((x) => x.id === id);
  if (!c) throw new ErrorDeDatos("No encontramos ese curso.");
  const empresa = c.empresa ?? (c.comunidad ? empresaDeComunidad(a, c.comunidad) : EMPRESA_MERKATICS);
  if (empresa !== coach.empresa) throw new SinPermiso("Este curso es de otra empresa.");
  return c;
}

/** La comunidad a la que va un curso nuevo o movido: "" (ninguna todavía) o una de la empresa. */
export function destinoDeCurso(a: Almacen, id: unknown, coach: Coach): string {
  if (id === undefined || id === null || id === "") return "";
  return comunidadDeCoach(a, id, coach).id;
}

/** Que la comunidad (creada o de ejemplo) sea de la empresa de la coach. */
export function exigirComunidad(a: Almacen, comunidad: string, coach: Coach): void {
  if (empresaDeComunidad(a, comunidad) !== coach.empresa) throw new SinPermiso("Esta comunidad es de otra empresa.");
}

/** La coach que pide y el curso (con borradores), si el curso es de su empresa. */
export async function coachDelCurso(req: Request, curso: unknown): Promise<{ coach: Coach; datos: DatosCurso }> {
  const coach = await coachDe(req);
  const datos = await cargarCurso(await idCurso(curso, { borradores: true }), { borradores: true });
  if (empresaDeDatos(datos) !== coach.empresa) throw new SinPermiso("Este curso es de otra empresa.");
  return { coach, datos };
}

/** La coach que pide, si la lección es de un curso de su empresa. */
export async function coachDeLaLeccion(req: Request, leccion: string): Promise<{ coach: Coach; datos: DatosCurso }> {
  const coach = await coachDe(req);
  const datos = await cursoDeLeccion(leccion, { borradores: true });
  if (!datos) throw new ErrorDeDatos("No encontramos esa lección.");
  if (empresaDeDatos(datos) !== coach.empresa) throw new SinPermiso("Esta lección es de otra empresa.");
  return { coach, datos };
}

/** Convierte los errores de sesión y de permiso en 401 y 403 para quien llama. */
export async function conPermiso(accion: () => Promise<Response>): Promise<Response> {
  try {
    return await accion();
  } catch (e) {
    if (e instanceof SinSesion) return Response.json({ error: e.message }, { status: 401 });
    if (e instanceof SinPermiso) return Response.json({ error: e.message }, { status: 403 });
    throw e;
  }
}
