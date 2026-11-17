import { modificar } from "@/lib/almacen";
import { ErrorDeDatos, manejar } from "@/lib/http";
import { coachDe, conPermiso } from "@/lib/permisos";
import { tallerDeCoach } from "@/lib/taller";
import type { VideoTaller } from "@/lib/tipos";
import { PREFIJO_TALLER, borrarArchivoDeVideo, recibirVideo } from "@/lib/videos";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

// Un video nuevo del curso en preparación: llega como el de una lección (con
// Vercel Blob el navegador lo sube directo y aquí solo se anota). Responde con
// el video; la pantalla lo pone en la lección que la coach eligió.
export const PUT = manejar((req: Request, contexto: Contexto) =>
  conPermiso(async () => {
    const { id } = await contexto.params;
    const coach = await coachDe(req);
    const recibido = await recibirVideo(req, "taller", PREFIJO_TALLER);
    if (recibido instanceof Response) return recibido;
    try {
      const video = await modificar((a) => {
        const t = tallerDeCoach(a, id, coach);
        if (t.videos.length >= 30) throw new ErrorDeDatos("Un curso puede tener hasta 30 videos.");
        const v: VideoTaller = { id: `V${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, ...recibido, estado: "subido" };
        t.videos.push(v);
        t.actualizadoEn = new Date().toISOString();
        return v;
      });
      return Response.json(video, { status: 201 });
    } catch (e) {
      await borrarArchivoDeVideo(recibido);
      throw e;
    }
  }),
);
