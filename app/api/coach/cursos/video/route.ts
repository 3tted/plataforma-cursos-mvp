import { consultar, modificar, nuevoId } from "@/lib/almacen";
import { aplicarEdicion, nuevoCurso } from "@/lib/creacion";
import { comoEdicion, juntarMedidas, medidasDelTexto } from "@/lib/curso-ia";
import { borrarDeGemini, estadoEnGemini, proponerCursoDeVideo, subirAGemini, videoConIA } from "@/lib/curso-video";
import { ErrorDeDatos, leerJson, manejar } from "@/lib/http";
import { coachDe, conPermiso, destinoDeCurso, type Coach } from "@/lib/permisos";
import type { Almacen } from "@/lib/almacen";
import type { VideoFuente } from "@/lib/tipos";
import { PREFIJO_FUENTE, borrarArchivoDeVideo, recibirVideo, videoDeLeccion } from "@/lib/videos";

export const dynamic = "force-dynamic";
// Pedirle el curso a la IA con un video largo puede tardar un par de minutos.
export const maxDuration = 300;

// Curso desde un video: la coach sube una clase grabada (PUT, igual que el
// video de una lección) y luego el navegador llama a POST hasta que el curso
// queda armado. Cada llamada avanza un paso: mandar el video a Gemini,
// esperar a que lo procese (responde 202) y pedirle el curso (201, el
// borrador). Si falla, la coach reintenta sin volver a subir el video.

function fuenteDe(a: Almacen, id: unknown, coach: Coach): VideoFuente {
  const f = (a.fuentesVideo ?? []).find((x) => x.id === id);
  if (!f || f.empresa !== coach.empresa) throw new ErrorDeDatos("No encontramos ese video. Súbelo de nuevo.");
  return f;
}

// ---------------------------------------------------------------- PUT: el video
export const PUT = manejar((req: Request) =>
  conPermiso(async () => {
    const coach = await coachDe(req);
    if (!videoConIA()) throw new ErrorDeDatos("Para armar cursos desde un video hace falta conectar Gemini (GEMINI_API_KEY).");
    const recibido = await recibirVideo(req, "fuente", PREFIJO_FUENTE);
    if (recibido instanceof Response) return recibido;
    const fuente = await modificar((a) => {
      const f: VideoFuente = { id: `F${nuevoId(a)}`, empresa: coach.empresa, ...recibido };
      (a.fuentesVideo ??= []).push(f);
      return f;
    });
    return Response.json({ id: fuente.id }, { status: 201 });
  }),
);

// ---------------------------------------------------------------- POST: armar el curso
export const POST = manejar((req: Request) =>
  conPermiso(async () => {
    const coach = await coachDe(req);
    const datos = await leerJson(req);
    const comunidad = String(datos.comunidad ?? "");
    const fuente = await consultar((a) => {
      destinoDeCurso(a, comunidad, coach);
      return fuenteDe(a, datos.fuente, coach);
    });
    const anotar = (cambio: Partial<VideoFuente>) =>
      modificar((a) => {
        const f = (a.fuentesVideo ?? []).find((x) => x.id === fuente.id);
        if (f) Object.assign(f, cambio);
      });

    // 1. Mandar el video a Gemini (una sola vez; si Gemini ya no lo tiene, de nuevo).
    if (!fuente.gemini) {
      await anotar({ gemini: await subirAGemini(fuente) });
      return Response.json({ paso: "procesando" }, { status: 202 });
    }
    // 2. Esperar a que lo procese.
    const enGemini = await estadoEnGemini(fuente.gemini);
    if (enGemini.estado === "perdido") {
      await anotar({ gemini: await subirAGemini(fuente) });
      return Response.json({ paso: "procesando" }, { status: 202 });
    }
    if (enGemini.estado === "procesando" || !enGemini.uri) return Response.json({ paso: "procesando" }, { status: 202 });

    // 3. Pedirle el curso y guardarlo como borrador, cada lección con su tramo del video.
    const indicaciones = String(datos.indicaciones ?? "").trim().slice(0, 500);
    const campo = (k: string) => {
      const v = String(datos[k] ?? "").trim();
      return v === "" ? undefined : Number(v);
    };
    const medidas = juntarMedidas(
      { lecciones: campo("lecciones"), repaso: campo("repaso"), examen: campo("examen") },
      medidasDelTexto(indicaciones),
    );
    const { propuesta, tramos, aviso } = await proponerCursoDeVideo(
      { uri: enGemini.uri, tipo: fuente.tipo, nombre: fuente.nombreOriginal, duracion: fuente.duracion },
      indicaciones,
      medidas,
    );
    const curso = await modificar((a) => {
      const borrador = aplicarEdicion(a, nuevoCurso(a, coach, destinoDeCurso(a, comunidad, coach), "ia"), comoEdicion(propuesta));
      (a.cursosCoach ??= []).push(borrador);
      const lecciones = borrador.modulos.flatMap((m) => m.lecciones);
      a.videos = [
        ...(a.videos ?? []),
        ...lecciones.flatMap((l, i) => (tramos[i] ? [videoDeLeccion(l.id, fuente, tramos[i])] : [])),
      ];
      // El archivo ya lo usan las lecciones: el video para armar el curso se suelta.
      a.fuentesVideo = (a.fuentesVideo ?? []).filter((f) => f.id !== fuente.id);
      return borrador;
    });
    await borrarDeGemini(fuente.gemini);
    return Response.json({ ...curso, aviso }, { status: 201 });
  }),
);

// ---------------------------------------------------------------- DELETE: ya no lo quiere
export const DELETE = manejar((req: Request) =>
  conPermiso(async () => {
    const coach = await coachDe(req);
    const id = new URL(req.url).searchParams.get("fuente");
    const quitada = await modificar((a) => {
      const f = fuenteDe(a, id, coach);
      a.fuentesVideo = (a.fuentesVideo ?? []).filter((x) => x.id !== f.id);
      return f;
    });
    if (quitada.gemini) await borrarDeGemini(quitada.gemini);
    await borrarArchivoDeVideo(quitada);
    return new Response(null, { status: 204 });
  }),
);
