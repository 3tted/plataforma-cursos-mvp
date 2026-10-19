import type { Almacen } from "./almacen";
import { ErrorDeDatos } from "./http";
import type { ComunidadCreada, CursoCreado, Empresa } from "./tipos";

// Permisos del MVP: la coach se identifica con el encabezado X-Rol y su
// nombre. En la Fase 2 los da la sesión de su cuenta.

export class SinPermiso extends Error {}

/** La coach que hace la petición (o un error si no es coach). */
export function coachDe(req: Request, autor: unknown): string {
  if (req.headers.get("x-rol") !== "coach") throw new SinPermiso("Esta acción es solo para coaches.");
  const nombre = typeof autor === "string" ? autor.trim() : "";
  if (!nombre) throw new ErrorDeDatos("Falta el nombre de la coach.");
  return nombre;
}

export function comunidadDeCoach(a: Almacen, id: unknown, autor: string): ComunidadCreada {
  const c = (a.comunidadesCoach ?? []).find((x) => x.id === id);
  if (!c) throw new ErrorDeDatos("No encontramos esa comunidad.");
  if (c.autor !== autor) throw new SinPermiso("Esta comunidad es de otra coach.");
  return c;
}

export function empresaDeCoach(a: Almacen, id: unknown, autor: string): Empresa {
  const e = (a.empresas ?? []).find((x) => x.id === id);
  if (!e) throw new ErrorDeDatos("Primero guarda tu empresa para poder subir su logo.");
  if (e.dueno !== autor) throw new SinPermiso("Esta empresa es de otra coach.");
  return e;
}

export function cursoDeCoach(a: Almacen, id: unknown, autor: string): CursoCreado {
  const c = (a.cursosCoach ?? []).find((x) => x.id === id);
  if (!c) throw new ErrorDeDatos("No encontramos ese curso.");
  if (c.autor !== autor) throw new SinPermiso("Este curso es de otra coach.");
  if (c.comunidad) comunidadDeCoach(a, c.comunidad, autor);
  return c;
}

/** La comunidad a la que va un curso nuevo o movido: "" (ninguna todavía) o una de la coach. */
export function destinoDeCurso(a: Almacen, id: unknown, autor: string): string {
  if (id === undefined || id === null || id === "") return "";
  return comunidadDeCoach(a, id, autor).id;
}

/** Convierte los errores de permiso en 403 para quien llama. */
export async function conPermiso(accion: () => Promise<Response>): Promise<Response> {
  try {
    return await accion();
  } catch (e) {
    if (e instanceof SinPermiso) return Response.json({ error: e.message }, { status: 403 });
    throw e;
  }
}
