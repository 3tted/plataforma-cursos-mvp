import { consultar, modificar } from "@/lib/almacen";
import { videoConIA } from "@/lib/curso-video";
import { ErrorDeDatos, leerJson, manejar } from "@/lib/http";
import { coachDe, conPermiso } from "@/lib/permisos";
import { anotarPlatica, aplicarCambios, preguntarALaIA, repasoQueFalta, tallerDeCoach } from "@/lib/taller";

export const dynamic = "force-dynamic";
// Si arma todo el curso de una vez, la IA puede tardar uno o dos minutos.
export const maxDuration = 300;

type Contexto = { params: Promise<{ id: string }> };

// La coach le escribe a la IA: contesta y cambia el curso en preparación.
// Responde con lo que dijo, lo que cambió y el curso ya cambiado.
export const POST = manejar((req: Request, contexto: Contexto) =>
  conPermiso(async () => {
    const { id } = await contexto.params;
    const coach = await coachDe(req);
    const datos = await leerJson(req);
    const mensaje = typeof datos.texto === "string" ? datos.texto.trim().slice(0, 2000) : "";
    if (!mensaje) throw new ErrorDeDatos("Escribe qué quieres que haga.");
    if (!videoConIA()) throw new ErrorDeDatos("Para platicar con la IA hace falta conectar Gemini (GEMINI_API_KEY).");
    const actual = await consultar((a) => tallerDeCoach(a, id, coach));
    const r = await preguntarALaIA(actual, mensaje);
    const respuesta = (typeof r.respuesta === "string" && r.respuesta.trim().slice(0, 3000)) || "Listo.";
    // Los cambios se aplican sobre la versión más nueva (mientras tanto pudo terminar de verse un video).
    const antes = new Set(actual.borrador.lecciones.map((l) => l.id));
    let { taller, cambios } = await modificar((a) => {
      const t = tallerDeCoach(a, id, coach);
      const cambios = aplicarCambios(t, r);
      anotarPlatica(t, mensaje, respuesta, cambios);
      t.actualizadoEn = new Date().toISOString();
      return { taller: t, cambios };
    });
    // Lecciones nuevas con apuntes pero sin repaso (a menos que la coach lo haya pedido así): se piden aparte.
    const sinRepaso = taller.borrador.lecciones.filter((l) => !antes.has(l.id) && l.repaso.length === 0 && l.contenido).map((l) => l.id);
    if (sinRepaso.length && !/sin\s+(preguntas|repaso)/i.test(mensaje)) {
      try {
        const extra = await repasoQueFalta(taller, sinRepaso);
        ({ taller, cambios } = await modificar((a) => {
          const t = tallerDeCoach(a, id, coach);
          const mas = aplicarCambios(t, { lecciones: (extra.lecciones ?? []).filter((x) => sinRepaso.includes(String(x.id))) });
          const ultimo = t.chat.at(-1);
          if (ultimo?.rol === "ia") ultimo.cambios = [...(ultimo.cambios ?? []), ...mas];
          return { taller: t, cambios: [...cambios, ...mas] };
        }));
      } catch (e) {
        console.warn("No se pudo completar el repaso de las lecciones nuevas", e);
      }
    }
    return Response.json({ respuesta, cambios, taller });
  }),
);
