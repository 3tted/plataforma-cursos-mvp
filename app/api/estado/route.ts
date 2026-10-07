import { ALMACEN_COMPARTIDO } from "@/lib/almacen";
import { iaDisponible, modeloActivo } from "@/lib/asistente";
import type { EstadoPlataforma } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export function GET() {
  const estado: EstadoPlataforma = {
    iaActiva: iaDisponible(),
    modelo: modeloActivo(),
    almacen: ALMACEN_COMPARTIDO ? "redis" : "archivo",
  };
  return Response.json(estado);
}
