import { cargarCurso, idCurso } from "@/lib/curso";
import { manejar } from "@/lib/http";

export const dynamic = "force-dynamic";

// Un curso completo (?curso=id); sin parámetro, el curso principal.
export const GET = manejar(async (req: Request) =>
  Response.json(await cargarCurso(idCurso(new URL(req.url).searchParams.get("curso")))),
);
