import { cargarCursos, resumenDe } from "@/lib/curso";
import { manejar } from "@/lib/http";

export const dynamic = "force-dynamic";

// Los cursos de la comunidad, en ficha corta, para elegir cuál tomar. Para la
// coach (?autor= y X-Rol: coach) también van sus cursos subidos a la página sin publicar.
export const GET = manejar(async (req: Request) => {
  const autor = new URL(req.url).searchParams.get("autor");
  const deCoach = req.headers.get("x-rol") === "coach" && autor ? autor : undefined;
  return Response.json((await cargarCursos({ deCoach })).map(resumenDe));
});
