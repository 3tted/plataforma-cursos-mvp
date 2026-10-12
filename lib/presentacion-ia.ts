import Anthropic from "@anthropic-ai/sdk";
import { ApiError, GoogleGenAI } from "@google/genai";
import { MODELO, mensajeDeError, proveedorIA } from "./asistente";
import { mensajeDeErrorGemini } from "./asistente-gemini";
import { ErrorDeDatos } from "./http";
import type { Diapositiva, Leccion } from "./tipos";

// Presentación de una lección hecha por la IA: diapositivas cortas y lo que
// dice la voz en cada una. La voz la pone el dispositivo del alumno (no se
// guardan audios), así que aquí solo se genera y se valida el texto.

const MIN_DIAPOSITIVAS = 4;
const MAX_DIAPOSITIVAS = 8;

const INSTRUCCIONES = `Eres diseñadora instruccional en Merkatics, una plataforma de cursos para emprendedores y dueños de pequeños negocios en México. Conviertes una lección escrita en una presentación narrada: diapositivas sencillas que se ven mientras una voz explica.

Reglas:
- Usa solo lo que dice la lección (texto y transcripción). No inventes datos, cifras, nombres ni ejemplos.
- De ${MIN_DIAPOSITIVAS} a ${MAX_DIAPOSITIVAS} diapositivas, según lo largo de la lección. La primera presenta de qué trata; la última resume lo más importante.
- "titulo": corto (máximo 7 palabras).
- "puntos": de 2 a 4 frases muy cortas (máximo 12 palabras cada una), como en una diapositiva; sin punto final.
- "narracion": lo que dice la voz en esa diapositiva, de 35 a 90 palabras, en español de México, tuteando, cálida y clara, como una coach que explica. Frases completas y no muy largas (la lee una voz sintética). Sin emojis, sin viñetas, sin Markdown, sin abreviaturas raras; escribe "por ciento" en vez de "%" y las cantidades de dinero en palabras o como "500 pesos".
- No digas "en esta diapositiva" ni "como ves en pantalla".
- Sin saludos con género ("Hola, emprendedor"): di "Hola" o entra directo al tema.`;

const ESQUEMA = {
  type: "object",
  properties: {
    diapositivas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          puntos: { type: "array", items: { type: "string" } },
          narracion: { type: "string" },
        },
        required: ["titulo", "puntos", "narracion"],
        additionalProperties: false,
      },
    },
  },
  required: ["diapositivas"],
  additionalProperties: false,
};

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Revisa y limpia lo que devolvió la IA. */
function validar(crudo: string): Diapositiva[] {
  let datos: { diapositivas?: unknown };
  try {
    datos = JSON.parse(crudo) as { diapositivas?: unknown };
  } catch {
    throw new ErrorDeDatos("La IA devolvió la presentación incompleta. Inténtalo de nuevo.");
  }
  const lista = (Array.isArray(datos.diapositivas) ? datos.diapositivas : [])
    .slice(0, MAX_DIAPOSITIVAS)
    .map((d): Diapositiva => {
      const x = (d ?? {}) as Record<string, unknown>;
      return {
        titulo: texto(x.titulo, 80),
        puntos: (Array.isArray(x.puntos) ? x.puntos : [])
          .map((p) => texto(p, 120).replace(/[.;]$/, ""))
          .filter(Boolean)
          .slice(0, 4),
        // Sin Markdown: la voz leería los asteriscos.
        narracion: texto(x.narracion, 900).replace(/[*_#`]/g, ""),
      };
    })
    .filter((d) => d.titulo && d.narracion);
  if (lista.length < 2) throw new ErrorDeDatos("La IA no pudo armar la presentación de esta lección. Inténtalo de nuevo.");
  return lista;
}

function pedido(l: Leccion): string {
  return [
    `Lección: «${l.titulo}»`,
    l.resumen ? `Resumen: ${l.resumen}` : "",
    `<texto>\n${l.contenido.slice(0, 20_000)}\n</texto>`,
    l.transcripcion ? `<transcripcion>\n${l.transcripcion.slice(0, 20_000)}\n</transcripcion>` : "",
    "Responde solo con el JSON de la presentación.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const MODELOS_GEMINI = ["gemini-flash-latest", "gemini-flash-lite-latest"];

async function conGemini(l: Leccion): Promise<string> {
  const cliente = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });
  for (const [i, model] of MODELOS_GEMINI.entries()) {
    try {
      const r = await cliente.models.generateContent({
        model,
        contents: pedido(l),
        config: {
          systemInstruction: INSTRUCCIONES,
          responseMimeType: "application/json",
          responseJsonSchema: ESQUEMA,
          maxOutputTokens: 8_192,
          abortSignal: AbortSignal.timeout(50_000),
          httpOptions: { retryOptions: { attempts: 2 } },
          ...(model === "gemini-flash-latest" ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      });
      if (!r.text) throw new ErrorDeDatos("La IA no respondió. Inténtalo de nuevo.");
      return r.text;
    } catch (e) {
      const reintentable = e instanceof ApiError && [429, 500, 503, 404].includes(e.status);
      if (reintentable && i < MODELOS_GEMINI.length - 1) continue;
      if (e instanceof ErrorDeDatos) throw e;
      console.error("Presentación con IA (Gemini):", e);
      if (e instanceof Error && e.name === "TimeoutError") throw new ErrorDeDatos("La IA tardó demasiado. Inténtalo de nuevo.");
      throw new ErrorDeDatos(mensajeDeErrorGemini(e));
    }
  }
  throw new ErrorDeDatos("La IA no está disponible por ahora. Inténtalo en unos minutos.");
}

async function conClaude(l: Leccion): Promise<string> {
  try {
    const mensaje = await new Anthropic().messages
      .stream({
        model: MODELO,
        max_tokens: 8_000,
        system: INSTRUCCIONES,
        output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
        messages: [{ role: "user", content: pedido(l) }],
      })
      .finalMessage();
    if (mensaje.stop_reason === "refusal") throw new ErrorDeDatos("La IA no pudo trabajar con esta lección.");
    return mensaje.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  } catch (e) {
    if (e instanceof ErrorDeDatos) throw e;
    console.error("Presentación con IA (Claude):", e);
    throw new ErrorDeDatos(mensajeDeError(e));
  }
}

/** Genera las diapositivas de una lección con la IA configurada. */
export async function generarPresentacion(l: Leccion): Promise<Diapositiva[]> {
  if ((l.contenido + l.transcripcion).trim().length < 120) {
    throw new ErrorDeDatos("La lección tiene muy poco texto para armar una presentación. Escribe su contenido primero.");
  }
  const proveedor = proveedorIA();
  if (!proveedor) throw new ErrorDeDatos("Para generar presentaciones hace falta conectar una IA (clave de Gemini o de Claude).");
  return validar(proveedor === "gemini" ? await conGemini(l) : await conClaude(l));
}
