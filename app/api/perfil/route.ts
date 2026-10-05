import { consultar } from "@/lib/almacen";
import { error, manejar } from "@/lib/http";

export const dynamic = "force-dynamic";

// Lo que una persona ha aportado en la plataforma: publicaciones, comentarios
// y preguntas al asistente. En el MVP no hay cuentas, así que se busca por el
// nombre con el que firma; en la Fase 2 se busca por el id del usuario.
export const GET = manejar(async (req: Request) => {
  const autor = new URL(req.url).searchParams.get("autor")?.trim();
  if (!autor) return error("Falta el nombre de la persona.");

  const perfil = await consultar((a) => ({
    publicaciones: a.publicaciones
      .filter((p) => p.autor === autor)
      .map((p) => ({ id: p.id, titulo: p.titulo, categoria: p.categoria, creadaEn: p.creadaEn })),
    comentarios: a.publicaciones.flatMap((p) =>
      p.comentarios
        .filter((c) => c.autor === autor)
        .map((c) => ({ id: c.id, publicacion: p.titulo, cuerpo: c.cuerpo, creadoEn: c.creadoEn })),
    ),
    preguntas: a.preguntas
      .filter((q) => q.autor === autor)
      .map((q) => ({ id: q.id, pregunta: q.pregunta, creadaEn: q.creadaEn })),
  }));
  return Response.json(perfil);
});
