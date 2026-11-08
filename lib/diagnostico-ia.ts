import { diagnosticoLimpio, LIMITES, preguntasDe, type Diagnostico, type PreguntaDiagnostico } from "./diagnosticos";
import { ErrorDeDatos } from "./http";
import { proveedorIA } from "./asistente";
import { preguntar } from "./presentacion-ia";

// La IA ayuda al coach a armar su diagnóstico: lo propone completo a partir de
// lo que quiere medir, sugiere preguntas para un área o revisa las que ya
// escribió. Todo regresa al editor como propuesta: el coach decide qué se
// queda y lo guarda él.

export type TipoPreguntas = "escala" | "opciones" | "mixto";

export interface PedidoDiagnostico {
  /** Qué quiere medir (lo único obligatorio). */
  tema: string;
  /** Para quién es. */
  para: string;
  preguntas: number;
  /** 0: un solo puntaje; de 2 a 6: por áreas. */
  areas: number;
  tipo: TipoPreguntas;
  indicaciones: string;
}

/** El curso del que será el primer paso, para que las preguntas vayan con él. */
export interface ContextoCurso {
  titulo: string;
  subtitulo: string;
  aprenderas: string[];
  lecciones: string[];
}

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const entre = (v: unknown, min: number, max: number, siNo: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : siNo;
};

export function pedidoDe(datos: Record<string, unknown>): PedidoDiagnostico {
  const tema = texto(datos.tema, 400);
  if (tema.length < 5) throw new ErrorDeDatos("Cuéntale a la IA qué quieres medir (por ejemplo: «qué tan listo está para vender por WhatsApp»).");
  const areas = entre(datos.areas, 0, 6, 0);
  return {
    tema,
    para: texto(datos.para, 300),
    preguntas: entre(datos.preguntas, 4, 30, 12),
    areas: areas === 1 ? 0 : areas,
    tipo: datos.tipo === "opciones" || datos.tipo === "mixto" ? datos.tipo : "escala",
    indicaciones: texto(datos.indicaciones, 600),
  };
}

const OPCION = {
  type: "object",
  properties: { texto: { type: "string" }, puntos: { type: "integer" } },
  required: ["texto", "puntos"],
};
const PREGUNTA = {
  type: "object",
  properties: { texto: { type: "string" }, opciones: { type: "array", items: OPCION } },
  required: ["texto"],
};
const RANGO = {
  type: "object",
  properties: { desde: { type: "integer" }, hasta: { type: "integer" }, texto: { type: "string" } },
  required: ["desde", "hasta", "texto"],
};
const ESQUEMA_DIAGNOSTICO = {
  type: "object",
  properties: {
    titulo: { type: "string" },
    instrucciones: { type: "string" },
    dimensiones: {
      type: "array",
      items: {
        type: "object",
        properties: { nombre: { type: "string" }, descripcion: { type: "string" }, preguntas: { type: "array", items: PREGUNTA } },
        required: ["nombre", "descripcion", "preguntas"],
      },
    },
    global: { type: "array", items: RANGO },
    porDimension: { type: "array", items: RANGO },
  },
  required: ["titulo", "instrucciones", "dimensiones", "global", "porDimension"],
};
const ESQUEMA_PREGUNTAS = {
  type: "object",
  properties: { preguntas: { type: "array", items: PREGUNTA } },
  required: ["preguntas"],
};
const ESQUEMA_REVISION = {
  type: "object",
  properties: {
    general: { type: "string" },
    sugerencias: {
      type: "array",
      items: {
        type: "object",
        properties: { pregunta: { type: "integer" }, problema: { type: "string" }, propuesta: { type: "string" } },
        required: ["pregunta", "problema", "propuesta"],
      },
    },
  },
  required: ["general", "sugerencias"],
};

const REGLAS = `Eres experta en diseñar diagnósticos de autoevaluación para coaches, consultores y academias en México. Sus clientes son emprendedores y dueños de negocios pequeños.

Cómo se escriben las preguntas:
- En español de México, tuteando, claras y cortas (máximo 25 palabras).
- Sobre lo que la persona HACE o le PASA de forma observable, no sobre lo que piensa de sí misma ("Reviso mis ventas cada semana", no "Soy bueno con los números").
- Una sola idea por pregunta: nada de "y/o" ni dos cosas a la vez.
- Neutrales: que no se note cuál es la respuesta "buena".
- Sin datos, cifras, marcas ni nombres inventados.

Tipos de pregunta:
- Escala (sin "opciones"): una afirmación en primera persona que se califica del 1 (casi nunca) al 5 (casi siempre). Escríbela de forma que "casi siempre" sea lo deseable.
- Opciones: una pregunta con 3 a 5 opciones de respuesta; cada opción tiene "puntos" de 0 en adelante y la mejor práctica da más puntos. Que las opciones no se repitan y cubran los casos comunes.

Resultados:
- "global": de 3 a 4 rangos en porcentaje del puntaje máximo, de 0 a 100 sin huecos ni encimarse (por ejemplo 0–39, 40–69, 70–100). Su "texto" es el mensaje que lee la persona: 1 o 2 frases que le dicen dónde está y qué le conviene hacer.
- "porDimension": los niveles de cada área, también en porcentaje y de 0 a 100; su "texto" es una etiqueta de 1 a 3 palabras ("Por trabajar", "En desarrollo", "Fortaleza").
- "descripcion" de cada área: qué mide y qué se recomienda si es su área más baja (2 frases).`;

function tipoTexto(tipo: TipoPreguntas) {
  return tipo === "escala"
    ? "Todas las preguntas son de escala (sin opciones)."
    : tipo === "opciones"
      ? "Todas las preguntas son de opciones con puntos."
      : "Combina los dos tipos: la mayoría de escala y algunas de opciones donde convenga.";
}

function contextoTexto(c: ContextoCurso | null) {
  if (!c || !c.titulo) return "";
  return [
    `Este diagnóstico es el primer paso del curso «${c.titulo}»${c.subtitulo ? `: ${c.subtitulo}` : ""}.`,
    c.aprenderas.length ? `Lo que aprenderá: ${c.aprenderas.join("; ")}.` : "",
    c.lecciones.length ? `Sus lecciones: ${c.lecciones.slice(0, 40).join("; ")}.` : "",
    "Que el diagnóstico mida lo que el curso enseña, para que el resultado le diga al alumno por dónde empezar.",
  ]
    .filter(Boolean)
    .join("\n");
}

function leer(crudo: string): Record<string, unknown> {
  try {
    return JSON.parse(crudo) as Record<string, unknown>;
  } catch {
    throw new ErrorDeDatos("La IA devolvió una respuesta incompleta. Inténtalo de nuevo.");
  }
}

/** Ajusta lo que propuso la IA a lo que pidió el coach (tipo de preguntas y áreas). */
function ajustar(d: Diagnostico, pedido: PedidoDiagnostico): Diagnostico {
  const tipoBien = (p: PreguntaDiagnostico): PreguntaDiagnostico =>
    pedido.tipo === "escala" ? { texto: p.texto } : p;
  let dimensiones = d.dimensiones.map((x) => ({
    ...x,
    preguntas: preguntasDe(x)
      .map(tipoBien)
      // Una de opciones sin opciones suficientes, o vacía, no sirve.
      .filter((p) => p.texto && (!p.opciones || p.opciones.length >= 2))
      .filter((p) => pedido.tipo !== "opciones" || p.opciones),
  }));
  if (pedido.areas === 0 && dimensiones.length > 1) {
    dimensiones = [{ ...dimensiones[0], nombre: "", corto: "", preguntas: dimensiones.flatMap((x) => x.preguntas) }];
  }
  if (pedido.areas === 0) dimensiones = dimensiones.map((x) => ({ ...x, nombre: "", corto: "" }));
  return { ...d, dimensiones: dimensiones.filter((x) => x.preguntas.length > 0) };
}

/** Cuántas preguntas van en cada área (las que sobran, en las primeras). */
function reparto(pedido: PedidoDiagnostico): number[] {
  const n = pedido.areas || 1;
  const base = Math.floor(pedido.preguntas / n);
  return Array.from({ length: n }, (_, i) => base + (i < pedido.preguntas % n ? 1 : 0));
}

/**
 * Con Gemini, el esquema exige el número de áreas y de preguntas (si no, a
 * veces devuelve una sola por área). Claude no acepta esos límites en su
 * esquema: ahí lo piden las instrucciones y luego se completa lo que falte.
 */
function esquemaPara(pedido: PedidoDiagnostico) {
  if (proveedorIA() !== "gemini") return ESQUEMA_DIAGNOSTICO;
  const r = reparto(pedido);
  const dims = ESQUEMA_DIAGNOSTICO.properties.dimensiones;
  return {
    ...ESQUEMA_DIAGNOSTICO,
    properties: {
      ...ESQUEMA_DIAGNOSTICO.properties,
      dimensiones: {
        ...dims,
        minItems: r.length,
        maxItems: r.length,
        items: {
          ...dims.items,
          properties: {
            ...dims.items.properties,
            preguntas: { type: "array", items: PREGUNTA, minItems: Math.min(...r), maxItems: Math.max(...r) },
          },
        },
      },
    },
  };
}

export async function generarDiagnostico(id: string, pedido: PedidoDiagnostico, curso: ContextoCurso | null): Promise<Diagnostico> {
  const forma =
    pedido.areas === 0
      ? `Un solo puntaje: devuelve UNA sola área (dimensión) con nombre vacío y las ${pedido.preguntas} preguntas.`
      : `Exactamente ${pedido.areas} áreas (dimensiones) con nombre corto (máximo 3 palabras), y ${pedido.preguntas} preguntas en total repartidas parejo entre ellas.`;
  const crudo = await preguntar({
    sistema: REGLAS,
    mensaje: [
      `Qué quiere medir el coach: ${pedido.tema}`,
      pedido.para ? `Para quién es: ${pedido.para}` : "",
      contextoTexto(curso),
      forma,
      tipoTexto(pedido.tipo),
      `"titulo": un nombre atractivo y corto para el diagnóstico (máximo 8 palabras). "instrucciones": 1 o 2 frases para quien lo responde.`,
      pedido.indicaciones ? `Indicaciones del coach (síguelas si no contradicen las reglas): ${pedido.indicaciones}` : "",
      "Responde solo con el JSON del diagnóstico.",
    ]
      .filter(Boolean)
      .join("\n\n"),
    esquema: esquemaPara(pedido),
    tiempo: 100_000,
  });
  const d = ajustar(diagnosticoLimpio(id, leer(crudo)), pedido);
  if (d.dimensiones.length === 0) throw new ErrorDeDatos("La IA no pudo armar las preguntas. Inténtalo de nuevo.");
  return completar(d, pedido, curso);
}

/** Si la IA se quedó corta de preguntas en alguna área, le pide las que faltan (todas las áreas a la vez). */
async function completar(d: Diagnostico, pedido: PedidoDiagnostico, curso: ContextoCurso | null): Promise<Diagnostico> {
  const r = reparto(pedido);
  const faltan = d.dimensiones.map((dim, i) => Math.max(0, (r[i] ?? r[r.length - 1]) - preguntasDe(dim).length));
  if (faltan.every((n) => n === 0)) return d;
  const extras = await Promise.all(
    faltan.map((n, i) => (n > 0 ? sugerirPreguntas(d, i, n, pedido.tipo, curso).catch(() => []) : Promise.resolve([]))),
  );
  return {
    ...d,
    dimensiones: d.dimensiones.map((dim, i) => ({
      ...dim,
      preguntas: [...preguntasDe(dim), ...extras[i]].slice(0, LIMITES.preguntasPorArea),
    })),
  };
}

/** Preguntas nuevas para un área, sin repetir las que ya tiene. */
export async function sugerirPreguntas(
  d: Diagnostico,
  area: number,
  cantidad: number,
  tipo: TipoPreguntas,
  curso: ContextoCurso | null,
): Promise<PreguntaDiagnostico[]> {
  const dim = d.dimensiones[area];
  if (!dim) throw new ErrorDeDatos("No encontramos esa área.");
  const n = Math.min(Math.max(Math.round(cantidad) || 3, 1), 8);
  const actuales = preguntasDe(dim).filter((p) => p.texto);
  const crudo = await preguntar({
    sistema: REGLAS,
    mensaje: [
      `Diagnóstico: «${d.titulo || "sin título todavía"}».`,
      contextoTexto(curso),
      dim.nombre ? `Área: «${dim.nombre}»${dim.descripcion ? ` (${dim.descripcion})` : ""}.` : "Es un diagnóstico de un solo puntaje.",
      actuales.length
        ? `Preguntas que ya tiene (no las repitas ni digas lo mismo con otras palabras):\n${actuales.map((p, i) => `${i + 1}. ${p.texto}`).join("\n")}`
        : "Todavía no tiene preguntas.",
      `Propón ${n} preguntas nuevas. ${tipoTexto(tipo)}`,
      "Responde solo con el JSON.",
    ]
      .filter(Boolean)
      .join("\n\n"),
    esquema: ESQUEMA_PREGUNTAS,
    tiempo: 60_000,
  });
  const lista = (leer(crudo).preguntas as unknown[]) ?? [];
  const limpio = diagnosticoLimpio(d.id, { dimensiones: [{ preguntas: lista }] });
  return preguntasDe(limpio.dimensiones[0])
    .map((p) => (tipo === "escala" ? { texto: p.texto } : p))
    .filter((p) => p.texto && (!p.opciones || p.opciones.length >= 2))
    .slice(0, Math.min(n, LIMITES.preguntasPorArea - actuales.length));
}

export interface Revision {
  general: string;
  sugerencias: { area: string; numero: number; pregunta: string; problema: string; propuesta: string }[];
}

/** Revisa las preguntas que escribió el coach y le dice cómo mejorarlas (no cambia nada). */
export async function revisarPreguntas(d: Diagnostico): Promise<Revision> {
  const todas = d.dimensiones.flatMap((dim) => preguntasDe(dim).map((p) => ({ area: dim.nombre, p })));
  const conTexto = todas.filter((x) => x.p.texto);
  if (conTexto.length === 0) throw new ErrorDeDatos("Escribe al menos una pregunta para que la IA la revise.");
  const crudo = await preguntar({
    sistema: `${REGLAS}\n\nAhora eres tutora: revisas las preguntas que escribió un coach y le explicas, con amabilidad y en pocas palabras, cómo mejorarlas.`,
    mensaje: [
      `Diagnóstico: «${d.titulo || "sin título"}».`,
      `Preguntas (numeradas):\n${conTexto
        .map(
          (x, i) =>
            `${i + 1}. ${x.area ? `[${x.area}] ` : ""}${x.p.texto}${
              x.p.opciones ? ` — opciones: ${x.p.opciones.map((o) => `${o.texto} (${o.puntos} pts)`).join(" / ")}` : " — escala del 1 al 5"
            }`,
        )
        .join("\n")}`,
      `"general": 1 o 2 frases sobre el diagnóstico en conjunto (qué está bien y qué falta medir).
"sugerencias": solo para las preguntas que conviene mejorar (máximo 8): su número, el "problema" en una frase y la "propuesta" con la pregunta reescrita. Si una pregunta está bien, no la incluyas.`,
      "Responde solo con el JSON.",
    ].join("\n\n"),
    esquema: ESQUEMA_REVISION,
    tiempo: 60_000,
  });
  const datos = leer(crudo);
  const sugerencias = (Array.isArray(datos.sugerencias) ? datos.sugerencias : [])
    .slice(0, 8)
    .map((s) => {
      const x = (s ?? {}) as Record<string, unknown>;
      const numero = Math.round(Number(x.pregunta));
      const original = conTexto[numero - 1];
      return original
        ? {
            area: original.area,
            numero,
            pregunta: original.p.texto,
            problema: texto(x.problema, 300),
            propuesta: texto(x.propuesta, 300),
          }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x && !!x.propuesta);
  return { general: texto(datos.general, 500), sugerencias };
}
