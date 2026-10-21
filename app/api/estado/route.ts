import { ALMACEN_COMPARTIDO } from "@/lib/almacen";
import { iaDisponible, modeloActivo } from "@/lib/asistente";
import type { EstadoPlataforma } from "@/lib/tipos";
import { videosEnLaNube } from "@/lib/videos";

export const dynamic = "force-dynamic";

export function GET() {
  const estado: EstadoPlataforma = {
    iaActiva: iaDisponible(),
    modelo: modeloActivo(),
    almacen: ALMACEN_COMPARTIDO ? "redis" : "archivo",
    videosEnLaNube: videosEnLaNube(),
  };
  return Response.json(estado);
}
