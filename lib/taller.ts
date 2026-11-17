import { createPartFromUri, type Content, type Part } from "@google/genai";
import { borrarAparte, guardarAparte, leerAparte, nuevoId, type Almacen } from "./almacen";
import { aplicarEdicion, nuevoCurso } from "./creacion";
import { PREGUNTA, type Documento } from "./curso-ia";
import { borrarDeGemini, estadoEnGemini, pedirJSON, subirAGemini } from "./curso-video";
import { ErrorDeDatos } from "./http";
import type { Coach } from "./permisos";
import { reloj, segundos } from "./reglas-video";
import type { BorradorTaller, CursoCreado, LeccionTaller, PreguntaCurso, TallerCurso, VideoLeccion, VideoTaller } from "./tipos";

// Armar un curso platicando con la IA (como coach/taller.py de la versión de
// Django). La coach empieza a mano, con videos o con un PDF, y el curso se arma
// en un borrador que se ve a un lado de la plática. Ella lo edita cuando quiere
// y le pide a la IA lo demás: títulos, descripciones, apuntes, preguntas,
// examen, dividir un video largo en lecciones…
//
// Cada video se le manda a Gemini una sola vez para que lo vea y anote lo que
// se dice en él, con tiempos (se guarda aparte del almacén). En la plática la
// IA trabaja con esas notas, que son solo texto: contesta rápido aunque haya
// varios videos. Al darle «Crear curso» el borrador se vuelve un curso en
// borrador del editor de siempre.

export const MAX_LECCIONES = 30;
const MAX_REPASO = 10;
const MAX_EXAMEN = 30;
const MAX_VIDEOS = 30;
const MAX_NOTAS = 60_000; // caracteres por video que se le pasan a la IA
const MAX_PLATICA = 16; // mensajes anteriores que se le pasan a la IA
const MAX_CHAT = 60; // mensajes que se guardan
// En la plática importa contestar rápido: primero el modelo ligero.
const MODELOS_PLATICA = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-3.5-flash"];

const claveNotas = (video: string) => `taller-notas:${video}`;
const claveDocumento = (taller: string) => `taller-documento:${taller}`;

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const lista = (v: unknown, max: number, largo = 200) =>
  (Array.isArray(v) ? v : [])
    .map((x) => texto(x, largo))
    .filter(Boolean)
    .slice(0, max);
/** «Módulo 1: Empezar» → «Empezar» (la plataforma ya numera módulos y lecciones). */
const sinNumero = (t: unknown) => texto(t, 200).replace(/^\s*(m[oó]dulo|lecci[oó]n|tema|parte)\s*\d+\s*[:.\-–—]\s*/i, "").trim();
const idPregunta = () => `q${Math.random().toString(36).slice(2, 10)}`;

// ---------------------------------------------------------------- el borrador

export function borradorVacio(): BorradorTaller {
  return { titulo: "", subtitulo: "", aprenderas: [], requisitos: "", preguntas_sugeridas: [], lecciones: [], examen: [] };
}

export function leccionVacia(t: Pick<TallerCurso, "siguiente">, modulo = ""): LeccionTaller {
  const id = `L${t.siguiente}`;
  t.siguiente += 1;
  return { id, modulo, titulo: "", resumen: "", contenido: "", preguntas_sugeridas: [], repaso: [] };
}

export function nuevoTaller(a: Almacen, coach: Coach, comunidad: string, modo: TallerCurso["modo"]): TallerCurso {
  const ahora = new Date().toISOString();
  const t: TallerCurso = {
    id: `T${nuevoId(a)}`,
    empresa: coach.empresa,
    comunidad,
    autor: coach.nombre,
    modo,
    borrador: borradorVacio(),
    chat: [],
    videos: [],
    siguiente: 1,
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
  // A mano se empieza con una lección vacía, lista para llenar.
  if (modo === "mano") t.borrador.lecciones.push(leccionVacia(t));
  return t;
}

export function tallerDeCoach(a: Almacen, id: unknown, coach: Coach): TallerCurso {
  const t = (a.talleres ?? []).find((x) => x.id === id);
  if (!t || t.empresa !== coach.empresa) throw new ErrorDeDatos("No encontramos ese curso en preparación.");
  return t;
}

/** El tramo de un video, en segundos, a partir de lo que escribió la coach o la IA («6:10»). Lanza ErrorDeDatos si no se entiende. */
export function leerTramo(v: VideoTaller | undefined, inicio: unknown, fin: unknown): { inicio?: number; fin?: number } {
  const vacio = (x: unknown) => x === undefined || x === null || String(x).trim() === "";
  const a = vacio(inicio) ? undefined : segundos(typeof inicio === "number" ? inicio : String(inicio).trim());
  let b = vacio(fin) ? undefined : segundos(typeof fin === "number" ? fin : String(fin).trim());
  if ((!vacio(inicio) && a === undefined) || (!vacio(fin) && b === undefined)) throw new ErrorDeDatos("Escribe el tiempo como 6:10 o 1:02:30.");
  if (a === undefined && b === undefined) return {};
  const tope = v?.duracion;
  let desde = a ?? 0;
  if (tope) {
    desde = Math.min(desde, Math.max(tope - 5, 0));
    b = b === undefined ? tope : Math.min(b, tope);
  }
  if (b !== undefined && b - desde < 5) throw new ErrorDeDatos("El tramo debe durar al menos 5 segundos.");
  // Todo el video: sin tramo.
  if (tope && desde <= 0 && b !== undefined && b >= tope - 1) return {};
  return { inicio: Math.round(desde), ...(b !== undefined ? { fin: Math.round(b) } : {}) };
}

function preguntaLimpia(v: unknown, conLeccion: boolean): PreguntaCurso {
  const p = (v ?? {}) as Record<string, unknown>;
  const opciones = (Array.isArray(p.opciones) ? p.opciones : []).slice(0, 6).map((o) => texto(o, 200));
  while (opciones.length < 2) opciones.push("");
  const correcta = Number.isInteger(p.correcta) ? Math.min(Math.max(Number(p.correcta), 0), opciones.length - 1) : 0;
  const leccion = conLeccion ? texto(p.leccion, 20) : "";
  return {
    id: typeof p.id === "string" && /^[A-Za-z0-9-]{1,24}$/.test(p.id) ? p.id : idPregunta(),
    enunciado: texto(p.enunciado, 400),
    opciones,
    correcta,
    ...(texto(p.explicacion, 600) ? { explicacion: texto(p.explicacion, 600) } : {}),
    ...(leccion ? { leccion } : {}),
  };
}

/**
 * Lo que manda la pantalla de la coach (ella edita el borrador a mano), ya
 * revisado: textos con su largo, preguntas bien formadas, videos que sí son
 * de este curso y tramos dentro del video.
 */
export function borradorLimpio(t: TallerCurso, v: unknown): BorradorTaller {
  const b = (v ?? {}) as Record<string, unknown>;
  const videos = new Map(t.videos.map((x) => [x.id, x]));
  const usados = new Set<string>();
  const lecciones = (Array.isArray(b.lecciones) ? b.lecciones : []).slice(0, MAX_LECCIONES).map((lv): LeccionTaller => {
    const l = (lv ?? {}) as Record<string, unknown>;
    let id = texto(l.id, 20);
    if (!/^L\d+$/.test(id) || usados.has(id)) id = leccionVacia(t).id;
    const n = Number(id.slice(1));
    if (n >= t.siguiente) t.siguiente = n + 1;
    usados.add(id);
    const video = typeof l.video === "string" && videos.has(l.video) ? l.video : undefined;
    let tramo: { inicio?: number; fin?: number } = {};
    if (video) {
      try {
        tramo = leerTramo(videos.get(video), l.inicio, l.fin);
      } catch {
        tramo = {};
      }
    }
    const minutos = Math.round(Number(l.duracion_min));
    return {
      id,
      modulo: texto(l.modulo, 120),
      titulo: texto(l.titulo, 140),
      resumen: texto(l.resumen, 300),
      contenido: typeof l.contenido === "string" ? l.contenido.slice(0, 20_000) : "",
      ...(Number.isFinite(minutos) && minutos > 0 ? { duracion_min: Math.min(minutos, 240) } : {}),
      preguntas_sugeridas: lista(l.preguntas_sugeridas, 4),
      repaso: (Array.isArray(l.repaso) ? l.repaso : []).slice(0, MAX_REPASO).map((p) => preguntaLimpia(p, false)),
      ...(video ? { video, ...tramo } : {}),
    };
  });
  return {
    titulo: texto(b.titulo, 120),
    subtitulo: texto(b.subtitulo, 240),
    aprenderas: lista(b.aprenderas, 8),
    requisitos: texto(b.requisitos, 300),
    preguntas_sugeridas: lista(b.preguntas_sugeridas, 6),
    lecciones,
    examen: (Array.isArray(b.examen) ? b.examen : []).slice(0, MAX_EXAMEN).map((p) => preguntaLimpia(p, true)),
  };
}

// ---------------------------------------------------------------- los videos

const INSTRUCCIONES_VER = `Ves una clase en video que grabó una coach de Merkatics (una plataforma de cursos para emprendedores y dueños de pequeños negocios en México). Después otra IA usará tus notas para armar el curso con ella, así que anota con cuidado y con tiempos.

- "segmentos": lo que explica la persona, en orden, en tramos de 15 a 60 segundos que empiezan en pausas naturales. "inicio" es el minuto y segundo donde empieza cada tramo, como "6:10" o, pasada la hora, "1:02:30". "texto" son notas detalladas de lo que dice en ese tramo, en su idioma: las ideas, ejemplos, cifras y pasos que menciona. Escríbelas con tus palabras; no copies palabra por palabra. Si en pantalla aparece algo importante (diapositivas, textos, una demostración), agrégalo al final entre corchetes: [En pantalla: …].
- Si en el video nadie habla, describe en los segmentos lo que se ve y se hace.
- "resumen": de 2 a 4 frases sobre de qué trata el video y qué temas cubre, en orden.`;

const ESQUEMA_VER = {
  type: "object",
  properties: {
    segmentos: {
      type: "array",
      items: { type: "object", properties: { inicio: { type: "string" }, texto: { type: "string" } }, required: ["inicio", "texto"] },
    },
    resumen: { type: "string" },
  },
  required: ["segmentos", "resumen"],
};

type Nota = { t: number; texto: string };

export async function notasDe(video: string): Promise<Nota[]> {
  const guardado = await leerAparte(claveNotas(video));
  if (!guardado) return [];
  try {
    return JSON.parse(guardado) as Nota[];
  } catch {
    return [];
  }
}

/**
 * Un paso del video: mandarlo a Gemini, esperar a que lo procese o verlo y
 * anotar lo que dice. Devuelve los cambios para el video (se guardan fuera:
 * aquí no se toca el almacén). El navegador lo llama hasta que queda listo.
 */
export async function avanzarVideo(v: VideoTaller): Promise<Partial<VideoTaller>> {
  if (v.estado === "listo") return {};
  if (!v.gemini) return { gemini: await subirAGemini(v), estado: "procesando", error: undefined };
  const enGemini = await estadoEnGemini(v.gemini);
  if (enGemini.estado === "perdido") return { gemini: undefined };
  if (enGemini.estado === "procesando" || !enGemini.uri) return v.estado === "procesando" ? {} : { estado: "procesando", error: undefined };

  const pedido = `Anota lo que se dice en el video "${v.nombreOriginal}"${v.duracion ? `, que dura ${reloj(v.duracion)}` : ""}. Responde solo con el JSON.`;
  const r = await pedirJSON<{ segmentos?: { inicio?: string; texto?: string }[]; resumen?: string }>(
    [createPartFromUri(enGemini.uri, v.tipo), { text: pedido }],
    INSTRUCCIONES_VER,
    () => ESQUEMA_VER,
    270_000,
    true,
    { porModeloMs: 100_000 },
  );
  const notas: Nota[] = [];
  for (const s of Array.isArray(r.segmentos) ? r.segmentos : []) {
    const dicho = texto(s?.texto, 4000);
    if (!dicho) continue;
    let t = segundos(s?.inicio) ?? notas.at(-1)?.t ?? 0;
    if (v.duracion) t = Math.min(t, v.duracion);
    notas.push({ t: Math.round(t), texto: dicho });
  }
  if (notas.length === 0) throw new ErrorDeDatos("La IA no pudo ver ese video. Prueba exportándolo de nuevo en MP4.");
  await guardarAparte(claveNotas(v.id), JSON.stringify(notas));
  await borrarDeGemini(v.gemini);
  return { estado: "listo", error: undefined, gemini: undefined, resumen: texto(r.resumen, 2000) };
}

/** Lo que queda de un video que se quita (o de un curso que se crea o se descarta). */
export async function soltarVideo(v: VideoTaller): Promise<void> {
  if (v.gemini) await borrarDeGemini(v.gemini);
  await borrarAparte(claveNotas(v.id));
}

// ---------------------------------------------------------------- el documento

export async function guardarDocumento(t: TallerCurso, doc: Documento): Promise<TallerCurso["documento"]> {
  if (doc.tipo === "pdf") {
    await guardarAparte(claveDocumento(t.id), doc.datos.toString("base64"));
    return { nombre: doc.nombre, tipo: "pdf" };
  }
  await guardarAparte(claveDocumento(t.id), doc.texto);
  return { nombre: doc.nombre, tipo: "texto", palabras: doc.texto.split(/\s+/).filter(Boolean).length };
}

export const borrarDocumento = (t: Pick<TallerCurso, "id">) => borrarAparte(claveDocumento(t.id));

// ---------------------------------------------------------------- la plática

const INSTRUCCIONES_PLATICA = `Eres la asistente de Merkatics que ayuda a una coach a armar un curso en línea platicando con ella. Merkatics es una plataforma de cursos y comunidades para emprendedores y dueños de pequeños negocios en México.

Cada vez recibes los videos que subió la coach (con notas de lo que se dice en cada uno y en qué minuto), su documento si subió uno, el borrador actual del curso en JSON y su mensaje. Contestas en "respuesta" y haces en el borrador los cambios que te pidió.

Cómo platicas:
- En español de México, cálida y directa, tuteando. No saludes: ya están platicando. "respuesta" es corta, de 1 a 4 frases: di qué hiciste o qué propones. No repitas lo que ya se ve en el borrador: la coach lo tiene a un lado.
- Si pide algo claro, hazlo de una vez. Si es ambiguo o no hay material para hacerlo, pregúntale en lugar de inventar.
- Si un video todavía se está procesando, avísale que lo usarás en cuanto termine.
- Cambia solo lo que te pidió o lo que hace falta para cumplirlo. No rehagas lo que la coach escribió a mano si no te lo pide.

Cómo cambias el borrador (manda solo lo que cambia; lo que no mandes se queda igual):
- "curso": solo los campos que cambian. "aprenderas": de 3 a 5 cosas concretas que el alumno sabrá hacer. "requisitos": lo que hay que saber antes, o "Ninguno.". "preguntas_sugeridas": preguntas que un alumno le haría al asistente del curso.
- "lecciones": cada elemento cambia la lección con ese "id", solo en los campos que mandes. Para una lección nueva usa un id nuevo, como "nueva1".
  - "modulo": el título de su módulo; las lecciones seguidas del mismo módulo llevan exactamente el mismo título. Agrupa en 1 a 4 módulos según los temas. Sin números ("Módulo 1:").
  - "titulo" sin número. "resumen": una sola línea con lo que logra el alumno.
  - "contenido": los apuntes de la lección en Markdown (## subtítulos, **negritas**, listas), de 100 a 400 palabras, con tus palabras.
  - "duracion_min": minutos para estudiarla (si tiene video, lo que dura lo que se ve).
  - "repaso": la lista completa de preguntas de repaso de la lección (reemplaza las que tenía).
  - "video": el número del video de la lección ("Video 1" es 1); 0 para quitárselo. "inicio" y "fin" ("6:10" o "1:02:30") si la lección es solo un tramo del video; vacíos ("") para usar el video completo. Corta en pausas naturales o cambios de tema, nunca a media frase; los tramos de un mismo video no se enciman.
- "quitar": ids de las lecciones a borrar.
- "orden": todos los ids de las lecciones en el orden nuevo, solo si cambias el orden.
- "examen": la lista completa del examen final (reemplaza al anterior), con "leccion" = id de la lección de donde sale cada pregunta.
- Cada pregunta: 3 o 4 opciones, una sola correcta ("correcta" es el índice desde 0), opciones incorrectas creíbles y una "explicacion" breve de por qué la correcta lo es.

Reglas del contenido:
- Usa solo lo que dicen y muestran los videos, el documento de la coach y lo que ella te cuente. No inventes datos, cifras, nombres, casos ni recomendaciones.
- El alumno nunca ve el documento ni las notas de los videos: no digas "el documento", "las notas" ni "en el video"; habla de "la lección" o explica la idea directo.
- Si la coach pide cantidades exactas, cúmplelas.
- Cada lección nueva que armes lleva su "repaso" y sus "preguntas_sugeridas", aunque no te lo pidan (si no dice cantidad, 2 preguntas de repaso).
- Si te pide armar el curso completo sin más detalles: con videos, lecciones de unos 4 a 10 minutos (un video corto es una lección; uno largo, varias, cada una con su tramo); con documento, de 2 a 12 lecciones según su largo. Por defecto, un examen de 5 a 10 preguntas.
- Si una lección tiene video, sus textos y preguntas salen de lo que se dice en ese video (o en su tramo).`;

const TEXTO = { type: "string" };
const LISTA = { type: "array", items: TEXTO };
const ESQUEMA_PLATICA = {
  type: "object",
  properties: {
    respuesta: TEXTO,
    curso: {
      type: "object",
      properties: { titulo: TEXTO, subtitulo: TEXTO, aprenderas: LISTA, requisitos: TEXTO, preguntas_sugeridas: LISTA },
    },
    lecciones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: TEXTO,
          modulo: TEXTO,
          titulo: TEXTO,
          resumen: TEXTO,
          contenido: TEXTO,
          duracion_min: { type: "integer" },
          preguntas_sugeridas: LISTA,
          repaso: { type: "array", items: PREGUNTA },
          video: { type: "integer" },
          inicio: TEXTO,
          fin: TEXTO,
        },
        required: ["id"],
      },
    },
    quitar: LISTA,
    orden: LISTA,
    examen: { type: "array", items: { ...PREGUNTA, properties: { ...PREGUNTA.properties, leccion: TEXTO } } },
  },
  required: ["respuesta"],
};

type Cambios = {
  respuesta?: string;
  curso?: Record<string, unknown>;
  lecciones?: Record<string, unknown>[];
  quitar?: unknown[];
  orden?: unknown[];
  examen?: Record<string, unknown>[];
};

/** Una pregunta que escribió la IA: se barajan las opciones (los modelos suelen poner la correcta primero). Null si no sirve. */
function preguntaDeLaIA(v: unknown): PreguntaCurso | null {
  const q = (v ?? {}) as Record<string, unknown>;
  const opciones = (Array.isArray(q.opciones) ? q.opciones : []).map((o) => texto(o, 200)).filter(Boolean).slice(0, 6);
  const enunciado = texto(q.enunciado, 400);
  const correcta = Number(q.correcta);
  if (!enunciado || opciones.length < 2 || !Number.isInteger(correcta) || correcta < 0 || correcta >= opciones.length) return null;
  const orden = opciones.map((_, i) => i).sort(() => Math.random() - 0.5);
  return {
    id: idPregunta(),
    enunciado,
    opciones: orden.map((i) => opciones[i]),
    correcta: orden.indexOf(correcta),
    ...(texto(q.explicacion, 600) ? { explicacion: texto(q.explicacion, 600) } : {}),
  };
}

/** Aplica al borrador los cambios que mandó la IA. Devuelve lo que cambió, para mostrarlo en la plática. */
export function aplicarCambios(t: TallerCurso, c: Cambios): string[] {
  const b = t.borrador;
  const hecho: string[] = [];
  const porNumero = new Map(t.videos.map((v, i) => [i + 1, v]));
  const buscar = (id: string) => b.lecciones.find((l) => l.id === id);

  const curso = c.curso && typeof c.curso === "object" ? c.curso : {};
  const cambiados: string[] = [];
  for (const [k, largo, nombre] of [["titulo", 120, "título"], ["subtitulo", 240, "subtítulo"], ["requisitos", 300, "requisitos"]] as const) {
    if (texto(curso[k], largo)) {
      b[k] = texto(curso[k], largo);
      cambiados.push(nombre);
    }
  }
  for (const [k, n, nombre] of [["aprenderas", 8, "lo que aprenderá"], ["preguntas_sugeridas", 6, "preguntas sugeridas"]] as const) {
    if (Array.isArray(curso[k])) {
      b[k] = lista(curso[k], n);
      cambiados.push(nombre);
    }
  }
  if (cambiados.length) hecho.push(`Curso: ${cambiados.join(", ")}`);

  const mapa = new Map<string, string>(); // id que inventó la IA → id de verdad
  for (const x of Array.isArray(c.lecciones) ? c.lecciones : []) {
    if (!x || typeof x !== "object") continue;
    const pedido = texto(x.id, 40);
    let l = buscar(pedido);
    const nueva = !l;
    if (!l) {
      if (b.lecciones.length >= MAX_LECCIONES) continue;
      l = leccionVacia(t, b.lecciones.at(-1)?.modulo ?? "");
      b.lecciones.push(l);
      if (pedido) mapa.set(pedido, l.id);
    }
    const campos: string[] = [];
    for (const [k, largo, nombre] of [["modulo", 120, "módulo"], ["titulo", 140, "título"], ["resumen", 300, "resumen"], ["contenido", 20_000, "apuntes"]] as const) {
      if (typeof x[k] !== "string") continue;
      const valor = k === "modulo" || k === "titulo" ? sinNumero(x[k]).slice(0, largo) : texto(x[k], largo);
      if (valor !== l[k]) {
        l[k] = valor;
        campos.push(nombre);
      }
    }
    const minutos = Math.round(Number(x.duracion_min));
    if (x.duracion_min !== undefined && Number.isFinite(minutos) && minutos > 0) l.duracion_min = Math.min(minutos, 240);
    if (Array.isArray(x.preguntas_sugeridas)) l.preguntas_sugeridas = lista(x.preguntas_sugeridas, 4);
    if (Array.isArray(x.repaso)) {
      l.repaso = x.repaso.map(preguntaDeLaIA).filter((p): p is PreguntaCurso => !!p).slice(0, MAX_REPASO);
      campos.push(`${l.repaso.length} ${l.repaso.length === 1 ? "pregunta" : "preguntas"} de repaso`);
    }
    if (x.video !== undefined && x.video !== null) {
      const v = porNumero.get(Number(x.video));
      if ((v?.id ?? undefined) !== l.video) {
        l.video = v?.id;
        delete l.inicio;
        delete l.fin;
        campos.push(v ? `video ${x.video}` : "sin video");
      }
    }
    if (l.video && ("inicio" in x || "fin" in x)) {
      try {
        const tramo = leerTramo(
          t.videos.find((v) => v.id === l.video),
          x.inicio,
          x.fin,
        );
        if (tramo.inicio !== l.inicio || tramo.fin !== l.fin) {
          l.inicio = tramo.inicio;
          l.fin = tramo.fin;
          if (l.inicio === undefined) delete l.inicio;
          if (l.fin === undefined) delete l.fin;
          campos.push("tramo del video");
        }
      } catch {
        // un tramo que no se entiende se ignora
      }
    }
    const nombre = l.titulo || "sin título";
    if (nueva) hecho.push(`Nueva lección: ${nombre}`);
    else if (campos.length) hecho.push(`«${nombre}»: ${[...new Set(campos)].join(", ")}`);
  }

  for (const id of (Array.isArray(c.quitar) ? c.quitar : []).map((x) => mapa.get(String(x)) ?? String(x))) {
    const l = buscar(id);
    if (!l) continue;
    b.lecciones = b.lecciones.filter((x) => x.id !== id);
    b.examen = b.examen.map((q) => (q.leccion === id ? { ...q, leccion: undefined } : q));
    hecho.push(`Quitó: ${l.titulo || "lección sin título"}`);
  }

  if (Array.isArray(c.orden) && c.orden.length) {
    const ids = [...new Set(c.orden.map((x) => mapa.get(String(x)) ?? String(x)))];
    const antes = b.lecciones.map((l) => l.id).join();
    const primero = ids.map(buscar).filter((l): l is LeccionTaller => !!l);
    b.lecciones = [...primero, ...b.lecciones.filter((l) => !ids.includes(l.id))];
    if (b.lecciones.map((l) => l.id).join() !== antes) hecho.push("Nuevo orden de las lecciones");
  }

  if (Array.isArray(c.examen)) {
    const ids = new Set(b.lecciones.map((l) => l.id));
    b.examen = c.examen.slice(0, MAX_EXAMEN).flatMap((q) => {
      const p = preguntaDeLaIA(q);
      if (!p) return [];
      const leccion = mapa.get(String(q?.leccion ?? "")) ?? String(q?.leccion ?? "");
      return [{ ...p, ...(ids.has(leccion) ? { leccion } : {}) }];
    });
    hecho.push(`Examen: ${b.examen.length} ${b.examen.length === 1 ? "pregunta" : "preguntas"}`);
  }
  return hecho;
}

async function contexto(t: TallerCurso): Promise<string> {
  const partes: string[] = [];
  const numeros = new Map(t.videos.map((v, i) => [v.id, i + 1]));
  if (t.videos.length) {
    const bloques = await Promise.all(
      t.videos.map(async (v, i) => {
        const cabeza = `### Video ${i + 1}: «${v.nombreOriginal}»${v.duracion ? ` — dura ${reloj(v.duracion)}` : ""}`;
        if (v.estado !== "listo") return `${cabeza}\n(Todavía se está procesando: aún no sabes qué dice.)`;
        let dicho = (await notasDe(v.id)).map((n) => `[${reloj(n.t)}] ${n.texto}`).join("\n");
        if (dicho.length > MAX_NOTAS) dicho = `${dicho.slice(0, MAX_NOTAS)}\n[…]`;
        return `${cabeza}\nDe qué trata: ${v.resumen ?? ""}\nLo que se dice:\n${dicho}`;
      }),
    );
    partes.push(`## Los videos de la coach\n\n${bloques.join("\n\n")}`);
  } else {
    partes.push("## Los videos de la coach\n\n(No ha subido videos.)");
  }
  if (t.documento?.tipo === "texto") {
    const doc = (await leerAparte(claveDocumento(t.id))) ?? "";
    partes.push(`## Su documento «${t.documento.nombre}»\n\n<documento>\n${doc}\n</documento>`);
  } else if (t.documento) {
    partes.push(`## Su documento «${t.documento.nombre}»\n\nVa adjunto (PDF).`);
  }
  const borrador = {
    ...t.borrador,
    lecciones: t.borrador.lecciones.map(({ video, inicio, fin, ...l }) => ({
      ...l,
      repaso: l.repaso.map(({ id: _id, ...q }) => q),
      video: (video && numeros.get(video)) || 0,
      inicio: inicio !== undefined ? reloj(inicio) : "",
      fin: fin !== undefined ? reloj(fin) : "",
    })),
    examen: t.borrador.examen.map(({ id: _id, ...q }) => q),
  };
  partes.push(`## El borrador actual del curso\n\n${JSON.stringify(borrador)}`);
  return partes.join("\n\n");
}

/** Lo que se le pide a la IA con el mensaje de la coach. La respuesta se aplica con aplicarCambios. */
export async function preguntarALaIA(t: TallerCurso, mensaje: string): Promise<Cambios> {
  const contents: Content[] = [];
  for (const m of t.chat.slice(-MAX_PLATICA)) {
    const role = m.rol === "ia" ? "model" : "user";
    if (contents.length === 0 && role === "model") continue;
    contents.push({ role, parts: [{ text: m.texto || "…" }] });
  }
  const parts: Part[] = [];
  if (t.documento?.tipo === "pdf") {
    const datos = await leerAparte(claveDocumento(t.id));
    if (datos) parts.push({ inlineData: { mimeType: "application/pdf", data: datos } });
  }
  parts.push({ text: `${await contexto(t)}\n\n## El mensaje de la coach\n\n${mensaje}\n\nResponde solo con el JSON.` });
  contents.push({ role: "user", parts });
  return pedirJSON<Cambios>(contents, INSTRUCCIONES_PLATICA, () => ESQUEMA_PLATICA, 270_000, false, {
    modelos: MODELOS_PLATICA,
    porModeloMs: 110_000,
  });
}

const INSTRUCCIONES_REPASO = `Escribes las preguntas de repaso de lecciones de un curso en línea de Merkatics (para emprendedores y dueños de pequeños negocios en México), en español de México y tuteando.
- Para cada lección: "repaso" con exactamente 2 preguntas sobre esa lección. Cada una con 3 o 4 opciones, una sola correcta ("correcta" es el índice desde 0), opciones incorrectas creíbles y una "explicacion" breve de por qué la correcta lo es.
- "preguntas_sugeridas": 2 o 3 preguntas que un alumno le haría al asistente sobre esa lección.
- Usa solo lo que dicen los apuntes de la lección. No digas "los apuntes": habla de "la lección".`;

/**
 * Los modelos ligeros a veces arman lecciones nuevas sin su repaso. Si pasa,
 * se le piden aparte (sin preguntar a la coach). Devuelve los cambios para aplicarCambios.
 */
export async function repasoQueFalta(t: TallerCurso, ids: string[]): Promise<Cambios> {
  const lecciones = t.borrador.lecciones.filter((l) => ids.includes(l.id));
  const pedido = lecciones.map((l) => `## Lección ${l.id}: ${l.titulo}\n${l.contenido || l.resumen}`).join("\n\n");
  const esquema = {
    type: "object",
    properties: {
      lecciones: {
        type: "array",
        items: {
          type: "object",
          properties: { id: TEXTO, repaso: { type: "array", items: PREGUNTA }, preguntas_sugeridas: LISTA },
          required: ["id", "repaso", "preguntas_sugeridas"],
        },
      },
    },
    required: ["lecciones"],
  };
  return pedirJSON<Cambios>([{ text: `${pedido}\n\nResponde solo con el JSON.` }], INSTRUCCIONES_REPASO, () => esquema, 90_000, false, {
    modelos: MODELOS_PLATICA,
    porModeloMs: 45_000,
  });
}

/** Guarda la plática (los últimos mensajes). */
export function anotarPlatica(t: TallerCurso, mensaje: string, respuesta: string, cambios: string[]): void {
  t.chat = [...t.chat, { rol: "coach" as const, texto: mensaje }, { rol: "ia" as const, texto: respuesta, cambios }].slice(-MAX_CHAT);
}

// ---------------------------------------------------------------- crear el curso

/** Una pregunta tal como quedó (sin barajar), o null si está incompleta. */
function preguntaCompleta(q: PreguntaCurso): PreguntaCurso | null {
  const todas = q.opciones.map((o) => o.trim());
  if (!q.enunciado.trim() || !todas[q.correcta]) return null;
  const opciones = todas.filter(Boolean);
  if (opciones.length < 2) return null;
  return { ...q, opciones, correcta: opciones.indexOf(todas[q.correcta]) };
}

export function minutosDe(l: LeccionTaller, v?: VideoTaller): number | undefined {
  if (l.duracion_min) return l.duracion_min;
  const fin = l.fin ?? v?.duracion;
  if (v && fin) return Math.max(1, Math.round((fin - (l.inicio ?? 0)) / 60));
  return undefined;
}

/**
 * Vuelve el borrador un curso en borrador del editor (se llama dentro de
 * `modificar`). Como en los demás cursos, el módulo 1 queda gratis (si solo
 * hay un módulo, la primera lección). Devuelve el curso, cuántas preguntas
 * incompletas no se pasaron y los videos que ya no usa nadie (para borrarlos).
 */
export function crearCurso(a: Almacen, t: TallerCurso, coach: Coach): { curso: CursoCreado; sueltas: number; sobran: VideoTaller[] } {
  const b = t.borrador;
  if (b.lecciones.length === 0) throw new ErrorDeDatos("Agrega al menos una lección antes de crear el curso.");
  const videos = new Map(t.videos.map((v) => [v.id, v]));
  let sueltas = 0;
  const completas = (ps: PreguntaCurso[]) =>
    ps.flatMap((p) => {
      const q = preguntaCompleta(p);
      if (!q) sueltas++;
      return q ? [q] : [];
    });

  const modulos: { titulo: string; lecciones: Record<string, unknown>[] }[] = [];
  for (const l of b.lecciones) {
    // Una lección sin módulo va en el de la anterior.
    const titulo = sinNumero(l.modulo) || (modulos.at(-1)?.titulo ?? "");
    if (!modulos.length || modulos.at(-1)!.titulo !== titulo) modulos.push({ titulo, lecciones: [] });
    modulos.at(-1)!.lecciones.push({
      id: `t-${l.id}`,
      titulo: sinNumero(l.titulo) || `Lección ${b.lecciones.indexOf(l) + 1}`,
      duracion_min: minutosDe(l, l.video ? videos.get(l.video) : undefined) ?? 5,
      resumen: l.resumen,
      contenido: l.contenido,
      transcripcion: "",
      preguntas_sugeridas: l.preguntas_sugeridas,
      repaso: completas(l.repaso),
    });
  }
  // El editor admite hasta 8 módulos: si hay más, los últimos se juntan en el octavo.
  while (modulos.length > 8) modulos[7].lecciones.push(...modulos.splice(8, 1)[0].lecciones);
  const solo = modulos.length === 1;
  modulos.forEach((m, i) => {
    if (!m.titulo && modulos.length > 1) m.titulo = "Módulo";
    m.lecciones.forEach((l, k) => (l.gratis = solo ? k === 0 : i === 0));
  });
  const examen = completas(b.examen).map((q) => ({ ...q, ...(q.leccion ? { leccion: `t-${q.leccion}` } : {}) }));
  const base = nuevoCurso(a, coach, t.comunidad, t.chat.some((m) => m.rol === "ia") ? "ia" : "manual");
  const curso = aplicarEdicion(a, base, {
    titulo: b.titulo || "Curso sin título",
    subtitulo: b.subtitulo,
    aprenderas: b.aprenderas,
    requisitos: b.requisitos,
    preguntas_sugeridas: b.preguntas_sugeridas,
    modulos,
    examen,
    ...(examen.length === 0 ? { sinExamen: true } : {}),
  });

  // El video de cada lección (con su tramo, si es solo una parte).
  const creadas = curso.modulos.flatMap((m) => m.lecciones);
  const nuevos: VideoLeccion[] = [];
  b.lecciones.forEach((l, i) => {
    const v = l.video ? videos.get(l.video) : undefined;
    const leccion = creadas[i];
    if (!v || !leccion) return;
    const fin = l.fin ?? (l.inicio !== undefined ? v.duracion : undefined);
    nuevos.push({
      leccion: leccion.id,
      archivo: v.archivo,
      ...(v.url ? { url: v.url } : {}),
      tipo: v.tipo,
      bytes: v.bytes,
      nombreOriginal: v.nombreOriginal,
      subidoEn: v.subidoEn,
      ...(fin !== undefined ? { inicio: l.inicio ?? 0, fin: Math.round(fin) } : {}),
    });
  });
  (a.cursosCoach ??= []).push(curso);
  a.videos = [...(a.videos ?? []), ...nuevos];
  a.talleres = (a.talleres ?? []).filter((x) => x.id !== t.id);
  const usados = new Set(b.lecciones.map((l) => l.video));
  return { curso, sueltas, sobran: t.videos.filter((v) => !usados.has(v.id)) };
}
