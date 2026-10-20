import { cargarCursos, resumenDe } from "@/lib/curso";
import { manejar } from "@/lib/http";
import { coachOpcional } from "@/lib/permisos";

export const dynamic = "force-dynamic";

// Los cursos de la comunidad, en ficha corta, para elegir cuál tomar. Para una
// coach también van los cursos de su empresa subidos a la página sin publicar.
export const GET = manejar(async (req: Request) => {
  const coach = await coachOpcional(req);
  return Response.json((await cargarCursos({ deEmpresa: coach?.empresa })).map(resumenDe));
});
