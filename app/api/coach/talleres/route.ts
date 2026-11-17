import { consultar, modificar } from "@/lib/almacen";
import { ErrorDeDatos, leerJson, manejar } from "@/lib/http";
import { coachDe, conPermiso, destinoDeCurso, exigirEmpresaActiva } from "@/lib/permisos";
import { nuevoTaller } from "@/lib/taller";
import type { TallerCurso } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// Cursos que la coach arma platicando con la IA (lib/taller.ts): los que dejó
// a medias (GET) y uno nuevo (POST), a mano, con videos o con un documento.

export const GET = manejar((req: Request) =>
  conPermiso(async () => {
    const coach = await coachDe(req);
    const talleres = await consultar((a) =>
      (a.talleres ?? [])
        .filter((t) => t.empresa === coach.empresa)
        .sort((x, y) => y.actualizadoEn.localeCompare(x.actualizadoEn))
        .map((t) => ({
          id: t.id,
          comunidad: t.comunidad,
          modo: t.modo,
          titulo: t.borrador.titulo,
          lecciones: t.borrador.lecciones.length,
          actualizadoEn: t.actualizadoEn,
        })),
    );
    return Response.json({ talleres });
  }),
);

const MODOS: TallerCurso["modo"][] = ["mano", "video", "documento"];

export const POST = manejar((req: Request) =>
  conPermiso(async () => {
    const coach = await coachDe(req);
    const datos = await leerJson(req);
    const modo = MODOS.find((m) => m === datos.modo);
    if (!modo) throw new ErrorDeDatos("Elige cómo quieres empezar el curso.");
    const taller = await modificar((a) => {
      exigirEmpresaActiva(a, coach);
      const t = nuevoTaller(a, coach, destinoDeCurso(a, datos.comunidad, coach), modo);
      (a.talleres ??= []).push(t);
      return t;
    });
    return Response.json({ id: taller.id }, { status: 201 });
  }),
);
