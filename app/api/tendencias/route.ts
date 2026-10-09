import { consultar } from "@/lib/almacen";
import { cargarComunidades, cargarCursos } from "@/lib/curso";
import { manejar } from "@/lib/http";
import { alumnosDeCurso, miembrosDeComunidad } from "@/lib/tendencias";
import type { Tendencias } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// Lo que está en tendencia: cursos por alumnos y comunidades por miembros, de
// más a menos. El inicio destaca el primero de cada lista.
export const GET = manejar(async () => {
  const [cursos, comunidades] = await Promise.all([cargarCursos(), cargarComunidades()]);
  const tendencias = await consultar(
    (a): Tendencias => ({
      cursos: cursos
        .map((c) => ({ id: c.curso.id, alumnos: alumnosDeCurso(a, c) }))
        .sort((x, y) => y.alumnos - x.alumnos),
      comunidades: comunidades
        .map((c) => {
          const suyos = new Set(cursos.filter((x) => x.comunidad.id === c.id).map((x) => x.curso.id));
          return { id: c.id, miembros: miembrosDeComunidad(a, c.id, suyos) };
        })
        .sort((x, y) => y.miembros - x.miembros),
    }),
  );
  return Response.json(tendencias);
});
