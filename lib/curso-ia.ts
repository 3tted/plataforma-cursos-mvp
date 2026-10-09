import Anthropic from "@anthropic-ai/sdk";
import { ApiError, GoogleGenAI, type Part } from "@google/genai";
import { MODELO, mensajeDeError, proveedorIA } from "./asistente";
import { mensajeDeErrorGemini } from "./asistente-gemini";
import { ErrorDeDatos } from "./http";

// La coach sube un documento (PDF, Word o texto) y la IA propone un curso
// completo: módulos, lecciones, repaso por lección y examen final. Lo que
// devuelve se guarda como borrador; la coach lo revisa en el editor antes de
// publicarlo. El PDF se manda tal cual (la IA lee también tablas e imágenes);
// del Word solo se extrae el texto.

/** Vercel acepta peticiones de hasta 4.5 MB; se deja margen para el formulario. */
export const MAX_BYTES_DOCUMENTO = 4 * 1024 * 1024;
const MAX_CARACTERES = 150_000;

export type Documento = { tipo: "pdf"; datos: Buffer; nombre: string } | { tipo: "texto"; texto: string; nombre: string };

/** Lo que propone la IA, antes de pasar por la misma validación del editor. */
export interface PropuestaCurso {
  titulo: string;
  subtitulo: string;
  aprenderas: string[];
  requisitos: string;
  preguntas_sugeridas: string[];
  modulos: {
    titulo: string;
    lecciones: {
      titulo: string;
      duracion_min: number;
      resumen: string;
      contenido: string;
      preguntas_sugeridas: string[];
      repaso: PreguntaPropuesta[];
    }[];
  }[];
  examen: (PreguntaPropuesta & { leccion: number })[];
}

interface PreguntaPropuesta {
  enunciado: string;
  opciones: string[];
  correcta: number;
  explicacion: string;
}

/** Convierte el archivo subido en algo que la IA pueda leer. */
export async function leerDocumento(archivo: File): Promise<Documento> {
  if (archivo.size === 0) throw new ErrorDeDatos("El archivo está vacío.");
  if (archivo.size > MAX_BYTES_DOCUMENTO) {
    throw new ErrorDeDatos("El documento pesa más de 4 MB. Prueba con uno más ligero o pega el texto.");
  }
  const nombre = archivo.name.slice(0, 120);
  const extension = nombre.toLowerCase().split(".").pop() ?? "";
  const datos = Buffer.from(await archivo.arrayBuffer());

  if (extension === "pdf" || archivo.type === "application/pdf") {
    if (datos.subarray(0, 5).toString() !== "%PDF-") throw new ErrorDeDatos("Ese archivo no parece un PDF válido.");
    return { tipo: "pdf", datos, nombre };
  }
  if (extension === "docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: datos }).catch(() => {
      throw new ErrorDeDatos("No pudimos abrir ese Word. Guárdalo como .docx o expórtalo a PDF.");
    });
    return conTexto(value, nombre);
  }
  if (extension === "doc") {
    throw new ErrorDeDatos("Los Word antiguos (.doc) no se pueden leer. Guárdalo como .docx o expórtalo a PDF.");
  }
  if (extension === "txt" || extension === "md" || archivo.type.startsWith("text/")) {
    return conTexto(datos.toString("utf8"), nombre);
  }
  throw new ErrorDeDatos("Sube un PDF, un Word (.docx) o un archivo de texto.");
}

export function conTexto(texto: string, nombre: string): Documento {
  const limpio = texto.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (limpio.length < 200) {
    throw new ErrorDeDatos("El documento tiene muy poco texto para armar un curso (necesita al menos un par de párrafos).");
  }
  return { tipo: "texto", texto: limpio.slice(0, MAX_CARACTERES), nombre };
}

const INSTRUCCIONES = `Eres diseñadora instruccional en Merkatics, una plataforma de cursos y comunidades para emprendedores y dueños de pequeños negocios en México. Una coach te comparte un documento suyo y tú lo conviertes en un curso en línea listo para revisar.

Reglas:
- Escribe en español de México, tuteando al alumno, claro y cálido, sin tecnicismos innecesarios.
- Usa solo lo que dice el documento. No inventes datos, cifras, nombres, casos ni recomendaciones que no estén ahí. Si algo no está, no lo agregues.
- Tamaño según el documento: de 1 a 4 módulos y de 2 a 12 lecciones en total. Un documento corto da un curso corto.
- Cada lección enseña una sola idea. "contenido" es la lección en Markdown (## para subtítulos, **negritas**, listas), de 150 a 500 palabras, fiel al documento pero redactada para aprender, no copiada tal cual.
- "duracion_min" es lo que tarda en estudiarse la lección (de 3 a 15).
- "resumen" es una sola línea que dice qué logra el alumno con la lección.
- "repaso": 2 preguntas por lección sobre esa lección. Cada pregunta con 3 o 4 opciones, una sola correcta ("correcta" es el índice desde 0, y cambia de posición entre preguntas), opciones incorrectas creíbles, y una "explicacion" breve de por qué la correcta lo es según la lección.
- "examen": de 5 a 10 preguntas que cubran todo el curso, con el mismo formato y "leccion" = número de la lección de donde sale (contando desde 1 en el orden del curso).
- "aprenderas": de 3 a 5 cosas concretas que el alumno sabrá hacer. "preguntas_sugeridas": preguntas que un alumno le haría al asistente del curso.
- "requisitos": lo que se necesita saber antes, o "Ninguno.".
- El alumno nunca ve el documento: en lecciones, preguntas y explicaciones no digas "el documento" ni "el texto"; habla de "la lección" o explica la idea directamente.`;

const PREGUNTA = {
  type: "object",
  properties: {
    enunciado: { type: "string" },
    opciones: { type: "array", items: { type: "string" } },
    correcta: { type: "integer" },
    explicacion: { type: "string" },
  },
  required: ["enunciado", "opciones", "correcta", "explicacion"],
  additionalProperties: false,
};

const ESQUEMA = {
  type: "object",
  properties: {
    titulo: { type: "string" },
    subtitulo: { type: "string" },
    aprenderas: { type: "array", items: { type: "string" } },
    requisitos: { type: "string" },
    preguntas_sugeridas: { type: "array", items: { type: "string" } },
    modulos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          lecciones: {
            type: "array",
            items: {
              type: "object",
              properties: {
                titulo: { type: "string" },
                duracion_min: { type: "integer" },
                resumen: { type: "string" },
                contenido: { type: "string" },
                preguntas_sugeridas: { type: "array", items: { type: "string" } },
                repaso: { type: "array", items: PREGUNTA },
              },
              required: ["titulo", "duracion_min", "resumen", "contenido", "preguntas_sugeridas", "repaso"],
              additionalProperties: false,
            },
          },
        },
        required: ["titulo", "lecciones"],
        additionalProperties: false,
      },
    },
    examen: {
      type: "array",
      items: {
        ...PREGUNTA,
        properties: { ...PREGUNTA.properties, leccion: { type: "integer" } },
        required: [...PREGUNTA.required, "leccion"],
      },
    },
  },
  required: ["titulo", "subtitulo", "aprenderas", "requisitos", "preguntas_sugeridas", "modulos", "examen"],
  additionalProperties: false,
};

function pedido(doc: Documento, indicaciones: string): string {
  return [
    `Arma el curso a partir del documento "${doc.nombre}".`,
    indicaciones ? `Indicaciones de la coach: ${indicaciones}` : "",
    "Responde solo con el JSON del curso.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Pide la propuesta a la IA configurada. Lanza ErrorDeDatos con un mensaje para la coach. */
export async function proponerCurso(doc: Documento, indicaciones: string): Promise<PropuestaCurso> {
  const proveedor = proveedorIA();
  if (!proveedor) {
    throw new ErrorDeDatos("Para crear cursos con IA hace falta conectar una IA (GEMINI_API_KEY o ANTHROPIC_API_KEY en .env.local).");
  }
  const texto = proveedor === "gemini" ? await conGemini(doc, indicaciones) : await conClaude(doc, indicaciones);
  let propuesta: PropuestaCurso;
  try {
    propuesta = JSON.parse(texto) as PropuestaCurso;
  } catch {
    throw new ErrorDeDatos("La IA devolvió el curso incompleto. Inténtalo de nuevo o prueba con un documento más corto.");
  }
  if (!Array.isArray(propuesta.modulos) || propuesta.modulos.every((m) => !m.lecciones?.length)) {
    throw new ErrorDeDatos("La IA no encontró suficiente contenido en el documento para armar lecciones.");
  }
  return propuesta;
}

// Para armar un curso conviene el modelo más capaz; Lite queda de respaldo.
const MODELOS_GEMINI = ["gemini-flash-latest", "gemini-flash-lite-latest"];

async function conGemini(doc: Documento, indicaciones: string): Promise<string> {
  const cliente = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });
  const partes: Part[] =
    doc.tipo === "pdf"
      ? [{ inlineData: { mimeType: "application/pdf", data: doc.datos.toString("base64") } }]
      : [{ text: `<documento>\n${doc.texto}\n</documento>` }];
  partes.push({ text: pedido(doc, indicaciones) });

  for (const [i, model] of MODELOS_GEMINI.entries()) {
    try {
      const respuesta = await cliente.models.generateContent({
        model,
        contents: [{ role: "user", parts: partes }],
        config: {
          systemInstruction: INSTRUCCIONES,
          responseMimeType: "application/json",
          responseJsonSchema: ESQUEMA,
          maxOutputTokens: 32_768,
          ...(model === "gemini-flash-latest" ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      });
      const texto = respuesta.text;
      if (!texto) throw new ErrorDeDatos("La IA no pudo leer el documento. Prueba con otro archivo o pega el texto.");
      return texto;
    } catch (e) {
      const reintentable = e instanceof ApiError && [429, 500, 503, 404].includes(e.status);
      if (reintentable && i < MODELOS_GEMINI.length - 1) {
        console.warn(`Curso con IA: ${model} respondió ${(e as ApiError).status}, probando ${MODELOS_GEMINI[i + 1]}.`);
        continue;
      }
      if (e instanceof ErrorDeDatos) throw e;
      console.error("Curso con IA (Gemini):", e);
      if (e instanceof ApiError && e.status === 400 && doc.tipo === "pdf" && !/api key/i.test(e.message)) {
        throw new ErrorDeDatos("La IA no pudo abrir ese PDF. Prueba exportándolo de nuevo o sube el Word.");
      }
      throw new ErrorDeDatos(mensajeDeErrorGemini(e));
    }
  }
  throw new ErrorDeDatos("La IA no está disponible por ahora. Inténtalo en unos minutos.");
}

async function conClaude(doc: Documento, indicaciones: string): Promise<string> {
  const cliente = new Anthropic();
  try {
    const mensaje = await cliente.messages
      .stream({
        model: MODELO,
        max_tokens: 32_000,
        system: INSTRUCCIONES,
        output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
        messages: [
          {
            role: "user",
            content: [
              doc.tipo === "pdf"
                ? {
                    type: "document",
                    source: { type: "base64", media_type: "application/pdf", data: doc.datos.toString("base64") },
                  }
                : { type: "text", text: `<documento>\n${doc.texto}\n</documento>` },
              { type: "text", text: pedido(doc, indicaciones) },
            ],
          },
        ],
      })
      .finalMessage();
    if (mensaje.stop_reason === "refusal") {
      throw new ErrorDeDatos("La IA no pudo trabajar con ese documento. Prueba con otro.");
    }
    if (mensaje.stop_reason === "max_tokens") {
      throw new ErrorDeDatos("El documento da para un curso demasiado largo. Divídelo en partes o pide menos lecciones.");
    }
    return mensaje.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  } catch (e) {
    if (e instanceof ErrorDeDatos) throw e;
    console.error("Curso con IA (Claude):", e);
    throw new ErrorDeDatos(mensajeDeError(e));
  }
}

/** Los modelos suelen poner la correcta siempre primero: se barajan las opciones. */
function pregunta(q: PreguntaPropuesta) {
  const opciones = Array.isArray(q.opciones) ? q.opciones : [];
  const orden = opciones.map((_, i) => i);
  for (let i = orden.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [orden[i], orden[j]] = [orden[j], orden[i]];
  }
  return {
    enunciado: q.enunciado,
    opciones: orden.map((i) => opciones[i]),
    correcta: Math.max(orden.indexOf(q.correcta), 0),
    explicacion: q.explicacion,
  };
}

/** "Módulo 1: Empezar" → "Empezar" (la plataforma ya numera módulos y lecciones). */
const sinNumero = (titulo: string) =>
  String(titulo ?? "").replace(/^\s*(m[oó]dulo|lecci[oó]n|tema|parte)\s*\d+\s*[:.\-–—]\s*/i, "").trim();

/**
 * Pasa la propuesta al formato del editor. Las lecciones llevan ids
 * provisionales ("ia-1", "ia-2"…) para que el examen apunte a ellas;
 * aplicarEdicion les da su id definitivo. Como en los demás cursos, el módulo
 * 1 queda gratis; si solo hay un módulo, solo la primera lección.
 */
export function comoEdicion(p: PropuestaCurso): Record<string, unknown> {
  let n = 0;
  const unSoloModulo = p.modulos.length === 1;
  const modulos = p.modulos.map((m, i) => ({
    titulo: sinNumero(m.titulo),
    lecciones: (m.lecciones ?? []).map((l, k) => ({
      id: `ia-${++n}`,
      titulo: sinNumero(l.titulo),
      duracion_min: l.duracion_min,
      gratis: unSoloModulo ? k === 0 : i === 0,
      resumen: l.resumen,
      contenido: l.contenido,
      transcripcion: "",
      preguntas_sugeridas: l.preguntas_sugeridas,
      repaso: (l.repaso ?? []).map(pregunta),
    })),
  }));
  return {
    titulo: p.titulo,
    subtitulo: p.subtitulo,
    aprenderas: p.aprenderas,
    requisitos: p.requisitos,
    preguntas_sugeridas: p.preguntas_sugeridas,
    modulos,
    examen: (p.examen ?? []).map((q) => ({
      ...pregunta(q),
      ...(Number.isInteger(q.leccion) && q.leccion >= 1 && q.leccion <= n ? { leccion: `ia-${q.leccion}` } : {}),
    })),
  };
}
