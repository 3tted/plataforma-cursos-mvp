import { modificar, nuevoId } from "@/lib/almacen";
import {
  iaDisponible,
  mensajeDeError,
  proveedorIA,
  responderConClaude,
  responderEnModoDemo,
} from "@/lib/asistente";
import { mensajeDeErrorGemini, responderConGemini } from "@/lib/asistente-gemini";
import { extraerCitas } from "@/lib/citas";
import { cargarCurso } from "@/lib/curso";
import { error, leerJson, manejar, texto } from "@/lib/http";
import type { TurnoChat } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// Límite sencillo por IP para que un prototipo publicado no genere costos
// descontrolados de API: 30 preguntas cada 10 minutos.
const VENTANA_MS = 10 * 60_000;
const MAX_PREGUNTAS = 30;
const historialPorIp = new Map<string, number[]>();

function superaLimite(ip: string): boolean {
  const ahora = Date.now();
  const recientes = (historialPorIp.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  recientes.push(ahora);
  historialPorIp.set(ip, recientes);
  return recientes.length > MAX_PREGUNTAS;
}

// Solo se aceptan los últimos turnos, bien formados y alternados, empezando
// por el alumno.
function limpiarHistorial(valor: unknown): TurnoChat[] {
  if (!Array.isArray(valor)) return [];
  const turnos = valor
    .filter(
      (t): t is TurnoChat =>
        !!t &&
        (t.role === "user" || t.role === "assistant") &&
        typeof t.content === "string" &&
        t.content.trim().length > 0,
    )
    .slice(-8)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }));
  while (turnos.length && turnos[0].role !== "user") turnos.shift();
  if (turnos.length && turnos[turnos.length - 1].role === "user") turnos.pop();
  return turnos;
}

async function registrarPregunta(
  autor: string,
  pregunta: string,
  leccionActual: string | null,
  respuesta: string,
  modo: "ia" | "demo",
) {
  try {
    await modificar((a) => {
      a.preguntas.push({
        id: nuevoId(a),
        autor,
        pregunta,
        leccionActual,
        citas: extraerCitas(respuesta),
        modo,
        respuesta: respuesta.slice(0, 1500),
        creadaEn: new Date().toISOString(),
      });
    });
  } catch (e) {
    console.error("No se pudo registrar la pregunta:", e);
  }
}

export const POST = manejar(async (req: Request) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (iaDisponible() && superaLimite(ip)) {
    return error("Hiciste muchas preguntas seguidas. Espera unos minutos e inténtalo de nuevo.", 429);
  }

  const datos = await leerJson(req);
  const pregunta = texto(datos.pregunta, "pregunta", 1000);
  const autor = typeof datos.autor === "string" && datos.autor.trim() ? datos.autor.trim().slice(0, 60) : "Anónimo";
  const historial = limpiarHistorial(datos.historial);
  // En el prototipo la membresía vive en el navegador y llega con la pregunta.
  // En la Fase 2 se valida con la sesión, del lado del servidor.
  const miembro = datos.miembro === true;
  const curso = await cargarCurso();
  const leccionActual =
    typeof datos.leccion === "string" &&
    curso.curso.modulos.some((m) => m.lecciones.some((l) => l.id === datos.leccion))
      ? datos.leccion
      : null;

  const codificador = new TextEncoder();
  const encabezados = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  };

  if (!iaDisponible()) {
    const respuesta = responderEnModoDemo(curso, pregunta, leccionActual, miembro);
    await registrarPregunta(autor, pregunta, leccionActual, respuesta, "demo");
    // Se envía en pedazos para que la interfaz se comporte igual que con la IA.
    const piezas = respuesta.match(/[\s\S]{1,24}/g) ?? [respuesta];
    const flujo = new ReadableStream<Uint8Array>({
      async start(controlador) {
        for (const pieza of piezas) {
          controlador.enqueue(codificador.encode(pieza));
          await new Promise((r) => setTimeout(r, 12));
        }
        controlador.close();
      },
    });
    return new Response(flujo, { headers: { ...encabezados, "X-Modo": "demo" } });
  }

  if (proveedorIA() === "gemini") {
    const cancelar = new AbortController();
    const flujo = new ReadableStream<Uint8Array>({
      async start(controlador) {
        let respuesta = "";
        try {
          for await (const trozo of responderConGemini(curso, pregunta, historial, leccionActual, miembro, cancelar.signal)) {
            respuesta += trozo;
            controlador.enqueue(codificador.encode(trozo));
          }
          await registrarPregunta(autor, pregunta, leccionActual, respuesta, "ia");
        } catch (e) {
          if (!cancelar.signal.aborted) {
            console.error("Error del asistente (Gemini):", e);
            controlador.enqueue(codificador.encode(`${respuesta ? "\n\n" : ""}_${mensajeDeErrorGemini(e)}_`));
          }
        } finally {
          try {
            controlador.close();
          } catch {
            // el cliente ya cerró la conexión
          }
        }
      },
      cancel() {
        // El alumno presionó "Detener" o cerró la página.
        cancelar.abort();
      },
    });
    return new Response(flujo, { headers: { ...encabezados, "X-Modo": "ia" } });
  }

  const stream = responderConClaude(curso, pregunta, historial, leccionActual, miembro);
  const flujo = new ReadableStream<Uint8Array>({
    async start(controlador) {
      let respuesta = "";
      stream.on("text", (delta) => {
        respuesta += delta;
        controlador.enqueue(codificador.encode(delta));
      });
      try {
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controlador.enqueue(
            codificador.encode(
              "\n\n_No puedo responder esta pregunta. Intenta reformularla o publícala en la comunidad._",
            ),
          );
        } else if (final.stop_reason === "max_tokens") {
          controlador.enqueue(codificador.encode("\n\n_La respuesta se cortó por ser demasiado larga._"));
        }
        await registrarPregunta(autor, pregunta, leccionActual, respuesta, "ia");
      } catch (e) {
        if (!stream.controller.signal.aborted) {
          console.error("Error del asistente:", e);
          controlador.enqueue(codificador.encode(`${respuesta ? "\n\n" : ""}_${mensajeDeError(e)}_`));
        }
      } finally {
        try {
          controlador.close();
        } catch {
          // el cliente ya cerró la conexión
        }
      }
    },
    cancel() {
      // El alumno presionó "Detener" o cerró la página.
      stream.abort();
    },
  });
  return new Response(flujo, { headers: { ...encabezados, "X-Modo": "ia" } });
});
