import { ApiError, FinishReason, GoogleGenAI, type Content } from "@google/genai";
import { MODELO_GEMINI, instrucciones, preguntaConContexto } from "./asistente";
import type { DatosCurso, TurnoChat } from "./tipos";

// Asistente con Gemini (SDK oficial @google/genai). Usa las mismas
// instrucciones que la versión con Claude: responder con el curso, citar
// la lección y no entregar lo de pago a quien no es miembro.

let cliente: GoogleGenAI | null = null;

const MODELOS_RESPALDO = ["gemini-flash-lite-latest"];

const FINALES_NORMALES = new Set<FinishReason | undefined>([
  undefined,
  FinishReason.STOP,
  FinishReason.FINISH_REASON_UNSPECIFIED,
]);

export async function* responderConGemini(
  datos: DatosCurso,
  pregunta: string,
  historial: TurnoChat[],
  leccionActual: string | null,
  miembro: boolean,
  senal: AbortSignal,
): AsyncGenerator<string> {
  cliente ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });

  const contents: Content[] = [
    ...historial.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })),
    { role: "user", parts: [{ text: preguntaConContexto(datos, pregunta, leccionActual) }] },
  ];

  const config = {
    systemInstruction: instrucciones(datos, miembro),
    // Holgado: en los modelos que razonan, ese razonamiento también cuenta aquí.
    maxOutputTokens: 8192,
    abortSignal: senal,
  };

  // Si un modelo está saturado (503) o sin cuota gratuita (429), se prueba
  // el siguiente. El error llega antes del primer texto, así que el alumno
  // no ve respuestas mezcladas.
  const modelos = [...new Set([MODELO_GEMINI, ...MODELOS_RESPALDO])];
  let flujo: Awaited<ReturnType<GoogleGenAI["models"]["generateContentStream"]>> | null = null;
  for (const [i, model] of modelos.entries()) {
    try {
      flujo = await cliente.models.generateContentStream({ model, contents, config });
      break;
    } catch (e) {
      const reintentable = e instanceof ApiError && (e.status === 429 || e.status === 503 || e.status === 404);
      if (!reintentable || i === modelos.length - 1 || senal.aborted) throw e;
      console.warn(`Gemini: ${model} respondió ${(e as ApiError).status}, probando ${modelos[i + 1]}.`);
    }
  }
  if (!flujo) return;

  let final: FinishReason | undefined;
  for await (const trozo of flujo) {
    const texto = trozo.text;
    if (texto) yield texto;
    final = trozo.candidates?.[0]?.finishReason ?? final;
  }

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
