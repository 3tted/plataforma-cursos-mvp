import { consultar } from "@/lib/almacen";
import { manejar } from "@/lib/http";
import { coachDe, conPermiso } from "@/lib/permisos";
import { tallerDeCoach } from "@/lib/taller";
import { PREFIJO_TALLER, formaDeSubir, permisoDeSubir } from "@/lib/videos";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

// Permiso para subir a Vercel Blob un video del curso en preparación (ver ../route.ts).

export const GET = manejar((req: Request, contexto: Contexto) =>
  conPermiso(async () => {
    const { id } = await contexto.params;
    const coach = await coachDe(req);
    await consultar((a) => tallerDeCoach(a, id, coach));
    return formaDeSubir();
  }),
);

export const POST = manejar((req: Request, contexto: Contexto) =>
  conPermiso(async () => {
    const { id } = await contexto.params;
    return permisoDeSubir(req, PREFIJO_TALLER, async () => {
      const coach = await coachDe(req);
      await consultar((a) => tallerDeCoach(a, id, coach));
    });
  }),
);
