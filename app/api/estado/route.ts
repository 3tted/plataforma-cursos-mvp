import { iaDisponible, modeloActivo } from "@/lib/asistente";
import type { EstadoPlataforma } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export function GET() {
  const estado: EstadoPlataforma = { iaActiva: iaDisponible(), modelo: modeloActivo() };
  return Response.json(estado);
}
