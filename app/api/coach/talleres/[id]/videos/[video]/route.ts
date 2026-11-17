import { consultar, modificar } from "@/lib/almacen";
import { videoConIA } from "@/lib/curso-video";
import { ErrorDeDatos, manejar } from "@/lib/http";
import { coachDe, conPermiso, type Coach } from "@/lib/permisos";
import { avanzarVideo, soltarVideo, tallerDeCoach } from "@/lib/taller";
import type { Almacen } from "@/lib/almacen";
import type { VideoTaller } from "@/lib/tipos";
import { borrarArchivoDeVideo } from "@/lib/videos";

export const dynamic = "force-dynamic";
// Ver un video largo y anotarlo puede tardar un par de minutos.
export const maxDuration = 300;

type Contexto = { params: Promise<{ id: string; video: string }> };

function videoDe(a: Almacen, id: string, video: string, coach: Coach): VideoTaller {
  const v = tallerDeCoach(a, id, coach).videos.find((x) => x.id === video);
  if (!v) throw new ErrorDeDatos("Ese video ya no está en el curso.");
  return v;
}

// Un paso de la IA viendo el video (la pantalla lo llama hasta que queda
// listo). Si algo falla, el video queda con su error y la coach reintenta.
export const POST = manejar((req: Request, contexto: Contexto) =>
  conPermiso(async () => {
    const { id, video } = await contexto.params;
    const coach = await coachDe(req);
    const v = await consultar((a) => videoDe(a, id, video, coach));
    let cambio: Partial<VideoTaller>;
    try {
      if (!videoConIA()) throw new ErrorDeDatos("Para que la IA vea tus videos hace falta conectar Gemini (GEMINI_API_KEY).");
      cambio = await avanzarVideo(v);
    } catch (e) {
      if (!(e instanceof ErrorDeDatos)) throw e;
      cambio = { estado: "error", error: e.message };
    }
    const actualizado = await modificar((a) => {
      const x = videoDe(a, id, video, coach);
      Object.assign(x, cambio);
      for (const k of Object.keys(cambio) as (keyof VideoTaller)[]) if (cambio[k] === undefined) delete x[k];
      return x;
    });
    return Response.json(actualizado);
  }),
);

// La coach quita el video: las lecciones que lo usaban se quedan sin video.
export const DELETE = manejar((req: Request, contexto: Contexto) =>
  conPermiso(async () => {
    const { id, video } = await contexto.params;
    const coach = await coachDe(req);
    const { taller, quitado } = await modificar((a) => {
      const t = tallerDeCoach(a, id, coach);
      const quitado = videoDe(a, id, video, coach);
      t.videos = t.videos.filter((x) => x.id !== video);
      for (const l of t.borrador.lecciones) {
        if (l.video !== video) continue;
        delete l.video;
        delete l.inicio;
        delete l.fin;
      }
      t.actualizadoEn = new Date().toISOString();
      return { taller: t, quitado };
    });
    await soltarVideo(quitado);
    await borrarArchivoDeVideo(quitado);
    return Response.json(taller);
  }),
);
