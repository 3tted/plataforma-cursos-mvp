import { modificar, nuevoId } from "@/lib/almacen";
import { ErrorDeDatos, idNumerico, leerJson, manejar, rol, texto } from "@/lib/http";
import type { Comentario } from "@/lib/tipos";

export const POST = manejar(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const id = idNumerico((await params).id);
    const datos = await leerJson(req);
    const comentario: Omit<Comentario, "id"> = {
      autor: texto(datos.autor, "autor", 60),
      rol: rol(datos.rol),
      cuerpo: texto(datos.cuerpo, "cuerpo", 2000),
      creadoEn: new Date().toISOString(),
    };
    const publicacion = await modificar((a) => {
      const p = a.publicaciones.find((x) => x.id === id);
      if (!p) throw new ErrorDeDatos("La publicación no existe.");
      p.comentarios.push({ id: nuevoId(a), ...comentario });
      return p;
    });
    return Response.json(publicacion, { status: 201 });
  },
);
