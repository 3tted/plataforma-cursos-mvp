import { consultar, modificar } from "@/lib/almacen";
import { leerDocumento } from "@/lib/curso-ia";
import { ErrorDeDatos, manejar } from "@/lib/http";
import { coachDe, conPermiso } from "@/lib/permisos";
import { borrarDocumento, guardarDocumento, tallerDeCoach } from "@/lib/taller";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

// El documento del curso en preparación (PDF, Word o texto, hasta 4 MB). La
// IA lo lee cada vez que la coach le escribe. Uno nuevo reemplaza al anterior.
export const POST = manejar((req: Request, contexto: Contexto) =>
  conPermiso(async () => {
    const { id } = await contexto.params;
    const coach = await coachDe(req);
    const forma = await req.formData().catch(() => {
      throw new ErrorDeDatos("No recibimos el documento. Inténtalo de nuevo.");
    });
    const archivo = forma.get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) throw new ErrorDeDatos("Elige tu documento.");
    const actual = await consultar((a) => tallerDeCoach(a, id, coach));
    const documento = await guardarDocumento(actual, await leerDocumento(archivo));
    const t = await modificar((a) => {
      const t = tallerDeCoach(a, id, coach);
      t.documento = documento;
      t.actualizadoEn = new Date().toISOString();
      return t;
    });
    return Response.json(t);
  }),
);

export const DELETE = manejar((req: Request, contexto: Contexto) =>
  conPermiso(async () => {
    const { id } = await contexto.params;
    const coach = await coachDe(req);
    const t = await modificar((a) => {
      const t = tallerDeCoach(a, id, coach);
      delete t.documento;
      t.actualizadoEn = new Date().toISOString();
      return t;
    });
    await borrarDocumento(t);
    return Response.json(t);
  }),
);
