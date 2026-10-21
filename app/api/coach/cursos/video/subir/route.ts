import { manejar } from "@/lib/http";
import { coachDe, conPermiso } from "@/lib/permisos";
import { PREFIJO_FUENTE, formaDeSubir, permisoDeSubir } from "@/lib/videos";

export const dynamic = "force-dynamic";

// Permiso para subir a Vercel Blob el video con el que la IA arma un curso
// (ver ../route.ts). Para cualquier persona del equipo de una empresa.

export const GET = manejar((req: Request) =>
  conPermiso(async () => {
    await coachDe(req);
    return formaDeSubir();
  }),
);

export const POST = manejar((req: Request) => conPermiso(() => permisoDeSubir(req, PREFIJO_FUENTE, () => coachDe(req))));
