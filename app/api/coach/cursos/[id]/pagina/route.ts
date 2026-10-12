import { modificar } from "@/lib/almacen";
import { ErrorDeDatos, leerJson, manejar } from "@/lib/http";
import { coachDe, conPermiso, cursoDeCoach } from "@/lib/permisos";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

// Sube un borrador a la página sin publicarlo ({ enPagina: true }): la coach
// lo ve dentro de su comunidad tal como lo verá el alumno y ahí le sube los
// videos o las presentaciones. Los alumnos no lo ven hasta que lo publica.
// Con { enPagina: false } vuelve a quedar solo en el editor.
export const POST = manejar((req: Request, contexto: Contexto) =>
  conPermiso(async () => {
    const { id } = await contexto.params;
    const datos = await leerJson(req);
    const autor = coachDe(req, datos.autor);
    const enPagina = datos.enPagina !== false;
    const curso = await modificar((a) => {
      const c = cursoDeCoach(a, id, autor);
      if (enPagina) {
        const faltan = [
          !c.comunidad && "elige en qué comunidad va",
          !c.titulo && "ponle un título",
          !c.modulos.some((m) => m.lecciones.some((l) => l.titulo)) && "agrega al menos una lección con título",
        ].filter(Boolean);
        if (faltan.length) throw new ErrorDeDatos(`Para subirlo a la página, ${faltan.join(", ")}.`);
      }
      c.enPagina = enPagina;
      c.actualizadoEn = new Date().toISOString();
      return c;
    });
    return Response.json(curso);
  }),
);
