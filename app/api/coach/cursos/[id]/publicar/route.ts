import { modificar } from "@/lib/almacen";
import { pendientesParaPublicar } from "@/lib/creacion";
import { leerJson, manejar } from "@/lib/http";
import { coachDe, conPermiso, cursoDeCoach } from "@/lib/permisos";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

// Publica o despublica un curso. Para publicar, el curso tiene que estar
// completo; si no, responde la lista de lo que falta.
export const POST = manejar((req: Request, contexto: Contexto) =>
  conPermiso(async () => {
    const { id } = await contexto.params;
    const datos = await leerJson(req);
    const autor = coachDe(req, datos.autor);
    const publicar = datos.publicar !== false;
    const resultado = await modificar((a) => {
      const curso = cursoDeCoach(a, id, autor);
      const faltan = publicar ? pendientesParaPublicar(curso) : [];
      if (faltan.length) return { faltan };
      curso.estado = publicar ? "publicado" : "borrador";
      // Al despublicarlo se queda en la página para la coach (sin que lo vean los alumnos).
      if (!publicar) curso.enPagina = true;
      curso.actualizadoEn = new Date().toISOString();
      return { curso };
    });
    if ("faltan" in resultado) {
      return Response.json({ error: "Al curso todavía le faltan cosas para publicarse.", faltan: resultado.faltan }, { status: 400 });
    }
    return Response.json(resultado.curso);
  }),
);
