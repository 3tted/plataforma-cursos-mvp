import path from "path";
import { ApiError, FileState, GoogleGenAI, MediaResolution, createPartFromUri } from "@google/genai";
import { DIRECTORIO_VIDEOS } from "./almacen";
import { claveGemini } from "./asistente";
import { mensajeDeErrorGemini } from "./asistente-gemini";
import {
  MODELOS_GEMINI,
  PREGUNTA,
  avisoDeCantidades,
  cantidades,
  exacto,
  recortar,
  type Medidas,
  type PropuestaCurso,
} from "./curso-ia";
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
// Solo con Gemini (ve el video completo: lo que dice y lo que muestra). El
// video se sube a Gemini, que lo procesa unos minutos, y después se le pide el
// curso; el navegador va preguntando mientras tanto (ver la ruta
// /api/coach/cursos/video).

export const videoConIA = () => claveGemini();

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

// ---------------------------------------------------------------------------
// Pedido a la IA
// ---------------------------------------------------------------------------

const INSTRUCCIONES = `Eres diseñadora instruccional en Merkatics, una plataforma de cursos y comunidades para emprendedores y dueños de pequeños negocios en México. Una coach grabó un video enseñando y tú lo conviertes en un curso en línea listo para revisar. El video es la clase: cada lección es un tramo continuo del mismo video, y el alumno ve a la coach explicándolo.

Lo más importante: si la coach pide cantidades (cuántas lecciones, cuántas preguntas de repaso, cuántas del examen) o cualquier otra cosa en sus indicaciones, eso manda sobre los valores por defecto de abajo. Cumple las cantidades exactas.

Reglas:
- "inicio" y "fin" son el minuto y segundo del video donde empieza y termina el tramo de cada lección, como "6:10" o, pasada la hora, "1:02:30". Los tramos van en orden, no se enciman y cada uno empieza donde la coach arranca un tema y termina cuando lo cierra. Corta en pausas naturales o cambios de tema, nunca a media frase. Puedes dejar fuera el saludo del principio y la despedida si no enseñan nada.
- Usa solo lo que la coach dice y muestra en el video. No inventes datos, cifras, nombres, casos ni recomendaciones que no estén ahí. Si te piden más lecciones de las que el video da naturalmente, divide los temas en tramos más cortos; si te piden menos, junta temas seguidos.
- Escribe en español de México, tuteando al alumno, claro y cálido, sin tecnicismos innecesarios.
- "lecciones" es la lista de todas las lecciones en orden. "modulo" es el título del módulo al que pertenece cada una; las lecciones seguidas del mismo módulo llevan exactamente el mismo título de módulo. Agrupa en 1 a 4 módulos según los temas.
- "contenido" son los apuntes de la lección en Markdown (## para subtítulos, **negritas**, listas), de 100 a 300 palabras: las ideas clave que explica la coach en ese tramo, para repasar después de verlo. No es la transcripción.
- "transcripcion" es lo que dice la coach en ese tramo, palabra por palabra, quitando muletillas y repeticiones, en párrafos.
- "duracion_min" son los minutos que dura el tramo, redondeados (al menos 1).
- "resumen" es una sola línea que dice qué logra el alumno con la lección.
- "repaso": preguntas sobre esa lección. Cada pregunta con 3 o 4 opciones, una sola correcta ("correcta" es el índice desde 0), opciones incorrectas creíbles, y una "explicacion" breve de por qué la correcta lo es.
- "examen": preguntas que cubran todo el curso, con el mismo formato y "leccion" = número de la lección de donde sale (contando desde 1 en el orden de la lista).
- "aprenderas": de 3 a 5 cosas concretas que el alumno sabrá hacer. "preguntas_sugeridas": preguntas que un alumno le haría al asistente del curso.
- "requisitos": lo que se necesita saber antes, o "Ninguno.".

Valores por defecto, solo para lo que la coach no indique: más o menos una lección por cada 5 a 12 minutos de video según cómo cambian los temas (un video corto da un curso corto, de 1 a 15 lecciones), 2 preguntas de repaso por lección y de 5 a 10 preguntas en el examen.`;

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
            inicio: { type: "string" },
            fin: { type: "string" },
            duracion_min: { type: "integer" },
            resumen: { type: "string" },
            contenido: { type: "string" },
            transcripcion: { type: "string" },
            preguntas_sugeridas: { type: "array", items: { type: "string" } },
            repaso: { type: "array", ...exacto(m.repaso, conLimites), items: PREGUNTA },
          },
          required: [
            "modulo",
            "titulo",
            "inicio",
            "fin",
            "duracion_min",
            "resumen",
            "contenido",
            "transcripcion",
            "preguntas_sugeridas",
            "repaso",
          ],
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
  };
}

type PropuestaVideo = PropuestaCurso & { lecciones: (PropuestaCurso["lecciones"][number] & { inicio: string; fin: string })[] };

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

// La ruta tiene 300 s en Vercel; se deja margen para guardar el curso.
const PRESUPUESTO_MS = 270_000;

/** Pide a Gemini el curso del video (ya procesado). Lanza ErrorDeDatos con un mensaje para la coach. */
export async function proponerCursoDeVideo(
  video: { uri: string; tipo: string; nombre: string; duracion?: number },
  indicaciones: string,
  medidas: Medidas,
): Promise<{ propuesta: PropuestaCurso; tramos: { inicio: number; fin: number }[]; aviso: string | null }> {
  const limite = Date.now() + PRESUPUESTO_MS;
  const exigidas = cantidades(medidas);
  const pedido = [
    `Arma el curso a partir del video "${video.nombre}"${video.duracion ? `, que dura ${reloj(video.duracion)}` : ""}.`,
    exigidas.length ? `Cantidades obligatorias: ${exigidas.join("; ")}.` : "",
    indicaciones ? `Indicaciones de la coach (síguelas): ${indicaciones}` : "",
    "Responde solo con el JSON del curso.",
  ]
    .filter(Boolean)
    .join("\n\n");

  let conLimites = true;
  for (let i = 0; i < MODELOS_GEMINI.length; i++) {
    const model = MODELOS_GEMINI[i];
    try {
      const respuesta = await gemini().models.generateContent({
        model,
        contents: [{ role: "user", parts: [createPartFromUri(video.uri, video.tipo), { text: pedido }] }],
        config: {
          systemInstruction: INSTRUCCIONES,
          responseMimeType: "application/json",
          responseJsonSchema: esquema(medidas, conLimites),
          // Baja resolución de imagen: alcanza para seguir la clase y deja ver videos de más de una hora.
          mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
          maxOutputTokens: 65_536,
          abortSignal: AbortSignal.timeout(Math.max(limite - Date.now(), 5_000)),
          httpOptions: { retryOptions: { attempts: i < MODELOS_GEMINI.length - 1 ? 2 : 3 } },
          ...(model === "gemini-flash-latest" ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      });
      const texto = respuesta.text;
      if (!texto) throw new ErrorDeDatos("La IA no pudo ver el video. Inténtalo de nuevo o prueba con otro archivo.");
      let p: PropuestaVideo;
      try {
        p = JSON.parse(texto) as PropuestaVideo;
      } catch {
        throw new ErrorDeDatos("La IA devolvió el curso incompleto. Inténtalo de nuevo o pide menos lecciones.");
      }
      if (!Array.isArray(p.lecciones) || p.lecciones.length === 0) {
        throw new ErrorDeDatos("La IA no encontró en el video suficiente contenido para armar lecciones.");
      }
      const tramos = ordenarTramos(p.lecciones, video.duracion);
      const recortada = recortar(p, medidas);
      const final: PropuestaCurso = {
        ...recortada,
        lecciones: recortada.lecciones.map((l, k) => ({
          ...l,
          duracion_min: Math.max(1, Math.round((tramos[k].fin - tramos[k].inicio) / 60)),
        })),
      };
      return { propuesta: final, tramos, aviso: avisoDeCantidades(final, medidas) };
    } catch (e) {
      if (conLimites && e instanceof ApiError && e.status === 400 && /invalid argument/i.test(e.message)) {
        console.warn(`Curso desde video: ${model} no aceptó el esquema con cantidades; se repite sin ellas.`);
        conLimites = false;
        i--;
        continue;
      }
      const reintentable = e instanceof ApiError && [429, 500, 503, 404].includes(e.status);
      if (reintentable && i < MODELOS_GEMINI.length - 1 && Date.now() < limite - 60_000) {
        console.warn(`Curso desde video: ${model} respondió ${(e as ApiError).status}, probando ${MODELOS_GEMINI[i + 1]}.`);
        continue;
      }
      if (e instanceof ErrorDeDatos) throw e;
      console.error("Curso desde video (Gemini):", e);
      if (e instanceof Error && e.name === "TimeoutError") {
        throw new ErrorDeDatos("La IA tardó demasiado. Inténtalo de nuevo, pide menos lecciones o prueba con un video más corto.");
      }
      throw new ErrorDeDatos(mensajeDeErrorGemini(e));
    }
  }
  throw new ErrorDeDatos("La IA no está disponible por ahora. Inténtalo en unos minutos.");
}
