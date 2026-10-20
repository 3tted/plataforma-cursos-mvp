import { consultar } from "@/lib/almacen";
import { EMPRESA_MERKATICS } from "@/lib/cuentas";
import { COMUNIDADES } from "@/lib/comunidades";
import { marcaDe } from "@/lib/curso";
import { error, manejar } from "@/lib/http";

export const dynamic = "force-dynamic";

// La página pública de una empresa (/e/<id>): su nombre, su marca y sus
// comunidades con al menos un curso publicado.
export const GET = manejar(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const datos = await consultar((a) => {
    const e = (a.empresas ?? []).find((x) => x.id === id);
    if (!e) return null;
    const creadas = (a.comunidadesCoach ?? [])
      .filter((c) => (c.empresa ?? EMPRESA_MERKATICS) === e.id)
      .filter((c) => (a.cursosCoach ?? []).some((x) => x.comunidad === c.id && x.estado === "publicado"))
      .map((c) => c.id);
    const deEjemplo = e.id === EMPRESA_MERKATICS ? COMUNIDADES.filter((c) => c.estado === "activa").map((c) => c.id) : [];
    return { id: e.id, nombre: e.nombre, ...marcaDe(a, e.id), comunidades: [...deEjemplo, ...creadas] };
  });
  return datos ? Response.json(datos) : error("No encontramos esa empresa.", 404);
});
