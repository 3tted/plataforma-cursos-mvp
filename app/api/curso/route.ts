import { cargarCurso, idCurso } from "@/lib/curso";
import { manejar } from "@/lib/http";

export const dynamic = "force-dynamic";

// Un curso completo (?curso=id); sin parámetro, el curso principal. Con
// ?borrador=1 también sirve los borradores (la coach los revisa antes de publicar).
export const GET = manejar(async (req: Request) => {
  const parametros = new URL(req.url).searchParams;
  const opciones = { borradores: parametros.get("borrador") === "1" };
  return Response.json(await cargarCurso(await idCurso(parametros.get("curso"), opciones), opciones));
});
