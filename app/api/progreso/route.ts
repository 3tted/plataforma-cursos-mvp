import { consultar, modificar } from "@/lib/almacen";
import { cargarCursos } from "@/lib/curso";
import { completadasDe, leccionesDelCurso } from "@/lib/evaluaciones";
import { ErrorDeDatos, leerJson, manejar } from "@/lib/http";
import { cuentaDeReq } from "@/lib/permisos";

export const dynamic = "force-dynamic";

// Lecciones completadas de cada alumno. El navegador las recuerda y aquí se
// guarda una copia para que la coach vea el avance de todos y para que el
// alumno lo recupere al volver a entrar. Cada alumno guarda solo el suyo (por su sesión).
export const GET = manejar(async (req: Request) => {
  const autor = (await cuentaDeReq(req)).nombre;
  return Response.json(
    await consultar((a) => ({
      completadas: completadasDe(a, autor),
      fechas: a.progreso?.find((p) => p.autor === autor)?.fechas ?? {},
    })),
  );
});

export const POST = manejar(async (req: Request) => {
  const datos = await leerJson(req);
  const cuenta = await cuentaDeReq(req);
  const autor = cuenta.nombre;
  if (!Array.isArray(datos.completadas)) throw new ErrorDeDatos('Falta el campo "completadas".');
  const validas = new Set(
    (await cargarCursos()).flatMap((c) => leccionesDelCurso(c).flatMap((m) => m.lecciones.map((l) => l.id))),
  );
  const completadas = [...new Set(datos.completadas.filter((id): id is string => typeof id === "string" && validas.has(id)))];

  // Cada lección guarda la fecha en que se completó por primera vez (la que se
  // desmarca la pierde): con ella se abren las lecciones «al día siguiente».
  const fechas = await modificar((a) => {
    a.progreso ??= [];
    const actual = a.progreso.find((p) => p.autor === autor);
    const actualizado = new Date().toISOString();
    const antes = actual?.fechas ?? {};
    const fechas = Object.fromEntries(completadas.map((id) => [id, antes[id] ?? actualizado]));
    if (actual) Object.assign(actual, { completadas, actualizado, fechas });
    else a.progreso.push({ autor, completadas, actualizado, fechas });
    return fechas;
  });
  return Response.json({ completadas, fechas });
});
