import { modificar } from "@/lib/almacen";
import { manejar } from "@/lib/http";
import { coachDe, conPermiso, exigirEmpresaActiva } from "@/lib/permisos";
import { borrarDocumento, crearCurso, soltarVideo, tallerDeCoach } from "@/lib/taller";
import { borrarArchivoDeVideo } from "@/lib/videos";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

// «Crear curso»: el curso en preparación se vuelve un borrador del editor de
// siempre. Los videos que usa pasan a sus lecciones; los demás se borran.
export const POST = manejar((req: Request, contexto: Contexto) =>
  conPermiso(async () => {
    const { id } = await contexto.params;
    const coach = await coachDe(req);
    const { curso, sueltas, sobran, taller } = await modificar((a) => {
      exigirEmpresaActiva(a, coach);
      const taller = tallerDeCoach(a, id, coach);
      return { ...crearCurso(a, taller, coach), taller };
    });
    await Promise.all(taller.videos.map(soltarVideo));
    await Promise.all(sobran.map(borrarArchivoDeVideo));
    await borrarDocumento(taller);
    const aviso = sueltas
      ? `${sueltas} ${sueltas === 1 ? "pregunta incompleta no se pasó" : "preguntas incompletas no se pasaron"} al curso (les faltaba el enunciado o la respuesta correcta).`
      : null;
    return Response.json({ id: curso.id, aviso }, { status: 201 });
  }),
);
