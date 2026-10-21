import { consultar, modificar } from "@/lib/almacen";
import { ErrorDeDatos, leerJson, manejar } from "@/lib/http";
import { COLOR_MERKATICS, normalizarColor } from "@/lib/marca";
import { coachDe, empresaDeCoach } from "@/lib/permisos";

export const dynamic = "force-dynamic";

// La empresa de quien tiene sesión y su marca (nombre, color y logo). Todo
// su equipo la ve; la cambian el dueño y los administradores. La marca se aplica en sus
// comunidades, sus cursos, sus lecciones y en su página (/e/<id>).
export const GET = manejar(async (req: Request) => {
  const coach = await coachDe(req);
  const empresa = await consultar((a) => empresaDeCoach(a, coach));
  // Sin color todavía: se propone el de Merkatics (y la marca de Merkatics sigue hasta que guarde).
  return Response.json({ ...empresa, color: empresa.color ?? COLOR_MERKATICS, conMarca: !!empresa.color, puedeEditar: coach.administra });
});

// Guarda nombre y color: { nombre, color }.
export const PUT = manejar(async (req: Request) => {
  const coach = await coachDe(req);
  const datos = await leerJson(req);
  const nombre = typeof datos.nombre === "string" ? datos.nombre.trim().slice(0, 60) : "";
  if (nombre.length < 2) throw new ErrorDeDatos("Ponle un nombre a tu empresa o marca (al menos 2 letras).");
  const color = normalizarColor(datos.color);
  if (!color) throw new ErrorDeDatos("Elige un color válido, por ejemplo #2563eb.");
  const empresa = await modificar((a) =>
    Object.assign(empresaDeCoach(a, coach, { administrar: true }), { nombre, color, actualizadaEn: new Date().toISOString() }),
  );
  return Response.json({ ...empresa, conMarca: true, puedeEditar: true });
});
