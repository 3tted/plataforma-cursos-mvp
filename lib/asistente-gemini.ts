import { ApiError, FinishReason, GoogleGenAI, type Content } from "@google/genai";
import { INSTRUCCIONES_GENERALES, MODELO_GEMINI, instrucciones, preguntaConContexto } from "./asistente";
import type { DatosCurso, TurnoChat } from "./tipos";

// Asistentes con Gemini (SDK oficial @google/genai). Usan las mismas
// instrucciones que la versión con Claude: el del curso responde con las
// lecciones, las cita y no entrega lo de pago a quien no es miembro; el
// general no conoce los cursos.

let cliente: GoogleGenAI | null = null;

// Si el modelo principal está saturado, sin cuota o tarda en empezar, se
// prueba el siguiente. Flash va sin razonamiento previo: así empieza a
// escribir en segundos y no en medio minuto (Flash-Lite no acepta esa opción).
const MODELOS_RESPALDO = ["gemini-flash-lite-latest", "gemini-flash-latest"];
const OPCIONES_POR_MODELO: Record<string, object> = {
  "gemini-flash-latest": { thinkingConfig: { thinkingBudget: 0 } },
};

// Tiempo máximo para que un modelo empiece a responder antes de pasar al siguiente.
const ESPERA_PRIMER_TEXTO_MS = 12_000;

const FINALES_NORMALES = new Set<FinishReason | undefined>([
  undefined,
  FinishReason.STOP,
  FinishReason.FINISH_REASON_UNSPECIFIED,
]);

export function responderConGemini(
  datos: DatosCurso,
  pregunta: string,
  historial: TurnoChat[],
  leccionActual: string | null,
  miembro: boolean,
  senal: AbortSignal,
): AsyncGenerator<string> {
  return generar(instrucciones(datos, miembro), historial, preguntaConContexto(datos, pregunta, leccionActual), senal);
}

export function responderGeneralConGemini(
  pregunta: string,
  historial: TurnoChat[],
  senal: AbortSignal,
): AsyncGenerator<string> {
  return generar(INSTRUCCIONES_GENERALES, historial, pregunta, senal);
}

async function* generar(
  sistema: string,
  historial: TurnoChat[],
  pregunta: string,
  senal: AbortSignal,
): AsyncGenerator<string> {
  cliente ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });

  const contents: Content[] = [
    ...historial.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })),
    { role: "user", parts: [{ text: pregunta }] },
  ];

  const config = {
    systemInstruction: sistema,
    // Holgado: en los modelos que razonan, ese razonamiento también cuenta aquí.
    maxOutputTokens: 8192,
  };

  // Se pasa al siguiente modelo si uno está saturado (503), sin cuota (429),
  // no existe (404) o no empieza a responder a tiempo. Todo eso ocurre antes
  // del primer texto, así que el alumno no ve respuestas mezcladas.
  const modelos = [...new Set([MODELO_GEMINI, ...MODELOS_RESPALDO])];
  for (const [i, model] of modelos.entries()) {
    const ultimo = i === modelos.length - 1;
    const control = new AbortController();
    const cancelar = () => control.abort();
    senal.addEventListener("abort", cancelar);
    let tarde = false;
    let empezo = false;
    const reloj = ultimo
      ? undefined
      : setTimeout(() => {
          tarde = true;
          control.abort();
        }, ESPERA_PRIMER_TEXTO_MS);
    try {
      const extra = OPCIONES_POR_MODELO[model] ?? {};
      const flujo = await cliente.models.generateContentStream({
        model,
        contents,
        config: { ...config, ...extra, abortSignal: control.signal },
      });
      const lector = flujo[Symbol.asyncIterator]();
      const primero = await lector.next();
      clearTimeout(reloj);

      let final: FinishReason | undefined;
      for (let paso = primero; !paso.done; paso = await lector.next()) {
        const texto = paso.value.text;
        if (texto) {
          empezo = true;
          yield texto;
        }
        final = paso.value.candidates?.[0]?.finishReason ?? final;
      }
      yield* avisoDeFinal(final);
      return;
    } catch (e) {
      clearTimeout(reloj);
      const reintentable = tarde || (e instanceof ApiError && (e.status === 429 || e.status === 503 || e.status === 404));
      // Si ya se escribió parte de la respuesta, no se mezcla con la de otro modelo.
      if (!reintentable || empezo || ultimo || senal.aborted) throw e;
      console.warn(
        `Gemini: ${model} ${tarde ? "no empezó a responder a tiempo" : `respondió ${(e as ApiError).status}`}, probando ${modelos[i + 1]}.`,
      );
    } finally {
      senal.removeEventListener("abort", cancelar);
    }
  }
}

function* avisoDeFinal(final: FinishReason | undefined): Generator<string> {
  if (final === FinishReason.MAX_TOKENS) {
    yield "\n\n_La respuesta se cortó por ser demasiado larga._";
  } else if (!FINALES_NORMALES.has(final)) {
    yield "\n\n_No puedo responder esta pregunta. Intenta reformularla o publícala en la comunidad._";
  }
}

export function mensajeDeErrorGemini(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400 && /api key/i.test(error.message)) {
      return "La clave de Gemini no es válida. Revisa GEMINI_API_KEY en tu archivo .env.local.";
    }
    if (error.status === 401 || error.status === 403) {
      return "La clave de Gemini no es válida o no tiene permiso. Revisa GEMINI_API_KEY en tu archivo .env.local.";
    }
    if (error.status === 404) {
      return `El modelo "${MODELO_GEMINI}" no está disponible para esta clave. Revisa GEMINI_MODEL.`;
    }
    if (error.status === 429) {
      return "Se alcanzó el límite gratuito de Gemini por ahora. Espera un minuto e inténtalo de nuevo.";
    }
    if (error.status >= 500) {
      return "Gemini tuvo un problema. Inténtalo de nuevo en unos momentos.";
    }
    return "Gemini no pudo responder esta pregunta. Inténtalo de nuevo.";
  }
  if (error instanceof TypeError) {
    return "No se pudo conectar con Gemini. Revisa tu conexión a internet.";
  }
  return "Ocurrió un error inesperado al generar la respuesta.";
}
