import { issueSignedToken } from "@vercel/blob";
import {
  handleUpload,
  handleUploadPresigned,
  type HandleUploadBody,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";
import { ErrorDeDatos, manejar } from "@/lib/http";
import { coachDeLaLeccion } from "@/lib/permisos";
import { MAX_BYTES_VIDEO, TIPOS_VIDEO } from "@/lib/reglas-video";
import { accesoDeLaNube, conClaveDeBlob, rutaEnLaNube, videosEnLaNube } from "@/lib/videos";

export const dynamic = "force-dynamic";

// Permiso para que el navegador suba el video de una lección directo a
// Vercel Blob (sin pasar el archivo por el servidor). Solo para el equipo de
// la empresa dueña del curso, solo videos y hasta el tamaño máximo. Al
// terminar, el navegador avisa con PUT /api/videos/<lección> para anotarlo.

type Contexto = { params: Promise<{ leccion: string }> };

const REGLAS = { allowedContentTypes: Object.keys(TIPOS_VIDEO), maximumSizeInBytes: MAX_BYTES_VIDEO };

function exigirNube() {
  if (!videosEnLaNube()) throw new ErrorDeDatos("Este servidor guarda los videos en su disco: súbelo de la forma normal.");
}

// GET: cómo subir aquí (almacenamiento público o privado, con o sin clave).
export const GET = manejar(async (req: Request, { params }: Contexto) => {
  exigirNube();
  const { leccion } = await params;
  await coachDeLaLeccion(req, leccion);
  return Response.json({ acceso: await accesoDeLaNube(), firmada: !conClaveDeBlob() });
});

export const POST = manejar(async (req: Request, { params }: Contexto) => {
  exigirNube();
  const { leccion } = await params;
  const body = (await req.json()) as HandleUploadBody | HandleUploadPresignedBody;
  const revisar = async (pathname: string) => {
    if (!pathname.startsWith(`${rutaEnLaNube(leccion)}.`)) throw new ErrorDeDatos("El video no es de esta lección.");
    await coachDeLaLeccion(req, leccion);
  };

  if (body.type === "blob.generate-presigned-url") {
    const respuesta = await handleUploadPresigned({
      body,
      request: req,
      getSignedToken: async (pathname) => {
        await revisar(pathname);
        const token = await issueSignedToken({ pathname, operations: ["put"], ...REGLAS });
        return { token, urlOptions: { ...REGLAS, addRandomSuffix: true } };
      },
    });
    return Response.json(respuesta);
  }

  const respuesta = await handleUpload({
    body: body as HandleUploadBody,
    request: req,
    onBeforeGenerateToken: async (pathname) => {
      await revisar(pathname);
      return { ...REGLAS, addRandomSuffix: true };
    },
  });
  return Response.json(respuesta);
});
