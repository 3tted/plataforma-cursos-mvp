import { modificar, nuevoId } from "@/lib/almacen";
import { idLeccionCoach } from "@/lib/curso";
import { leerJson, manejar, texto } from "@/lib/http";
import { coachDelCurso } from "@/lib/permisos";
import type { LeccionCoach } from "@/lib/tipos";

// La coach pega el texto o la transcripción de una lección propia en un curso
// de su empresa ({ curso }); desde ese momento el asistente también
// responde con base en ella.
export const POST = manejar(async (req: Request) => {
  const datos = await leerJson(req);
  const titulo = texto(datos.titulo, "titulo", 120);
  const contenido = texto(datos.contenido, "contenido", 20000);
  const curso = (await coachDelCurso(req, datos.curso)).datos.curso.id;
  const leccion = await modificar((a) => {
    const nueva: LeccionCoach = {
      id: nuevoId(a),
      curso,
      titulo,
      contenido,
      creadaEn: new Date().toISOString(),
    };
    a.leccionesCoach.push(nueva);
    return nueva;
  });
  return Response.json({ ...leccion, idCurso: idLeccionCoach(leccion) }, { status: 201 });
});
