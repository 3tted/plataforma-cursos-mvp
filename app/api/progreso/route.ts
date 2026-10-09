import { consultar, modificar } from "@/lib/almacen";
import { cargarCursos } from "@/lib/curso";
import { completadasDe, leccionesDelCurso } from "@/lib/evaluaciones";
import { ErrorDeDatos, error, leerJson, manejar, texto } from "@/lib/http";

export const dynamic = "force-dynamic";

// Lecciones completadas de cada alumno. El navegador las recuerda y aquí se
// guarda una copia para que la coach vea el avance de todos y para que el
// alumno lo recupere al volver a entrar. En el MVP se identifica por nombre.
export const GET = manejar(async (req: Request) => {
  const autor = new URL(req.url).searchParams.get("autor")?.trim();
  if (!autor) return error("Falta el nombre del alumno.");
  return Response.json({ completadas: await consultar((a) => completadasDe(a, autor)) });
});

export const POST = manejar(async (req: Request) => {
  const datos = await leerJson(req);
  const autor = texto(datos.autor, "autor", 60);
  if (!Array.isArray(datos.completadas)) throw new ErrorDeDatos('Falta el campo "completadas".');
  const validas = new Set(
    (await cargarCursos()).flatMap((c) => leccionesDelCurso(c).flatMap((m) => m.lecciones.map((l) => l.id))),
  );
  const completadas = [...new Set(datos.completadas.filter((id): id is string => typeof id === "string" && validas.has(id)))];

  await modificar((a) => {
    a.progreso ??= [];
    const actual = a.progreso.find((p) => p.autor === autor);
    const actualizado = new Date().toISOString();
    if (actual) Object.assign(actual, { completadas, actualizado });
    else a.progreso.push({ autor, completadas, actualizado });
  });
  return Response.json({ completadas });
});
