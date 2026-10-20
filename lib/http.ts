// Utilidades pequeñas para las rutas de la API.

export class ErrorDeDatos extends Error {}
/** Sin sesión abierta (401). */
export class SinSesion extends Error {}
/** Con sesión, pero sin permiso para eso (403). */
export class SinPermiso extends Error {}

export function error(mensaje: string, status = 400): Response {
  return Response.json({ error: mensaje }, { status });
}

export async function leerJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const cuerpo = await req.json();
    if (cuerpo && typeof cuerpo === "object" && !Array.isArray(cuerpo)) {
      return cuerpo as Record<string, unknown>;
    }
  } catch {
    // cae al error de abajo
  }
  throw new ErrorDeDatos("El cuerpo de la petición debe ser un objeto JSON.");
}

export function texto(valor: unknown, campo: string, maximo: number): string {
  const limpio = typeof valor === "string" ? valor.trim() : "";
  if (!limpio) throw new ErrorDeDatos(`Falta el campo "${campo}".`);
  // "�" aparece cuando el texto llegó con otra codificación (no UTF-8).
  if (limpio.includes("�")) {
    throw new ErrorDeDatos(`"${campo}" tiene caracteres que no se pudieron leer. Escríbelo de nuevo.`);
  }
  if (limpio.length > maximo) {
    throw new ErrorDeDatos(`"${campo}" es demasiado largo (máximo ${maximo} caracteres).`);
  }
  return limpio;
}

export function idNumerico(valor: string): number {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new ErrorDeDatos("Identificador no válido.");
  return id;
}

// Envuelve un manejador para convertir los errores de validación en 400 y los de sesión y permiso en 401 y 403.
export function manejar<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ErrorDeDatos) return error(e.message);
      if (e instanceof SinSesion) return error(e.message, 401);
      if (e instanceof SinPermiso) return error(e.message, 403);
      console.error(e);
      return error("Error interno del servidor.", 500);
    }
  };
}
