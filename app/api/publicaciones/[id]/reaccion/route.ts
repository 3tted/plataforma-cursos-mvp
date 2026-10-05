import { modificar } from "@/lib/almacen";
import { ErrorDeDatos, idNumerico, leerJson, manejar, texto } from "@/lib/http";

// Alterna el "Me sirve" de una persona en una publicación.
export const POST = manejar(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const id = idNumerico((await params).id);
    const autor = texto((await leerJson(req)).autor, "autor", 60);
    const publicacion = await modificar((a) => {
      const p = a.publicaciones.find((x) => x.id === id);
      if (!p) throw new ErrorDeDatos("La publicación no existe.");
      p.reacciones = p.reacciones.includes(autor)
        ? p.reacciones.filter((r) => r !== autor)
        : [...p.reacciones, autor];
      return p;
    });
    return Response.json(publicacion);
  },
);
