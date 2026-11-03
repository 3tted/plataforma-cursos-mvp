import radarHighImpact from "@/data/diagnosticos/radar-high-impact.json";

// Diagnósticos de autoevaluación que una lección puede incrustar con la marca
// <!-- diagnostico:id --> en su texto (por ejemplo, el Radar de Liderazgo de
// INCREASE). Cada afirmación se califica del 1 al 5; cada dimensión suma sus
// afirmaciones y la más baja sugiere por dónde empezar. Se calcula en el
// navegador: no es un examen y no se califica.

export interface Banda {
  desde: number;
  hasta: number;
  texto: string;
}

export interface Dimension {
  id: string;
  nombre: string;
  /** Nombre corto para la gráfica. */
  corto: string;
  descripcion: string;
  pregunta: string;
  afirmaciones: string[];
}

export interface Diagnostico {
  id: string;
  titulo: string;
  instrucciones: string;
  escala: { valor: number; texto: string; detalle: string }[];
  dimensiones: Dimension[];
  porDimension: Banda[];
  global: Banda[];
  regla: string;
  aviso: string;
  /**
   * Invitación a agendar con la coach al ver el resultado. `mensaje` es el texto
   * que se manda por WhatsApp: {nombre}, {total}, {maximo}, {dimension} y {puntos}.
   */
  cta?: { titulo: string; texto: string; mensaje: string };
}

const DIAGNOSTICOS: Record<string, Diagnostico> = {
  [radarHighImpact.id]: radarHighImpact,
};

export const diagnostico = (id: string): Diagnostico | undefined => DIAGNOSTICOS[id];

/**
 * Marcas que una lección puede llevar en su texto: un diagnóstico
 * (<!-- diagnostico:id -->) o los botones para agendar con la coach (<!-- agendar -->).
 */
export const MARCA_DIAGNOSTICO = /<!--\s*(?:diagnostico:([a-z0-9-]+)|(agendar))\s*-->/;

export type ParteLeccion = { texto: string } | { diagnostico: string } | { agendar: true };

/** Parte el texto de una lección en tramos de texto, diagnósticos y botones de agenda, en orden. */
export function partirLeccion(texto: string): ParteLeccion[] {
  const partes: ParteLeccion[] = [];
  let resto = texto;
  for (let m = resto.match(MARCA_DIAGNOSTICO); m && m.index !== undefined; m = resto.match(MARCA_DIAGNOSTICO)) {
    const antes = resto.slice(0, m.index).trim();
    if (antes) partes.push({ texto: antes });
    partes.push(m[1] ? { diagnostico: m[1] } : { agendar: true });
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

/**
 * Revisa las respuestas que manda el navegador: una lista por dimensión, con
 * un valor de la escala por afirmación. null si no están completas o no valen.
 */
export function respuestasValidas(d: Diagnostico, valor: unknown): Record<string, number[]> | null {
  if (!valor || typeof valor !== "object") return null;
  const valores = new Set(d.escala.map((e) => e.valor));
  const limpias: Record<string, number[]> = {};
  for (const dimension of d.dimensiones) {
    const lista = (valor as Record<string, unknown>)[dimension.id];
    if (!Array.isArray(lista) || lista.length !== dimension.afirmaciones.length) return null;
    if (!lista.every((v) => typeof v === "number" && valores.has(v))) return null;
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

export const bandaDe = (bandas: Banda[], puntos: number) =>
  bandas.find((b) => puntos >= b.desde && puntos <= b.hasta) ?? bandas[bandas.length - 1];

export interface Resultado {
  dimensiones: { dimension: Dimension; puntos: number; maximo: number; banda: Banda }[];
  total: number;
  maximo: number;
  global: Banda;
  /** La dimensión (o dimensiones, si empatan) con menor puntuación. */
  masBajas: Dimension[];
}

/** Respuestas: una lista por dimensión, con el valor de 1 a 5 de cada afirmación. */
export function calcular(d: Diagnostico, respuestas: Record<string, (number | null)[]>): Resultado {
  const mayor = Math.max(...d.escala.map((e) => e.valor));
  const dimensiones = d.dimensiones.map((dimension) => {
    const puntos = (respuestas[dimension.id] ?? []).reduce<number>((s, v) => s + (v ?? 0), 0);
    return { dimension, puntos, maximo: dimension.afirmaciones.length * mayor, banda: bandaDe(d.porDimension, puntos) };
  });
  const total = dimensiones.reduce((s, x) => s + x.puntos, 0);
  const menor = Math.min(...dimensiones.map((x) => x.puntos));
  return {
    dimensiones,
    total,
    maximo: dimensiones.reduce((s, x) => s + x.maximo, 0),
    global: bandaDe(d.global, total),
    masBajas: dimensiones.filter((x) => x.puntos === menor).map((x) => x.dimension),
  };
}
