import { modificar, nuevoId } from "@/lib/almacen";
import { idCurso, idLeccionCoach } from "@/lib/curso";
import { leerJson, manejar, texto } from "@/lib/http";
import type { LeccionCoach } from "@/lib/tipos";

// La coach pega el texto o la transcripción de una lección propia en el curso
// que tiene elegido ({ curso }); desde ese momento el asistente también
// responde con base en ella.
export const POST = manejar(async (req: Request) => {
  const datos = await leerJson(req);
  const titulo = texto(datos.titulo, "titulo", 120);
  const contenido = texto(datos.contenido, "contenido", 20000);
  const curso = await idCurso(datos.curso, { borradores: true });
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
