import radarHighImpact from "@/data/diagnosticos/radar-high-impact.json";

// Diagnósticos de autoevaluación que una lección puede incrustar con la marca
// <!-- diagnostico:id --> en su texto. Hay dos clases:
//   - los que viajan con el proyecto (el Radar de Liderazgo de INCREASE);
//   - los que crea cada coach desde su panel (a mano, con IA o con la guía),
//     que viven en el almacén (DiagnosticoCreado).
// Cada pregunta es de escala (del 1 al 5) o de opciones con sus propios
// puntos. Las preguntas se agrupan en áreas (dimensiones); con una sola área
// el resultado es un solo puntaje. Se calcula en el navegador y el servidor
// lo vuelve a calcular al guardar: no es un examen y no se califica.

export interface Banda {
  desde: number;
  hasta: number;
  texto: string;
}

export interface OpcionPregunta {
  texto: string;
  puntos: number;
}

/** Una pregunta: sin `opciones`, se responde con la escala del 1 al 5. */
export interface PreguntaDiagnostico {
  texto: string;
  opciones?: OpcionPregunta[];
}

export interface Dimension {
  id: string;
  nombre: string;
  /** Nombre corto para la gráfica. */
  corto: string;
  /** Qué significa y qué se recomienda si es el área más baja. */
  descripcion: string;
  pregunta: string;
  /** Las del Radar original (todas de escala). */
  afirmaciones: string[];
  /** Las de los diagnósticos que crea el coach. */
  preguntas?: PreguntaDiagnostico[];
}

export interface Diagnostico {
  id: string;
  titulo: string;
  instrucciones: string;
  escala: { valor: number; texto: string; detalle: string }[];
  dimensiones: Dimension[];
  porDimension: Banda[];
  global: Banda[];
  /** "porcentaje": los rangos van de 0 a 100 % del puntaje máximo (los del coach); si no, en puntos. */
  bandasEn?: "puntos" | "porcentaje";
  regla: string;
  aviso: string;
  /**
   * Invitación a agendar con la coach al ver el resultado. `mensaje` es el texto
   * que se manda por WhatsApp: {nombre}, {total}, {maximo}, {dimension} y {puntos}.
   */
  cta?: { titulo: string; texto: string; mensaje: string };
}

/** Un diagnóstico creado por un coach (vive en el almacén). */
export interface DiagnosticoCreado extends Diagnostico {
  empresa: string;
  /** Curso del que es el primer paso (si lo es). */
  curso?: string;
  autor: string;
  creadoEn: string;
  actualizadoEn: string;
}

const DIAGNOSTICOS: Record<string, Diagnostico> = {
  [radarHighImpact.id]: radarHighImpact,
};

/** Los que viajan con el proyecto (los creados se buscan en el almacén o con useDiagnostico). */
export const diagnostico = (id: string): Diagnostico | undefined => DIAGNOSTICOS[id];

/** Uno que viaja con el proyecto o uno creado por un coach (en el servidor, con el almacén). */
export const diagnosticoEn = (a: { diagnosticosCoach?: DiagnosticoCreado[] }, id: string): Diagnostico | undefined =>
  DIAGNOSTICOS[id] ?? a.diagnosticosCoach?.find((x) => x.id === id);

/** La escala del 1 al 5 de las preguntas de escala (la misma del Radar). */
export const ESCALA = radarHighImpact.escala;

export const LIMITES = {
  areas: 8,
  preguntasPorArea: 20,
  preguntas: 60,
  opciones: 6,
  puntos: 100,
  rangos: 6,
} as const;

// ---------------------------------------------------------------- preguntas y puntos

export const preguntasDe = (d: Dimension): PreguntaDiagnostico[] =>
  d.preguntas ?? d.afirmaciones.map((texto) => ({ texto }));

export const totalPreguntas = (d: Diagnostico) => d.dimensiones.reduce((s, x) => s + preguntasDe(x).length, 0);

const mayorEscala = (d: Diagnostico) => Math.max(...d.escala.map((e) => e.valor));

/** Lo más que puede dar una pregunta. */
export const maximoPregunta = (d: Diagnostico, p: PreguntaDiagnostico) =>
  p.opciones ? Math.max(0, ...p.opciones.map((o) => o.puntos)) : mayorEscala(d);

/** Los puntos de una respuesta: en escala, su valor; en opciones, los puntos de la opción elegida (su índice). */
export const puntosDe = (p: PreguntaDiagnostico, valor: number | null) =>
  valor === null ? 0 : p.opciones ? (p.opciones[valor]?.puntos ?? 0) : valor;

export const maximoDe = (d: Diagnostico) =>
  d.dimensiones.reduce((s, x) => s + preguntasDe(x).reduce((t, p) => t + maximoPregunta(d, p), 0), 0);

// ---------------------------------------------------------------- marcas en las lecciones

/**
 * Marcas que una lección puede llevar en su texto: un diagnóstico
 * (<!-- diagnostico:id -->), un plan por días (<!-- plan:id -->) o los botones
 * para agendar con la coach (<!-- agendar -->).
 */
export const MARCA_DIAGNOSTICO = /<!--\s*(?:diagnostico:([a-z0-9-]+)|plan:([a-z0-9-]+)|(agendar))\s*-->/;

export type ParteLeccion = { texto: string } | { diagnostico: string } | { plan: string } | { agendar: true };

/** Parte el texto de una lección en tramos de texto, diagnósticos y botones de agenda, en orden. */
export function partirLeccion(texto: string): ParteLeccion[] {
  const partes: ParteLeccion[] = [];
  let resto = texto;
  for (let m = resto.match(MARCA_DIAGNOSTICO); m && m.index !== undefined; m = resto.match(MARCA_DIAGNOSTICO)) {
    const antes = resto.slice(0, m.index).trim();
    if (antes) partes.push({ texto: antes });
    partes.push(m[1] ? { diagnostico: m[1] } : m[2] ? { plan: m[2] } : { agendar: true });
    resto = resto.slice(m.index + m[0].length);
  }
  if (resto.trim()) partes.push({ texto: resto.trim() });
  return partes;
}

/** El texto de la lección sin las marcas (para el asistente y los resúmenes). */
export const sinMarcas = (texto: string) => texto.replace(new RegExp(MARCA_DIAGNOSTICO, "g"), "").trim();

/** ¿La lección incrusta este diagnóstico? (El servidor lo revisa antes de guardar un resultado.) */
export const llevaDiagnostico = (texto: string, id: string) =>
  partirLeccion(texto).some((p) => "diagnostico" in p && p.diagnostico === id);

/** El diagnóstico que incrusta una lección (el primero), si lleva uno. */
export const diagnosticoDeLeccion = (texto: string): string | null => {
  const p = partirLeccion(texto).find((x) => "diagnostico" in x);
  return p && "diagnostico" in p ? p.diagnostico : null;
};

/** ¿La lección incrusta este plan por días? */
export const llevaPlan = (texto: string, id: string) => partirLeccion(texto).some((p) => "plan" in p && p.plan === id);

// ---------------------------------------------------------------- respuestas y resultado

/**
 * Revisa las respuestas que manda el navegador: una lista por dimensión, con
 * un valor por pregunta (escala: de 1 a 5; opciones: el índice de la elegida).
 * null si no están completas o no valen.
 */
export function respuestasValidas(d: Diagnostico, valor: unknown): Record<string, number[]> | null {
  if (!valor || typeof valor !== "object") return null;
  const escala = new Set(d.escala.map((e) => e.valor));
  const limpias: Record<string, number[]> = {};
  for (const dimension of d.dimensiones) {
    const preguntas = preguntasDe(dimension);
    const lista = (valor as Record<string, unknown>)[dimension.id];
    if (!Array.isArray(lista) || lista.length !== preguntas.length) return null;
    const bien = lista.every((v, i) => {
      if (typeof v !== "number" || !Number.isInteger(v)) return false;
      const p = preguntas[i];
      return p.opciones ? v >= 0 && v < p.opciones.length : escala.has(v);
    });
    if (!bien) return null;
    limpias[dimension.id] = lista as number[];
  }
  return limpias;
}

/** El mensaje de WhatsApp de la invitación, con el resultado del alumno. */
export function mensajeDeResultado(d: Diagnostico, r: Resultado, nombre: string): string {
  const baja = r.dimensiones.find((x) => x.dimension.id === r.masBajas[0]?.id);
  return (d.cta?.mensaje ?? "")
    .replaceAll("{nombre}", nombre || "un alumno del curso")
    .replaceAll("{total}", String(r.total))
    .replaceAll("{maximo}", String(r.maximo))
    .replaceAll("{dimension}", r.masBajas.map((x) => x.nombre).join(" y "))
    .replaceAll("{puntos}", String(baja?.puntos ?? ""));
}

export const bandaDe = (bandas: Banda[], valor: number) =>
  bandas.find((b) => valor >= b.desde && valor <= b.hasta) ??
  // Entre dos rangos (por ejemplo, 39.5 %): el que empieza más cerca por debajo.
  [...bandas].sort((x, y) => y.desde - x.desde).find((b) => valor >= b.desde) ??
  bandas[0];

const porciento = (puntos: number, maximo: number) => (maximo > 0 ? Math.round((puntos / maximo) * 100) : 0);

export interface Resultado {
  dimensiones: { dimension: Dimension; puntos: number; maximo: number; banda: Banda }[];
  total: number;
  maximo: number;
  global: Banda;
  /** La dimensión (o dimensiones, si empatan) con menor puntuación (en porcentaje, si sus máximos difieren). */
  masBajas: Dimension[];
}

/** Respuestas: una lista por dimensión, con el valor de cada pregunta. */
export function calcular(d: Diagnostico, respuestas: Record<string, (number | null)[]>): Resultado {
  const enPorcentaje = d.bandasEn === "porcentaje";
  const dimensiones = d.dimensiones.map((dimension) => {
    const preguntas = preguntasDe(dimension);
    const valores = respuestas[dimension.id] ?? [];
    const puntos = preguntas.reduce((s, p, i) => s + puntosDe(p, valores[i] ?? null), 0);
    const maximo = preguntas.reduce((s, p) => s + maximoPregunta(d, p), 0);
    const banda = bandaDe(d.porDimension, enPorcentaje ? porciento(puntos, maximo) : puntos);
    return { dimension, puntos, maximo, banda };
  });
  const total = dimensiones.reduce((s, x) => s + x.puntos, 0);
  const maximo = dimensiones.reduce((s, x) => s + x.maximo, 0);
  const relativo = (x: (typeof dimensiones)[number]) => (x.maximo > 0 ? x.puntos / x.maximo : 0);
  const menor = Math.min(...dimensiones.map(relativo));
  return {
    dimensiones,
    total,
    maximo,
    global: bandaDe(d.global, enPorcentaje ? porciento(total, maximo) : total),
    masBajas: dimensiones.filter((x) => relativo(x) === menor).map((x) => x.dimension),
  };
}

// ---------------------------------------------------------------- los que crea el coach

/** Rangos de partida para un diagnóstico nuevo (en porcentaje del puntaje máximo). */
export const RANGOS_GENERALES: Banda[] = [
  { desde: 0, hasta: 39, texto: "Estás empezando: hay varias áreas importantes por trabajar." },
  { desde: 40, hasta: 69, texto: "Vas a la mitad del camino: tienes bases y hay áreas claras por fortalecer." },
  { desde: 70, hasta: 100, texto: "Tienes un buen nivel: ahora toca afinar y sostener lo que ya haces bien." },
];

export const RANGOS_AREA: Banda[] = [
  { desde: 0, hasta: 39, texto: "Por trabajar" },
  { desde: 40, hasta: 69, texto: "En desarrollo" },
  { desde: 70, hasta: 100, texto: "Fortaleza" },
];

export const CTA_COACH = {
  titulo: "Siguiente paso: revisa tu resultado conmigo",
  texto: "Ya tienes tu diagnóstico. Agenda una sesión para revisar tu resultado y definir por dónde empezar.",
  mensaje:
    "Hola, soy {nombre}. Hice el diagnóstico: saqué {total}/{maximo} y mi área más baja es {dimension}. Quiero agendar una sesión.",
};

/** Un diagnóstico vacío para empezar a mano: un área con dos preguntas de escala. */
export function diagnosticoVacio(id: string, titulo = ""): Diagnostico {
  return {
    id,
    titulo,
    instrucciones: "Responde según lo que haces normalmente, no según lo que te gustaría hacer.",
    escala: ESCALA,
    dimensiones: [
      { id: "a1", nombre: "", corto: "", descripcion: "", pregunta: "", afirmaciones: [], preguntas: [{ texto: "" }, { texto: "" }] },
    ],
    porDimension: RANGOS_AREA,
    global: RANGOS_GENERALES,
    bandasEn: "porcentaje",
    regla: "",
    aviso: "",
    cta: CTA_COACH,
  };
}

const textoDe = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const entero = (v: unknown, min: number, max: number, siNo: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : siNo;
};

function rangosDe(v: unknown, siNo: Banda[], maxTexto: number): Banda[] {
  const lista = (Array.isArray(v) ? v : [])
    .slice(0, LIMITES.rangos)
    .map((b) => {
      const x = (b ?? {}) as Record<string, unknown>;
      const desde = entero(x.desde, 0, 100, 0);
      return { desde, hasta: Math.max(desde, entero(x.hasta, 0, 100, 100)), texto: textoDe(x.texto, maxTexto) };
    })
    .sort((x, y) => x.desde - y.desde);
  return lista.length ? lista : siNo;
}

/**
 * Limpia lo que manda el editor (o la IA) a un diagnóstico del coach. Puede
 * quedar incompleto (es un borrador): problemasDe dice qué le falta.
 */
export function diagnosticoLimpio(id: string, entrada: unknown): Diagnostico {
  const x = (entrada ?? {}) as Record<string, unknown>;
  let total = 0;
  const dimensiones = (Array.isArray(x.dimensiones) ? x.dimensiones : []).slice(0, LIMITES.areas).map((dv, i) => {
    const dim = (dv ?? {}) as Record<string, unknown>;
    const nombre = textoDe(dim.nombre, 60);
    const preguntas = (Array.isArray(dim.preguntas) ? dim.preguntas : [])
      .slice(0, Math.min(LIMITES.preguntasPorArea, LIMITES.preguntas - total))
      .map((pv) => {
        const p = (pv ?? {}) as Record<string, unknown>;
        const opciones = Array.isArray(p.opciones)
          ? p.opciones.slice(0, LIMITES.opciones).map((ov) => {
              const o = (ov ?? {}) as Record<string, unknown>;
              return { texto: textoDe(o.texto, 160), puntos: entero(o.puntos, 0, LIMITES.puntos, 0) };
            })
          : null;
        return { texto: textoDe(p.texto, 300), ...(opciones ? { opciones } : {}) };
      });
    total += preguntas.length;
    return {
      id: `a${i + 1}`,
      nombre,
      corto: nombre.length > 18 ? `${nombre.slice(0, 17)}…` : nombre,
      descripcion: textoDe(dim.descripcion, 600),
      pregunta: "",
      afirmaciones: [],
      preguntas,
    };
  });
  const cta = x.cta && typeof x.cta === "object" ? (x.cta as Record<string, unknown>) : null;
  return {
    id,
    titulo: textoDe(x.titulo, 120),
    instrucciones: textoDe(x.instrucciones, 600),
    escala: ESCALA,
    dimensiones: dimensiones.length ? dimensiones : diagnosticoVacio(id).dimensiones,
    porDimension: rangosDe(x.porDimension, RANGOS_AREA, 60),
    global: rangosDe(x.global, RANGOS_GENERALES, 400),
    bandasEn: "porcentaje",
    regla: "",
    aviso: textoDe(x.aviso, 400),
    ...(cta === null && x.cta === null
      ? {}
      : {
          cta: {
            titulo: textoDe(cta?.titulo, 140) || CTA_COACH.titulo,
            texto: textoDe(cta?.texto, 600) || CTA_COACH.texto,
            mensaje: CTA_COACH.mensaje,
          },
        }),
  };
}

/** Lo que le falta a un diagnóstico para que los alumnos lo puedan responder (vacío: listo). */
export function problemasDe(d: Diagnostico): string[] {
  const faltan: string[] = [];
  if (!d.titulo) faltan.push("Ponle un título al diagnóstico.");
  const variasAreas = d.dimensiones.length > 1;
  d.dimensiones.forEach((dim, i) => {
    const area = variasAreas ? (dim.nombre ? `En «${dim.nombre}»` : `En el área ${i + 1}`) : "En el diagnóstico";
    if (variasAreas && !dim.nombre) faltan.push(`El área ${i + 1} necesita un nombre.`);
    const preguntas = preguntasDe(dim);
    if (preguntas.length === 0) faltan.push(`${area} agrega al menos una pregunta.`);
    preguntas.forEach((p, j) => {
      if (!p.texto) faltan.push(`${area}, la pregunta ${j + 1} está vacía.`);
      if (p.opciones) {
        if (p.opciones.length < 2) faltan.push(`${area}, la pregunta ${j + 1} necesita al menos dos opciones.`);
        if (p.opciones.some((o) => !o.texto)) faltan.push(`${area}, la pregunta ${j + 1} tiene opciones vacías.`);
      }
    });
  });
  if (d.global.some((b) => !b.texto)) faltan.push("Escribe el mensaje de cada resultado general.");
  if (d.dimensiones.length > 1 && d.porDimension.some((b) => !b.texto)) faltan.push("Ponle nombre a cada nivel de las áreas.");
  if (maximoDe(d) === 0) faltan.push("Las respuestas deben dar puntos: revisa los puntos de las opciones.");
  return faltan;
}
