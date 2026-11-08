import { consultar } from "@/lib/almacen";
import { diagnosticoEn } from "@/lib/diagnosticos";
import { error, manejar } from "@/lib/http";

export const dynamic = "force-dynamic";

// La definición de un diagnóstico (preguntas, escala, rangos y textos) para
// dibujarlo en el navegador: la de uno que viaja con el proyecto o la de uno
// creado por un coach. No lleva datos de nadie, así que es pública (también la
// usa la página pública del diagnóstico).
export const GET = manejar(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const d = await consultar((a) => diagnosticoEn(a, id));
  if (!d) return error("No encontramos ese diagnóstico.", 404);
  const { id: _id, titulo, instrucciones, escala, dimensiones, porDimension, global, bandasEn, regla, aviso, cta } = d;
  return Response.json({ id, titulo, instrucciones, escala, dimensiones, porDimension, global, bandasEn, regla, aviso, cta });
});
