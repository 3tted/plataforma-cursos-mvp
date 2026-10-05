import { consultar, contarMiembros } from "@/lib/almacen";
import { manejar } from "@/lib/http";
import type { ResumenComunidad } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export const GET = manejar(async () => {
  const resumen: ResumenComunidad = { miembros: await consultar(contarMiembros) };
  return Response.json(resumen);
});
