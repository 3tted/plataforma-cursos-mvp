import { cargarCurso, idCurso } from "@/lib/curso";
import { manejar } from "@/lib/http";
import { coachOpcional, empresaDeDatos } from "@/lib/permisos";

export const dynamic = "force-dynamic";

// Un curso completo (?curso=id); sin parámetro, el curso principal. Con
// ?borrador=1, una coach también recibe los borradores de su empresa (los
// revisa antes de publicar); a nadie más se le sirve un borrador.
export const GET = manejar(async (req: Request) => {
  const parametros = new URL(req.url).searchParams;
  const coach = parametros.get("borrador") === "1" ? await coachOpcional(req) : null;
  if (coach) {
    const opciones = { borradores: true };
    const datos = await cargarCurso(await idCurso(parametros.get("curso"), opciones), opciones);
    if (empresaDeDatos(datos) === coach.empresa || !datos.curso.sinPublicar) return Response.json(datos);
  }
  return Response.json(await cargarCurso(await idCurso(parametros.get("curso"))));
});
