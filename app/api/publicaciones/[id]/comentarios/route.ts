import { modificar, nuevoId } from "@/lib/almacen";
import { COMUNIDAD_PRINCIPAL } from "@/lib/curso";
import { ErrorDeDatos, idNumerico, leerJson, manejar, texto } from "@/lib/http";
import { cuentaDeReq, empresaDeComunidad } from "@/lib/permisos";
import type { Comentario } from "@/lib/tipos";

export const POST = manejar(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const cuenta = await cuentaDeReq(req);
    const id = idNumerico((await params).id);
    const datos = await leerJson(req);
    const cuerpo = texto(datos.cuerpo, "cuerpo", 2000);
    const publicacion = await modificar((a) => {
      const p = a.publicaciones.find((x) => x.id === id);
      if (!p) throw new ErrorDeDatos("La publicación no existe.");
      // Comenta como coach solo una coach de la empresa dueña de la comunidad.
      const deLaComunidad = cuenta.rol === "coach" && cuenta.empresa === empresaDeComunidad(a, p.comunidad ?? COMUNIDAD_PRINCIPAL);
      const comentario: Omit<Comentario, "id"> = {
        autor: cuenta.nombre,
        rol: deLaComunidad ? "coach" : "alumno",
        cuerpo,
        creadoEn: new Date().toISOString(),
      };
      p.comentarios.push({ id: nuevoId(a), ...comentario });
      return p;
    });
    return Response.json(publicacion, { status: 201 });
  },
);
