import Anthropic from "@anthropic-ai/sdk";
import { ApiError, GoogleGenAI } from "@google/genai";
import { MODELO, mensajeDeError, proveedorIA } from "./asistente";
import { mensajeDeErrorGemini } from "./asistente-gemini";
import { ErrorDeDatos } from "./http";
import { PALABRAS_POR_SEGUNDO } from "./narracion";
import type { Diapositiva, Leccion, OpcionesPresentacion } from "./tipos";

// Presentación de una lección hecha por la IA: diapositivas cortas y lo que
// dice la voz en cada una. La voz la pone el dispositivo del alumno (no se
// guardan audios), así que aquí solo se genera y se valida el texto. La coach
// puede pedir duración, número de diapositivas, tono e indicaciones, y después
// editarla a mano o rehacer una sola diapositiva.

export const MAX_DIAPOSITIVAS = 12;
export const MAX_MINUTOS = 15;
const MAX_NARRACION = 2_000;
const MAX_INDICACIONES = 500;
const PALABRAS_POR_MINUTO = PALABRAS_POR_SEGUNDO * 60;

const TONOS: Record<NonNullable<OpcionesPresentacion["tono"]>, string> = {
  cercano: "cálida y cercana, como una coach que explica con paciencia",
  formal: "profesional y sobria, clara y sin bromas, aunque tutea",
  motivador: "entusiasta y motivadora, que anima a poner en práctica lo que explica",
};

/** Revisa lo que pidió la coach; lo que no viene o no es válido queda en automático. */
export function opcionesDe(datos: unknown): OpcionesPresentacion {
  const x = (datos && typeof datos === "object" ? datos : {}) as Record<string, unknown>;
  const entero = (v: unknown, min: number, max: number) => {
    const n = Math.round(Number(v));
    return v !== undefined && v !== null && v !== "" && Number.isFinite(n) && n >= min && n <= max ? n : undefined;
  };
  const minutos = entero(x.minutos, 1, MAX_MINUTOS);
  const diapositivas = entero(x.diapositivas, 2, MAX_DIAPOSITIVAS);
  const tono = typeof x.tono === "string" && x.tono in TONOS ? (x.tono as OpcionesPresentacion["tono"]) : undefined;
  const indicaciones = typeof x.indicaciones === "string" ? x.indicaciones.trim().slice(0, MAX_INDICACIONES) : "";
  return {
    ...(minutos ? { minutos } : {}),
    ...(diapositivas ? { diapositivas } : {}),
    ...(tono ? { tono } : {}),
    ...(indicaciones ? { indicaciones } : {}),
  };
}

/** Cuántas diapositivas y cuántas palabras por diapositiva, según lo que pidió la coach. */
function medidas(o: OpcionesPresentacion) {
  if (o.minutos) {
    const total = o.minutos * PALABRAS_POR_MINUTO;
    const n = o.diapositivas ?? Math.min(MAX_DIAPOSITIVAS, Math.max(3, Math.round(total / 80)));
    const por = total / n;
    return {
      diapositivas: `Exactamente ${n} diapositivas.`,
      palabras: `de ${Math.max(15, Math.round(por * 0.85))} a ${Math.min(280, Math.round(por * 1.15))} palabras`,
      duracion: `La narración completa debe durar unos ${o.minutos} ${o.minutos === 1 ? "minuto" : "minutos"} leída en voz alta (unas ${Math.round(total)} palabras en total). Si la lección tiene poco texto, explica con más calma y más ejemplos de la misma lección, sin inventar datos.`,
    };
  }
  return {
    diapositivas: o.diapositivas
      ? `Exactamente ${o.diapositivas} diapositivas.`
      : "De 4 a 8 diapositivas, según lo largo de la lección.",
    palabras: "de 35 a 90 palabras",
    duracion: "",
  };
}

function instrucciones(o: OpcionesPresentacion): string {
  const m = medidas(o);
  return `Eres diseñadora instruccional en Merkatics, una plataforma de cursos para emprendedores y dueños de pequeños negocios en México. Conviertes una lección escrita en una presentación narrada: diapositivas sencillas que se ven mientras una voz explica.

Reglas:
- Usa solo lo que dice la lección (texto y transcripción). No inventes datos, cifras, nombres ni ejemplos.
- ${m.diapositivas} La primera presenta de qué trata; la última resume lo más importante.
- "titulo": corto (máximo 7 palabras).
- "puntos": de 2 a 4 frases muy cortas (máximo 12 palabras cada una), como en una diapositiva; sin punto final.
- "narracion": lo que dice la voz en esa diapositiva, ${m.palabras}, en español de México, tuteando, con una voz ${TONOS[o.tono ?? "cercano"]}. Frases completas y no muy largas (la lee una voz sintética). Sin emojis, sin viñetas, sin Markdown, sin abreviaturas raras; escribe "por ciento" en vez de "%" y las cantidades de dinero en palabras o como "500 pesos".
- No digas "en esta diapositiva" ni "como ves en pantalla".
- Sin saludos con género ("Hola, emprendedor"): di "Hola" o entra directo al tema.${m.duracion ? `\n- ${m.duracion}` : ""}${
    o.indicaciones
      ? `\n\nIndicaciones de la coach (síguelas siempre que no contradigan las reglas de arriba):\n${o.indicaciones}`
      : ""
  }`;
}

const ESQUEMA_DIAPOSITIVA = {
  type: "object",
  properties: {
    titulo: { type: "string" },
    puntos: { type: "array", items: { type: "string" } },
    narracion: { type: "string" },
  },
  required: ["titulo", "puntos", "narracion"],
  additionalProperties: false,
};

const ESQUEMA = {
  type: "object",
  properties: { diapositivas: { type: "array", items: ESQUEMA_DIAPOSITIVA } },
  required: ["diapositivas"],
  additionalProperties: false,
};

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Limpia una diapositiva (de la IA o del editor de la coach). */
function limpiar(d: unknown): Diapositiva {
  const x = (d ?? {}) as Record<string, unknown>;
  return {
    titulo: texto(x.titulo, 80),
    puntos: (Array.isArray(x.puntos) ? x.puntos : [])
      .map((p) => texto(p, 120).replace(/[.;]$/, ""))
      .filter(Boolean)
      .slice(0, 4),
    // Sin Markdown: la voz leería los asteriscos.
    narracion: texto(x.narracion, MAX_NARRACION).replace(/[*_#`]/g, ""),
  };
}

function leerJsonIA(crudo: string): Record<string, unknown> {
  try {
    return JSON.parse(crudo) as Record<string, unknown>;
  } catch {
    throw new ErrorDeDatos("La IA devolvió la presentación incompleta. Inténtalo de nuevo.");
  }
}

/** Revisa y limpia lo que devolvió la IA. */
function validar(crudo: string): Diapositiva[] {
  const datos = leerJsonIA(crudo);
  const lista = (Array.isArray(datos.diapositivas) ? datos.diapositivas : [])
    .slice(0, MAX_DIAPOSITIVAS)
    .map(limpiar)
    .filter((d) => d.titulo && d.narracion);
  if (lista.length < 2) throw new ErrorDeDatos("La IA no pudo armar la presentación de esta lección. Inténtalo de nuevo.");
  return lista;
}

/** Lo que guarda la coach desde el editor: cada diapositiva con título y lo que dice la voz. */
export function diapositivasEditadas(entrada: unknown): Diapositiva[] {
  if (!Array.isArray(entrada) || entrada.length === 0) throw new ErrorDeDatos("La presentación necesita al menos una diapositiva.");
  if (entrada.length > MAX_DIAPOSITIVAS) throw new ErrorDeDatos(`La presentación puede tener hasta ${MAX_DIAPOSITIVAS} diapositivas.`);
  const lista = entrada.map(limpiar);
  const faltan = lista.flatMap((d, i) => [
    ...(d.titulo ? [] : [`La diapositiva ${i + 1} necesita un título.`]),
    ...(d.narracion ? [] : [`La diapositiva ${i + 1} necesita lo que dice la voz.`]),
  ]);
  if (faltan.length) throw new ErrorDeDatos(faltan.join(" "));
  return lista;
}

function material(l: Leccion): string[] {
  return [
    `Lección: «${l.titulo}»`,
    l.resumen ? `Resumen: ${l.resumen}` : "",
    `<texto>\n${l.contenido.slice(0, 20_000)}\n</texto>`,
    l.transcripcion ? `<transcripcion>\n${l.transcripcion.slice(0, 20_000)}\n</transcripcion>` : "",
  ].filter(Boolean);
}

const MODELOS_GEMINI = ["gemini-flash-latest", "gemini-flash-lite-latest"];

type Pedido = { sistema: string; mensaje: string; esquema: object };

async function conGemini({ sistema, mensaje, esquema }: Pedido): Promise<string> {
  const cliente = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });
  for (const [i, model] of MODELOS_GEMINI.entries()) {
    try {
      const r = await cliente.models.generateContent({
        model,
        contents: mensaje,
        config: {
          systemInstruction: sistema,
          responseMimeType: "application/json",
          responseJsonSchema: esquema,
          maxOutputTokens: 16_384,
          abortSignal: AbortSignal.timeout(55_000),
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

async function conClaude({ sistema, mensaje, esquema }: Pedido): Promise<string> {
  try {
    const respuesta = await new Anthropic().messages
      .stream({
        model: MODELO,
        max_tokens: 16_000,
        system: sistema,
        output_config: { effort: "low", format: { type: "json_schema", schema: esquema as Record<string, unknown> } },
        messages: [{ role: "user", content: mensaje }],
      })
      .finalMessage();
    if (respuesta.stop_reason === "refusal") throw new ErrorDeDatos("La IA no pudo trabajar con esta lección.");
    return respuesta.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  } catch (e) {
    if (e instanceof ErrorDeDatos) throw e;
    console.error("Presentación con IA (Claude):", e);
    throw new ErrorDeDatos(mensajeDeError(e));
  }
}

async function preguntar(p: Pedido): Promise<string> {
  const proveedor = proveedorIA();
  if (!proveedor) throw new ErrorDeDatos("Para generar presentaciones hace falta conectar una IA (clave de Gemini o de Claude).");
  return proveedor === "gemini" ? conGemini(p) : conClaude(p);
}

function revisarTexto(l: Leccion) {
  if ((l.contenido + l.transcripcion).trim().length < 120) {
    throw new ErrorDeDatos("La lección tiene muy poco texto para armar una presentación. Escribe su contenido primero.");
  }
}

/** Genera las diapositivas de una lección con la IA configurada. */
export async function generarPresentacion(l: Leccion, opciones: OpcionesPresentacion = {}): Promise<Diapositiva[]> {
  revisarTexto(l);
  const crudo = await preguntar({
    sistema: instrucciones(opciones),
    mensaje: [...material(l), "Responde solo con el JSON de la presentación."].join("\n\n"),
    esquema: ESQUEMA,
  });
  return validar(crudo);
}

/** Rehace una sola diapositiva con lo que pida la coach, sin tocar las demás. */
export async function rehacerDiapositiva(
  l: Leccion,
  diapositivas: Diapositiva[],
  indice: number,
  indicacion: string,
  opciones: OpcionesPresentacion = {},
): Promise<Diapositiva> {
  revisarTexto(l);
  const actuales = diapositivas.map(limpiar);
  if (!actuales[indice]) throw new ErrorDeDatos("No encontramos esa diapositiva.");
  const pedidoCoach = indicacion.trim().slice(0, MAX_INDICACIONES);
  const crudo = await preguntar({
    sistema: instrucciones(opciones),
    mensaje: [
      ...material(l),
      `<presentacion_actual>\n${actuales
        .map((d, i) => `Diapositiva ${i + 1}: ${d.titulo}\nPuntos: ${d.puntos.join(" | ")}\nVoz: ${d.narracion}`)
        .join("\n\n")}\n</presentacion_actual>`,
      `Rehaz solo la diapositiva ${indice + 1} («${actuales[indice].titulo}»). Que siga encajando entre la anterior y la siguiente y no repita lo que dicen las demás.${
        pedidoCoach ? ` Lo que pide la coach: ${pedidoCoach}` : " Mejórala: más clara y natural al escucharla."
      }`,
      "Responde solo con el JSON de esa diapositiva.",
    ].join("\n\n"),
    esquema: ESQUEMA_DIAPOSITIVA,
  });
  const nueva = limpiar(leerJsonIA(crudo));
  if (!nueva.titulo || !nueva.narracion) throw new ErrorDeDatos("La IA no pudo rehacer la diapositiva. Inténtalo de nuevo.");
  return nueva;
}
