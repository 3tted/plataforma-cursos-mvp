import { manejar } from "@/lib/http";
import { coachDeLaLeccion } from "@/lib/permisos";
import { formaDeSubir, permisoDeSubir, rutaEnLaNube } from "@/lib/videos";

export const dynamic = "force-dynamic";

// Permiso para que el navegador suba el video de una lección directo a
// Vercel Blob (sin pasar el archivo por el servidor). Solo para el equipo de
// la empresa dueña del curso. Al terminar, el navegador avisa con
// PUT /api/videos/<lección> para anotarlo.

type Contexto = { params: Promise<{ leccion: string }> };

export const GET = manejar(async (req: Request, { params }: Contexto) => {
  const { leccion } = await params;
  await coachDeLaLeccion(req, leccion);
  return formaDeSubir();
});

export const POST = manejar(async (req: Request, { params }: Contexto) => {
  const { leccion } = await params;
  return permisoDeSubir(req, rutaEnLaNube(leccion), () => coachDeLaLeccion(req, leccion));
});
