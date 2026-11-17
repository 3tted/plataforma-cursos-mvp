import { consultar, modificar } from "@/lib/almacen";
import { videoConIA } from "@/lib/curso-video";
import { ErrorDeDatos, leerJson, manejar } from "@/lib/http";
import { coachDe, conPermiso } from "@/lib/permisos";
import { borradorLimpio, borrarDocumento, soltarVideo, tallerDeCoach } from "@/lib/taller";
import { borrarArchivoDeVideo } from "@/lib/videos";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

// Un curso en preparación: verlo (GET), guardar lo que la coach cambia a mano
// (PUT, con el borrador completo) o descartarlo (DELETE).

export const GET = manejar((req: Request, contexto: Contexto) =>
  conPermiso(async () => {
    const { id } = await contexto.params;
    const coach = await coachDe(req);
    // «ia»: si hay Gemini para platicar y ver los videos.
    return Response.json({ ...(await consultar((a) => tallerDeCoach(a, id, coach))), ia: !!videoConIA() });
  }),
);

export const PUT = manejar((req: Request, contexto: Contexto) =>
  conPermiso(async () => {
    const { id } = await contexto.params;
    const coach = await coachDe(req);
    const datos = await leerJson(req);
    if (!datos.borrador || typeof datos.borrador !== "object") throw new ErrorDeDatos("Falta el curso.");
    const t = await modificar((a) => {
      const t = tallerDeCoach(a, id, coach);
      t.borrador = borradorLimpio(t, datos.borrador);
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
      a.talleres = (a.talleres ?? []).filter((x) => x.id !== t.id);
      return t;
    });
    await Promise.all(t.videos.map(async (v) => (await soltarVideo(v), await borrarArchivoDeVideo(v))));
    await borrarDocumento(t);
    return new Response(null, { status: 204 });
  }),
);
