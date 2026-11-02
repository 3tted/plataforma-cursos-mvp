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
}

const DIAGNOSTICOS: Record<string, Diagnostico> = {
  [radarHighImpact.id]: radarHighImpact,
};

export const diagnostico = (id: string): Diagnostico | undefined => DIAGNOSTICOS[id];

/** Marca que incrusta un diagnóstico dentro del texto de una lección. */
export const MARCA_DIAGNOSTICO = /<!--\s*diagnostico:([a-z0-9-]+)\s*-->/;

/** Parte el texto de una lección en tramos de texto y diagnósticos, en orden. */
export function partirLeccion(texto: string): ({ texto: string } | { diagnostico: string })[] {
  const partes: ({ texto: string } | { diagnostico: string })[] = [];
  let resto = texto;
  for (let m = resto.match(MARCA_DIAGNOSTICO); m && m.index !== undefined; m = resto.match(MARCA_DIAGNOSTICO)) {
    const antes = resto.slice(0, m.index).trim();
    if (antes) partes.push({ texto: antes });
    partes.push({ diagnostico: m[1] });
    resto = resto.slice(m.index + m[0].length);
  }
  if (resto.trim()) partes.push({ texto: resto.trim() });
  return partes;
}

/** El texto de la lección sin las marcas (para el asistente y los resúmenes). */
export const sinMarcas = (texto: string) => texto.replace(new RegExp(MARCA_DIAGNOSTICO, "g"), "").trim();

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
