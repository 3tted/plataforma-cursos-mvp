import { consultar } from "@/lib/almacen";
import { COMUNIDADES, type ComunidadDirectorio } from "@/lib/comunidades";
import { manejar } from "@/lib/http";

export const dynamic = "force-dynamic";

// Directorio: las comunidades del proyecto y las que crearon las coaches
// (en cuanto publican su primer curso).
export const GET = manejar(async () => {
  const creadas = await consultar((a) =>
    (a.comunidadesCoach ?? []).flatMap((c): ComunidadDirectorio[] => {
      const publicados = (a.cursosCoach ?? []).filter((x) => x.comunidad === c.id && x.estado === "publicado");
      if (publicados.length === 0) return [];
      return [
        {
          id: c.id,
          nombre: c.nombre,
          coach: c.coach,
          tema: c.tema,
          descripcion: c.descripcion,
          curso: publicados[0].titulo,
          estado: "activa",
          ...(c.foto ? { foto: c.foto } : {}),
          ...(c.empresa ? { empresa: c.empresa } : {}),
        },
      ];
    }),
  );
  return Response.json([...COMUNIDADES, ...creadas]);
});
