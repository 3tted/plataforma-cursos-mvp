import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { ErrorDeDatos, manejar } from "@/lib/http";
import { coachDeLaLeccion } from "@/lib/permisos";
import { MAX_BYTES_VIDEO, TIPOS_VIDEO } from "@/lib/reglas-video";
import { rutaEnLaNube, videosEnLaNube } from "@/lib/videos";

export const dynamic = "force-dynamic";

// Permiso para que el navegador suba el video de una lección directo a
// Vercel Blob (sin pasar el archivo por el servidor). Solo para el equipo de
// la empresa dueña del curso, solo videos y hasta el tamaño máximo. Al
// terminar, el navegador avisa con PUT /api/videos/<lección> para anotarlo.
export const POST = manejar(async (req: Request, { params }: { params: Promise<{ leccion: string }> }) => {
  if (!videosEnLaNube()) throw new ErrorDeDatos("Este servidor guarda los videos en su disco: súbelo de la forma normal.");
  const { leccion } = await params;
  const body = (await req.json()) as HandleUploadBody;
  const respuesta = await handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async (pathname) => {
      if (!pathname.startsWith(`${rutaEnLaNube(leccion)}.`)) throw new ErrorDeDatos("El video no es de esta lección.");
      await coachDeLaLeccion(req, leccion);
      return {
        allowedContentTypes: Object.keys(TIPOS_VIDEO),
        maximumSizeInBytes: MAX_BYTES_VIDEO,
        addRandomSuffix: true,
      };
    },
  });
  return Response.json(respuesta);
});
