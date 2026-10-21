import path from "path";
import { ApiError, FileState, GoogleGenAI, MediaResolution, createPartFromUri, type Part } from "@google/genai";
import { DIRECTORIO_VIDEOS } from "./almacen";
import { claveGemini } from "./asistente";
import { mensajeDeErrorGemini } from "./asistente-gemini";
import { PREGUNTA, exacto, type Medidas, type PreguntaPropuesta, type PropuestaCurso } from "./curso-ia";
import { ErrorDeDatos } from "./http";
import { reloj, segundos } from "./reglas-video";
import type { VideoFuente } from "./tipos";
import { urlParaVer } from "./videos";

// La coach sube un video suyo (una clase grabada) y la IA arma el curso con
// él: lo divide en lecciones con su tramo (del minuto tal al tal), escribe los
// apuntes y la transcripción de cada una, el repaso y el examen. El archivo no
// se corta: cada lección guarda su tramo del mismo video y el reproductor solo
// muestra esa parte. Así el alumno ve a la coach, no solo diapositivas.
//
// Solo con Gemini (ve el video: lo que dice y lo que muestra). El video se
// sube a Gemini, que lo procesa unos minutos, y después se le pide el curso
// por partes, cada una corta (Vercel corta cada petición a los 5 minutos):
//   1. la estructura: ve el video completo y propone las lecciones con su tramo;
//   2. cada lección: ve solo su tramo y escribe apuntes, transcripción y repaso;
//   3. el examen: a partir de los apuntes, sin volver a ver el video.
// Lo avanzado se guarda; el navegador va llamando hasta que el curso está
// listo (ver la ruta /api/coach/cursos/video).

export const videoConIA = () => claveGemini();

// Para ver video, el modelo más nuevo primero (en las pruebas fue el único que
// respondió con Gemini saturado); los otros quedan de respaldo.
const MODELOS_GEMINI = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-flash-lite-latest"];

let cliente: GoogleGenAI | null = null;
const gemini = () => (cliente ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY }));

/** Sube el video a Gemini para que lo vea. Devuelve su nombre ("files/…"). */
export async function subirAGemini(fuente: VideoFuente): Promise<string> {
  try {
    const archivo = fuente.url
      ? await fetch(await urlParaVer({ archivo: fuente.archivo, url: fuente.url })).then((r) => {
          if (!r.ok) throw new Error(`Blob respondió ${r.status}`);
          return r.blob();
        })
      : path.join(DIRECTORIO_VIDEOS, fuente.archivo);
    const subido = await gemini().files.upload({
      file: archivo,
      config: { mimeType: fuente.tipo, displayName: fuente.nombreOriginal },
    });
    if (!subido.name) throw new Error("Gemini no devolvió el archivo");
    return subido.name;
  } catch (e) {
    console.error("Curso desde video: no se pudo subir a Gemini", e);
    throw new ErrorDeDatos(e instanceof ApiError ? mensajeDeErrorGemini(e) : "No pudimos mandarle el video a la IA. Inténtalo de nuevo.");
  }
}

/** Si Gemini ya terminó de procesar el video. "perdido": ya no lo tiene (caducó a las 48 horas). */
export async function estadoEnGemini(nombre: string): Promise<{ estado: "listo" | "procesando" | "perdido"; uri?: string }> {
  try {
    const f = await gemini().files.get({ name: nombre });
    if (f.state === FileState.FAILED) {
      throw new ErrorDeDatos("La IA no pudo leer ese video. Prueba exportándolo de nuevo en MP4.");
    }
    if (f.state === FileState.ACTIVE && f.uri) return { estado: "listo", uri: f.uri };
    return { estado: "procesando" };
  } catch (e) {
    if (e instanceof ErrorDeDatos) throw e;
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) return { estado: "perdido" };
    throw new ErrorDeDatos(mensajeDeErrorGemini(e));
  }
}

export async function borrarDeGemini(nombre: string): Promise<void> {
  await gemini()
    .files.delete({ name: nombre })
    .catch((e) => console.warn("No se pudo borrar el video de Gemini", nombre, e));
}

/**
 * Los tramos que propuso la IA, puestos en orden: sin encimarse, dentro del
 * video y sin quedar vacíos (si falta el fin, llega hasta donde empieza la
 * siguiente lección o hasta el final del video).
 */
export function ordenarTramos(lecciones: { inicio: unknown; fin: unknown; duracion_min?: number }[], duracion?: number) {
  const tope = duracion ?? Infinity;
  let previo = 0;
  return lecciones.map((l, i) => {
    let inicio = Math.min(Math.max(segundos(l.inicio) ?? previo, previo), Number.isFinite(tope) ? Math.max(tope - 5, previo) : Infinity);
    const siguiente = segundos(lecciones[i + 1]?.inicio);
    let fin = segundos(l.fin);
    if (fin === undefined || fin <= inicio) fin = siguiente !== undefined && siguiente > inicio ? siguiente : tope;
    if (!Number.isFinite(fin)) fin = inicio + 60 * Math.max(l.duracion_min ?? 5, 1);
    fin = Math.min(fin, tope);
    previo = fin;
    // La IA marca el tiempo al segundo y a veces se adelanta: un poco de margen
    // para no cortar la primera o la última palabra (se enciman 1 a 3 segundos).
    inicio = Math.max(Math.round(inicio) - 1, 0);
    fin = Math.max(Math.round(Math.min(fin + 2, tope)), inicio + 1);
    return { inicio, fin };
  });
}

// ---------------------------------------------------------------------------
// Pedido a la IA, por partes
// ---------------------------------------------------------------------------

const BASE = `Eres diseñadora instruccional en Merkatics, una plataforma de cursos y comunidades para emprendedores y dueños de pequeños negocios en México. Una coach grabó un video enseñando y lo estás convirtiendo en un curso en línea: cada lección es un tramo continuo del mismo video, y el alumno ve a la coach explicándolo.

Reglas de siempre:
- Escribe en español de México, tuteando al alumno, claro y cálido, sin tecnicismos innecesarios.
- Usa solo lo que la coach dice y muestra en el video. No inventes datos, cifras, nombres, casos ni recomendaciones que no estén ahí.
- Si la coach te da indicaciones o cantidades, eso manda sobre los valores por defecto.`;

const INSTRUCCIONES_ESTRUCTURA = `${BASE}

Ahora ves el video completo y propones la estructura del curso (los textos de cada lección se escriben después).
- "lecciones" es la lista de todas las lecciones en orden. "inicio" y "fin" son el minuto y segundo del video donde empieza y termina el tramo de cada una, como "6:10" o, pasada la hora, "1:02:30". Los tramos van en orden, no se enciman y cada uno empieza donde la coach arranca un tema y termina cuando lo cierra. Corta en pausas naturales o cambios de tema, nunca a media frase. Puedes dejar fuera el saludo del principio y la despedida si no enseñan nada.
- Cada lección enseña una idea. Si te piden más lecciones de las que el video da naturalmente, divide los temas en tramos más cortos; si te piden menos, junta temas seguidos.
- "modulo" es el título del módulo de cada lección; las lecciones seguidas del mismo módulo llevan exactamente el mismo título. Agrupa en 1 a 4 módulos según los temas.
- "resumen" es una sola línea que dice qué logra el alumno con la lección.
- "aprenderas": de 3 a 5 cosas concretas que el alumno sabrá hacer. "preguntas_sugeridas": preguntas que un alumno le haría al asistente del curso. "requisitos": lo que se necesita saber antes, o "Ninguno.".

Por defecto, más o menos una lección por cada 4 a 10 minutos de video según cómo cambian los temas (un video corto da un curso corto, de 1 a 15 lecciones).`;

const INSTRUCCIONES_LECCION = `${BASE}

Ahora ves solo el tramo del video de una lección y escribes sus textos.
- "contenido" son los apuntes de la lección en Markdown (## para subtítulos, **negritas**, listas), de 100 a 300 palabras: las ideas clave que explica la coach en este tramo, para repasar después de verlo. No es la transcripción.
- "transcripcion" es lo que dice la coach en este tramo, palabra por palabra, quitando muletillas y repeticiones, en párrafos.
- "preguntas_sugeridas": 2 o 3 preguntas que un alumno le haría al asistente sobre esta lección.
- "repaso": preguntas sobre esta lección. Cada una con 3 o 4 opciones, una sola correcta ("correcta" es el índice desde 0), opciones incorrectas creíbles, y una "explicacion" breve de por qué la correcta lo es. Por defecto, 2 preguntas.`;

const INSTRUCCIONES_EXAMEN = `${BASE}

Ahora escribes el examen final del curso a partir de los apuntes de sus lecciones.
- Preguntas que cubran todo el curso. Cada una con 3 o 4 opciones, una sola correcta ("correcta" es el índice desde 0), opciones incorrectas creíbles, una "explicacion" breve y "leccion" = número de la lección de donde sale (contando desde 1).
- Por defecto, de 5 a 10 preguntas según lo largo del curso.`;

const TEXTO = { type: "string" };
const LISTA = { type: "array", items: TEXTO };

function esquemaEstructura(m: Medidas, conLimites: boolean) {
  return {
    type: "object",
    properties: {
      titulo: TEXTO,
      subtitulo: TEXTO,
      aprenderas: LISTA,
      requisitos: TEXTO,
      preguntas_sugeridas: LISTA,
      lecciones: {
        type: "array",
        ...exacto(m.lecciones, conLimites),
        items: {
          type: "object",
          properties: { modulo: TEXTO, titulo: TEXTO, resumen: TEXTO, inicio: TEXTO, fin: TEXTO },
          required: ["modulo", "titulo", "resumen", "inicio", "fin"],
        },
      },
    },
    required: ["titulo", "subtitulo", "aprenderas", "requisitos", "preguntas_sugeridas", "lecciones"],
  };
}

function esquemaLeccion(m: Medidas, conLimites: boolean) {
  return {
    type: "object",
    properties: {
      contenido: TEXTO,
      transcripcion: TEXTO,
      preguntas_sugeridas: LISTA,
      repaso: { type: "array", ...exacto(m.repaso, conLimites), items: PREGUNTA },
    },
    required: ["contenido", "transcripcion", "preguntas_sugeridas", "repaso"],
  };
}

function esquemaExamen(m: Medidas, conLimites: boolean) {
  return {
    type: "object",
    properties: {
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
    required: ["examen"],
  };
}

export interface EstructuraCursoVideo {
  titulo: string;
  subtitulo: string;
  aprenderas: string[];
  requisitos: string;
  preguntas_sugeridas: string[];
  lecciones: { modulo: string; titulo: string; resumen: string; inicio: number; fin: number }[];
}

export interface TextosLeccionVideo {
  contenido: string;
  transcripcion: string;
  preguntas_sugeridas: string[];
  repaso: PreguntaPropuesta[];
}

/** Lo que la IA ya armó del curso, guardado entre llamada y llamada. */
export interface TrabajoCursoVideo {
  indicaciones: string;
  medidas: Medidas;
  estructura?: EstructuraCursoVideo;
  /** Los textos de cada lección, en orden (null: falta). */
  lecciones?: (TextosLeccionVideo | null)[];
  examen?: (PreguntaPropuesta & { leccion: number })[];
}

export type VideoEnGemini = { uri: string; tipo: string; nombre: string; duracion?: number };

const cantidad = (n: number, una: string, varias: string) => `exactamente ${n} ${n === 1 ? una : varias}`;

const pedidoCon = (partes: (string | false)[]) => [...partes, "Responde solo con el JSON."].filter(Boolean).join("\n\n");

/**
 * Una pregunta a Gemini que responde JSON. Si el modelo principal está
 * saturado, prueba con el de respaldo; si no acepta las cantidades en el
 * esquema, las deja solo en el texto. Lanza ErrorDeDatos con un mensaje para la coach.
 */
async function pedirJSON<T>(
  parts: Part[],
  instrucciones: string,
  esquema: (conLimites: boolean) => object,
  limiteMs: number,
  conVideo: boolean,
): Promise<T> {
  const hasta = Date.now() + limiteMs;
  let conLimites = true;
  for (let i = 0; i < MODELOS_GEMINI.length; i++) {
    const model = MODELOS_GEMINI[i];
    try {
      const respuesta = await gemini().models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: instrucciones,
          responseMimeType: "application/json",
          responseJsonSchema: esquema(conLimites),
          // Baja resolución de imagen: alcanza para seguir la clase y deja ver videos largos.
          ...(conVideo ? { mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW } : {}),
          maxOutputTokens: 32_768,
          abortSignal: AbortSignal.timeout(Math.max(hasta - Date.now(), 5_000)),
          httpOptions: { retryOptions: { attempts: 2 } },
          ...(model === "gemini-flash-latest" ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      });
      const texto = respuesta.text;
      if (!texto) throw new ErrorDeDatos("La IA no pudo ver el video. Inténtalo de nuevo o prueba con otro archivo.");
      try {
        return JSON.parse(texto) as T;
      } catch {
        throw new ErrorDeDatos("La IA devolvió una respuesta incompleta. Dale «Intentar de nuevo»: sigue donde se quedó.");
      }
    } catch (e) {
      if (conLimites && e instanceof ApiError && e.status === 400 && /invalid argument/i.test(e.message)) {
        conLimites = false;
        i--;
        continue;
      }
      const reintentable = e instanceof ApiError && [429, 500, 503, 404].includes(e.status);
      if (reintentable && i < MODELOS_GEMINI.length - 1 && Date.now() < hasta - 30_000) {
        console.warn(`Curso desde video: ${model} respondió ${(e as ApiError).status}, probando ${MODELOS_GEMINI[i + 1]}.`);
        continue;
      }
      if (e instanceof ErrorDeDatos) throw e;
      console.error("Curso desde video (Gemini):", e);
      if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
        throw new ErrorDeDatos("La IA tardó demasiado en esta parte. Dale «Intentar de nuevo»: sigue donde se quedó.");
      }
      if (e instanceof ApiError && e.status === 503) {
        throw new ErrorDeDatos("La IA está saturada por ahora. Dale «Intentar de nuevo» en unos minutos: sigue donde se quedó.");
      }
      throw new ErrorDeDatos(mensajeDeErrorGemini(e));
    }
  }
  throw new ErrorDeDatos("La IA está saturada por ahora. Dale «Intentar de nuevo» en unos minutos: sigue donde se quedó.");
}

/** 1. Ve el video completo y propone las lecciones con su tramo. */
export async function proponerEstructura(video: VideoEnGemini, t: TrabajoCursoVideo, limiteMs: number): Promise<EstructuraCursoVideo> {
  type Respuesta = Omit<EstructuraCursoVideo, "lecciones"> & {
    lecciones: { modulo: string; titulo: string; resumen: string; inicio: string; fin: string }[];
  };
  const pedido = pedidoCon([
    `Propón la estructura del curso a partir del video "${video.nombre}"${video.duracion ? `, que dura ${reloj(video.duracion)}` : ""}.`,
    t.medidas.lecciones !== undefined && `Cantidad obligatoria: ${cantidad(t.medidas.lecciones, "lección", "lecciones")} en total.`,
    !!t.indicaciones && `Indicaciones de la coach (síguelas): ${t.indicaciones}`,
  ]);
  const r = await pedirJSON<Respuesta>(
    [createPartFromUri(video.uri, video.tipo), { text: pedido }],
    INSTRUCCIONES_ESTRUCTURA,
    (c) => esquemaEstructura(t.medidas, c),
    limiteMs,
    true,
  );
  if (!Array.isArray(r.lecciones) || r.lecciones.length === 0) {
    throw new ErrorDeDatos("La IA no encontró en el video suficiente contenido para armar lecciones.");
  }
  const lecciones = r.lecciones.slice(0, 30);
  const tramos = ordenarTramos(lecciones, video.duracion);
  return {
    titulo: r.titulo,
    subtitulo: r.subtitulo,
    aprenderas: r.aprenderas,
    requisitos: r.requisitos,
    preguntas_sugeridas: r.preguntas_sugeridas,
    lecciones: lecciones.map((l, i) => ({ modulo: l.modulo, titulo: l.titulo, resumen: l.resumen, ...tramos[i] })),
  };
}

/** 2. Ve solo el tramo de una lección y escribe sus apuntes, transcripción y repaso. */
export async function escribirLeccion(video: VideoEnGemini, t: TrabajoCursoVideo, i: number, limiteMs: number): Promise<TextosLeccionVideo> {
  const e = t.estructura!;
  const l = e.lecciones[i];
  const tramo: Part = { ...createPartFromUri(video.uri, video.tipo), videoMetadata: { startOffset: `${l.inicio}s`, endOffset: `${l.fin}s` } };
  const pedido = pedidoCon([
    `Curso: "${e.titulo}". Esta es la lección ${i + 1} de ${e.lecciones.length}: "${l.titulo}" (${l.resumen}). El video que ves es su tramo, del ${reloj(l.inicio)} al ${reloj(l.fin)} de la clase.`,
    t.medidas.repaso === 0 && 'Sin preguntas de repaso: deja "repaso" vacío.',
    !!t.medidas.repaso && `Cantidad obligatoria: ${cantidad(t.medidas.repaso, "pregunta", "preguntas")} de repaso.`,
    !!t.indicaciones && `Indicaciones de la coach (síguelas): ${t.indicaciones}`,
  ]);
  const r = await pedirJSON<TextosLeccionVideo>([tramo, { text: pedido }], INSTRUCCIONES_LECCION, (c) => esquemaLeccion(t.medidas, c), limiteMs, true);
  const repaso = Array.isArray(r.repaso) ? r.repaso : [];
  return {
    contenido: r.contenido ?? "",
    transcripcion: r.transcripcion ?? "",
    preguntas_sugeridas: Array.isArray(r.preguntas_sugeridas) ? r.preguntas_sugeridas : [],
    repaso: t.medidas.repaso !== undefined ? repaso.slice(0, t.medidas.repaso) : repaso,
  };
}

/** 3. El examen final, a partir de los apuntes (sin volver a ver el video). */
export async function escribirExamen(t: TrabajoCursoVideo, limiteMs: number): Promise<NonNullable<TrabajoCursoVideo["examen"]>> {
  const e = t.estructura!;
  const apuntes = e.lecciones.map((l, i) => `## Lección ${i + 1}: ${l.titulo}\n${t.lecciones?.[i]?.contenido || l.resumen}`).join("\n\n");
  const pedido = pedidoCon([
    `Curso: "${e.titulo}". Estos son los apuntes de sus lecciones:\n\n${apuntes}`,
    t.medidas.examen !== undefined && `Cantidad obligatoria: ${cantidad(t.medidas.examen, "pregunta", "preguntas")} en el examen.`,
    !!t.indicaciones && `Indicaciones de la coach (síguelas): ${t.indicaciones}`,
  ]);
  const r = await pedirJSON<{ examen: NonNullable<TrabajoCursoVideo["examen"]> }>(
    [{ text: pedido }],
    INSTRUCCIONES_EXAMEN,
    (c) => esquemaExamen(t.medidas, c),
    limiteMs,
    false,
  );
  const examen = Array.isArray(r.examen) ? r.examen : [];
  return t.medidas.examen !== undefined ? examen.slice(0, t.medidas.examen) : examen;
}

/** El trabajo terminado, en el formato del curso armado con IA (ver comoEdicion), con el tramo de cada lección. */
export function comoPropuesta(t: TrabajoCursoVideo): { propuesta: PropuestaCurso; tramos: { inicio: number; fin: number }[] } {
  const e = t.estructura!;
  return {
    propuesta: {
      titulo: e.titulo,
      subtitulo: e.subtitulo,
      aprenderas: e.aprenderas,
      requisitos: e.requisitos,
      preguntas_sugeridas: e.preguntas_sugeridas,
      lecciones: e.lecciones.map((l, i) => ({
        modulo: l.modulo,
        titulo: l.titulo,
        resumen: l.resumen,
        duracion_min: Math.max(1, Math.round((l.fin - l.inicio) / 60)),
        contenido: t.lecciones?.[i]?.contenido ?? "",
        transcripcion: t.lecciones?.[i]?.transcripcion ?? "",
        preguntas_sugeridas: t.lecciones?.[i]?.preguntas_sugeridas ?? [],
        repaso: t.lecciones?.[i]?.repaso ?? [],
      })),
      examen: t.examen ?? [],
    },
    tramos: e.lecciones.map((l) => ({ inicio: l.inicio, fin: l.fin })),
  };
}
