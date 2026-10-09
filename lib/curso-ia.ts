import Anthropic from "@anthropic-ai/sdk";
import { ApiError, GoogleGenAI, type Content, type Part } from "@google/genai";
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

/**
 * Cuántas lecciones y preguntas pidió la coach. Lo que no pidió lo decide la
 * IA según el documento.
 */
export interface Medidas {
  lecciones?: number;
  repaso?: number;
  examen?: number;
}

export const LIMITES_MEDIDAS = { lecciones: [1, 30], repaso: [0, 5], examen: [1, 30] } as const;

/** Lo que propone la IA, antes de pasar por la misma validación del editor. */
export interface PropuestaCurso {
  titulo: string;
  subtitulo: string;
  aprenderas: string[];
  requisitos: string;
  preguntas_sugeridas: string[];
  /** Lista plana (así el esquema puede fijar cuántas son); cada una dice su módulo. */
  lecciones: {
    modulo: string;
    titulo: string;
    duracion_min: number;
    resumen: string;
    contenido: string;
    preguntas_sugeridas: string[];
    repaso: PreguntaPropuesta[];
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

// ---------------------------------------------------------------------------
// Cantidades que pide la coach
// ---------------------------------------------------------------------------

const PALABRAS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veinticinco: 25, treinta: 30,
};
const NUM = `\\b(\\d{1,2}|${Object.keys(PALABRAS).join("|")})`;
const numero = (v: string) => (/^\d+$/.test(v) ? Number(v) : PALABRAS[v]);

/**
 * Saca las cantidades que la coach escribió en sus indicaciones ("7 lecciones",
 * "un examen de 15 preguntas", "4 preguntas de repaso"), para exigirlas
 * aunque no haya llenado los campos.
 */
export function medidasDelTexto(indicaciones: string): Medidas {
  const t = indicaciones.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const buscar = (patrones: string[]) => {
    for (const p of patrones) {
      const m = new RegExp(p).exec(t);
      if (m) return numero(m[1]);
    }
    return undefined;
  };
  return {
    lecciones: buscar([`${NUM}\\s+(?:lecciones|leccion|clases|temas)\\b`]),
    examen: buscar([
      `examen(?:\\s+final)?\\s+(?:de|con)\\s+${NUM}\\s+preguntas?`,
      `${NUM}\\s+preguntas?\\s+(?:en|para|de|del)\\s+(?:el\\s+)?examen`,
    ]),
    repaso: buscar([
      `${NUM}\\s+preguntas?\\s+(?:de\\s+repaso|por\\s+leccion|en\\s+cada\\s+leccion)`,
      `repaso\\s+(?:de|con)\\s+${NUM}\\s+preguntas?`,
    ]),
  };
}

/** Une los campos del formulario (mandan) con lo que se leyó del texto, dentro de los límites. */
export function juntarMedidas(campos: Medidas, texto: Medidas): Medidas {
  const r: Medidas = {};
  for (const k of ["lecciones", "repaso", "examen"] as const) {
    const v = campos[k] ?? texto[k];
    if (v === undefined || !Number.isFinite(v)) continue;
    const [min, max] = LIMITES_MEDIDAS[k];
    r[k] = Math.min(Math.max(Math.round(v), min), max);
  }
  return r;
}

// ---------------------------------------------------------------------------
// Pedido a la IA
// ---------------------------------------------------------------------------

const INSTRUCCIONES = `Eres diseñadora instruccional en Merkatics, una plataforma de cursos y comunidades para emprendedores y dueños de pequeños negocios en México. Una coach te comparte un documento suyo y tú lo conviertes en un curso en línea listo para revisar.

Lo más importante: si la coach pide cantidades (cuántas lecciones, cuántas preguntas de repaso, cuántas del examen) o cualquier otra cosa en sus indicaciones, eso manda sobre los valores por defecto de abajo. Cumple las cantidades exactas.

Reglas:
- Escribe en español de México, tuteando al alumno, claro y cálido, sin tecnicismos innecesarios.
- Usa solo lo que dice el documento. No inventes datos, cifras, nombres, casos ni recomendaciones que no estén ahí. Si te piden más lecciones de las que el documento da naturalmente, divide los temas en partes más pequeñas; si te piden menos, junta temas.
- "lecciones" es la lista de todas las lecciones en orden. "modulo" es el título del módulo al que pertenece cada una; las lecciones seguidas del mismo módulo llevan exactamente el mismo título de módulo. Agrupa en 1 a 4 módulos según los temas.
- Cada lección enseña una idea. "contenido" es la lección en Markdown (## para subtítulos, **negritas**, listas), de 150 a 500 palabras, fiel al documento pero redactada para aprender, no copiada tal cual.
- "duracion_min" es lo que tarda en estudiarse la lección (de 3 a 15).
- "resumen" es una sola línea que dice qué logra el alumno con la lección.
- "repaso": preguntas sobre esa lección. Cada pregunta con 3 o 4 opciones, una sola correcta ("correcta" es el índice desde 0), opciones incorrectas creíbles, y una "explicacion" breve de por qué la correcta lo es.
- "examen": preguntas que cubran todo el curso, con el mismo formato y "leccion" = número de la lección de donde sale (contando desde 1 en el orden de la lista).
- "aprenderas": de 3 a 5 cosas concretas que el alumno sabrá hacer. "preguntas_sugeridas": preguntas que un alumno le haría al asistente del curso.
- "requisitos": lo que se necesita saber antes, o "Ninguno.".
- El alumno nunca ve el documento: en lecciones, preguntas y explicaciones no digas "el documento" ni "el texto"; habla de "la lección" o explica la idea directamente.

Valores por defecto, solo para lo que la coach no indique: de 2 a 12 lecciones según el largo del documento (un documento corto da un curso corto), 2 preguntas de repaso por lección y de 5 a 10 preguntas en el examen.`;

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

/** Cantidad exacta en el esquema (Gemini la respeta al generar; Claude no acepta estos límites). */
const exacto = (n: number | undefined, conLimites: boolean) => (conLimites && n !== undefined ? { minItems: n, maxItems: n } : {});

function esquema(m: Medidas, conLimites: boolean) {
  return {
    type: "object",
    properties: {
      titulo: { type: "string" },
      subtitulo: { type: "string" },
      aprenderas: { type: "array", items: { type: "string" } },
      requisitos: { type: "string" },
      preguntas_sugeridas: { type: "array", items: { type: "string" } },
      lecciones: {
        type: "array",
        ...exacto(m.lecciones, conLimites),
        items: {
          type: "object",
          properties: {
            modulo: { type: "string" },
            titulo: { type: "string" },
            duracion_min: { type: "integer" },
            resumen: { type: "string" },
            contenido: { type: "string" },
            preguntas_sugeridas: { type: "array", items: { type: "string" } },
            repaso: { type: "array", ...exacto(m.repaso, conLimites), items: PREGUNTA },
          },
          required: ["modulo", "titulo", "duracion_min", "resumen", "contenido", "preguntas_sugeridas", "repaso"],
          additionalProperties: false,
        },
      },
      examen: {
        type: "array",
        ...exacto(m.examen, conLimites),
        items: {
          ...PREGUNTA,
          properties: { ...PREGUNTA.properties, leccion: { type: "integer" } },
          required: [...PREGUNTA.required, "leccion"],
        },
      },
    },
    required: ["titulo", "subtitulo", "aprenderas", "requisitos", "preguntas_sugeridas", "lecciones", "examen"],
    additionalProperties: false,
  };
}

function cantidades(m: Medidas): string[] {
  return [
    m.lecciones !== undefined && `exactamente ${m.lecciones} ${m.lecciones === 1 ? "lección" : "lecciones"} en total`,
    m.repaso !== undefined &&
      (m.repaso === 0 ? "ninguna pregunta de repaso" : `exactamente ${m.repaso} ${m.repaso === 1 ? "pregunta" : "preguntas"} de repaso en cada lección`),
    m.examen !== undefined && `exactamente ${m.examen} ${m.examen === 1 ? "pregunta" : "preguntas"} en el examen final`,
  ].filter((x): x is string => Boolean(x));
}

function pedido(doc: Documento, indicaciones: string, m: Medidas): string {
  const exigidas = cantidades(m);
  return [
    `Arma el curso a partir del documento "${doc.nombre}".`,
    exigidas.length ? `Cantidades obligatorias: ${exigidas.join("; ")}.` : "",
    indicaciones ? `Indicaciones de la coach (síguelas): ${indicaciones}` : "",
    "Responde solo con el JSON del curso.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Qué cantidades no cumplió la propuesta (vacío: cumple). */
function diferencias(p: PropuestaCurso, m: Medidas): string[] {
  const d: string[] = [];
  if (m.lecciones !== undefined && p.lecciones.length !== m.lecciones) {
    d.push(`tiene ${p.lecciones.length} lecciones y deben ser exactamente ${m.lecciones}`);
  }
  if (m.repaso !== undefined) {
    const mal = p.lecciones.filter((l) => (l.repaso?.length ?? 0) < m.repaso!).length;
    if (mal) d.push(`${mal} lecciones tienen menos de ${m.repaso} preguntas de repaso`);
  }
  if (m.examen !== undefined && (p.examen?.length ?? 0) < m.examen) {
    d.push(`el examen tiene ${p.examen?.length ?? 0} preguntas y deben ser exactamente ${m.examen}`);
  }
  return d;
}

/** Si sobran preguntas, se quitan las últimas (eso no necesita otra vuelta a la IA). */
function recortar(p: PropuestaCurso, m: Medidas): PropuestaCurso {
  return {
    ...p,
    lecciones: p.lecciones.map((l) => (m.repaso !== undefined ? { ...l, repaso: (l.repaso ?? []).slice(0, m.repaso) } : l)),
    examen: m.examen !== undefined ? (p.examen ?? []).slice(0, m.examen) : p.examen,
  };
}

/** Una vuelta de conversación con la IA (el documento va en la primera). */
type Turno = { rol: "coach" | "ia"; texto: string };

// Cuánto tiempo hay en total (la ruta tiene 300 s en Vercel) y hasta cuándo
// vale la pena pedir una corrección.
const PRESUPUESTO_MS = 270_000;
const CORREGIR_ANTES_DE_MS = 150_000;

function leer(texto: string): PropuestaCurso {
  let p: PropuestaCurso;
  try {
    p = JSON.parse(texto) as PropuestaCurso;
  } catch {
    throw new ErrorDeDatos("La IA devolvió el curso incompleto. Inténtalo de nuevo o prueba con un documento más corto.");
  }
  if (!Array.isArray(p.lecciones) || p.lecciones.length === 0) {
    throw new ErrorDeDatos("La IA no encontró suficiente contenido en el documento para armar lecciones.");
  }
  return p;
}

/** Pide la propuesta a la IA configurada. Lanza ErrorDeDatos con un mensaje para la coach. */
export async function proponerCurso(doc: Documento, indicaciones: string, medidas: Medidas): Promise<PropuestaCurso> {
  const proveedor = proveedorIA();
  if (!proveedor) {
    throw new ErrorDeDatos("Para crear cursos con IA hace falta conectar una IA (GEMINI_API_KEY o ANTHROPIC_API_KEY en .env.local).");
  }
  const inicio = Date.now();
  const preguntar = (turnos: Turno[]) =>
    proveedor === "gemini"
      ? conGemini(doc, turnos, medidas, inicio + PRESUPUESTO_MS)
      : conClaude(doc, turnos, medidas);

  const turnos: Turno[] = [{ rol: "coach", texto: pedido(doc, indicaciones, medidas) }];
  const primera = await preguntar(turnos);
  let propuesta = leer(primera);

  // Si no cumplió las cantidades, se le pide una vez que corrija.
  const faltan = diferencias(propuesta, medidas);
  if (faltan.length && Date.now() - inicio < CORREGIR_ANTES_DE_MS) {
    console.warn(`Curso con IA: no cumplió las cantidades (${faltan.join("; ")}); se pide corrección.`);
    turnos.push(
      { rol: "ia", texto: primera },
      { rol: "coach", texto: `No cumpliste lo pedido: ${faltan.join("; ")}. Devuelve el curso completo corregido, con ${cantidades(medidas).join("; ")}.` },
    );
    const corregida = leer(await preguntar(turnos));
    if (diferencias(corregida, medidas).length <= faltan.length) propuesta = corregida;
  }
  return recortar(propuesta, medidas);
}

// Para armar un curso conviene el modelo más capaz; Lite queda de respaldo.
const MODELOS_GEMINI = ["gemini-flash-latest", "gemini-flash-lite-latest"];

async function conGemini(doc: Documento, turnos: Turno[], medidas: Medidas, limite: number): Promise<string> {
  const cliente = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });
  const documento: Part =
    doc.tipo === "pdf"
      ? { inlineData: { mimeType: "application/pdf", data: doc.datos.toString("base64") } }
      : { text: `<documento>\n${doc.texto}\n</documento>` };
  const contents: Content[] = turnos.map((t, i) => ({
    role: t.rol === "ia" ? "model" : "user",
    parts: i === 0 ? [documento, { text: t.texto }] : [{ text: t.texto }],
  }));

  for (const [i, model] of MODELOS_GEMINI.entries()) {
    const desde = Date.now();
    try {
      const respuesta = await cliente.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: INSTRUCCIONES,
          responseMimeType: "application/json",
          responseJsonSchema: esquema(medidas, true),
          maxOutputTokens: 32_768,
          abortSignal: AbortSignal.timeout(Math.max(limite - Date.now(), 5_000)),
          // El SDK reintenta 5 veces con espera creciente (casi un minuto si el modelo está
          // saturado). Mejor un reintento rápido y pasar al de respaldo.
          httpOptions: { retryOptions: { attempts: i < MODELOS_GEMINI.length - 1 ? 2 : 3 } },
          ...(model === "gemini-flash-latest" ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      });
      const texto = respuesta.text;
      if (!texto) throw new ErrorDeDatos("La IA no pudo leer el documento. Prueba con otro archivo o pega el texto.");
      return texto;
    } catch (e) {
      const reintentable = e instanceof ApiError && [429, 500, 503, 404].includes(e.status);
      if (reintentable && i < MODELOS_GEMINI.length - 1 && Date.now() < limite - 20_000) {
        const seg = Math.round((Date.now() - desde) / 1000);
        console.warn(`Curso con IA: ${model} respondió ${(e as ApiError).status} en ${seg} s, probando ${MODELOS_GEMINI[i + 1]}.`);
        continue;
      }
      if (e instanceof ErrorDeDatos) throw e;
      console.error("Curso con IA (Gemini):", e);
      if (e instanceof Error && e.name === "TimeoutError") {
        throw new ErrorDeDatos("La IA tardó demasiado. Inténtalo de nuevo o pide menos lecciones.");
      }
      if (e instanceof ApiError && e.status === 400 && doc.tipo === "pdf" && !/api key/i.test(e.message)) {
        throw new ErrorDeDatos("La IA no pudo abrir ese PDF. Prueba exportándolo de nuevo o sube el Word.");
      }
      throw new ErrorDeDatos(mensajeDeErrorGemini(e));
    }
  }
  throw new ErrorDeDatos("La IA no está disponible por ahora. Inténtalo en unos minutos.");
}

async function conClaude(doc: Documento, turnos: Turno[], medidas: Medidas): Promise<string> {
  const cliente = new Anthropic();
  const documento: Anthropic.ContentBlockParam =
    doc.tipo === "pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.datos.toString("base64") } }
      : { type: "text", text: `<documento>\n${doc.texto}\n</documento>` };
  try {
    const mensaje = await cliente.messages
      .stream({
        model: MODELO,
        max_tokens: 32_000,
        system: INSTRUCCIONES,
        output_config: { effort: "low", format: { type: "json_schema", schema: esquema(medidas, false) } },
        messages: turnos.map((t, i) => ({
          role: t.rol === "ia" ? ("assistant" as const) : ("user" as const),
          content: i === 0 ? [documento, { type: "text" as const, text: t.texto }] : t.texto,
        })),
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

// ---------------------------------------------------------------------------
// De la propuesta al editor
// ---------------------------------------------------------------------------

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
 * Pasa la propuesta al formato del editor: agrupa las lecciones seguidas del
 * mismo módulo. Las lecciones llevan ids provisionales ("ia-1", "ia-2"…) para
 * que el examen apunte a ellas; aplicarEdicion les da su id definitivo. Como
 * en los demás cursos, el módulo 1 queda gratis; si solo hay un módulo, solo
 * la primera lección.
 */
export function comoEdicion(p: PropuestaCurso): Record<string, unknown> {
  const modulos: { titulo: string; lecciones: Record<string, unknown>[] }[] = [];
  p.lecciones.forEach((l, i) => {
    const titulo = sinNumero(l.modulo) || "Módulo";
    if (modulos.at(-1)?.titulo !== titulo) modulos.push({ titulo, lecciones: [] });
    modulos.at(-1)!.lecciones.push({
      id: `ia-${i + 1}`,
      titulo: sinNumero(l.titulo),
      duracion_min: l.duracion_min,
      resumen: l.resumen,
      contenido: l.contenido,
      transcripcion: "",
      preguntas_sugeridas: l.preguntas_sugeridas,
      repaso: (l.repaso ?? []).map(pregunta),
    });
  });
  const unSoloModulo = modulos.length === 1;
  modulos.forEach((m, i) => m.lecciones.forEach((l, k) => (l.gratis = unSoloModulo ? k === 0 : i === 0)));
  const total = p.lecciones.length;
  return {
    titulo: p.titulo,
    subtitulo: p.subtitulo,
    aprenderas: p.aprenderas,
    requisitos: p.requisitos,
    preguntas_sugeridas: p.preguntas_sugeridas,
    modulos,
    examen: (p.examen ?? []).map((q) => ({
      ...pregunta(q),
      ...(Number.isInteger(q.leccion) && q.leccion >= 1 && q.leccion <= total ? { leccion: `ia-${q.leccion}` } : {}),
    })),
  };
}
