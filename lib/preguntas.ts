import type { PreguntaIA } from "./tipos";

// Agrupa las preguntas al asistente para la coach (panel e inicio).

export interface GrupoPregunta {
  clave: string;
  pregunta: string;
  veces: number;
  personas: number;
  citas: string[];
  ultima: PreguntaIA;
}

// Saludos y pruebas sueltas ("hola", "ok", "test") no son dudas del curso.
const SIN_CONTENIDO = new Set(
  "hola holi buenas buenos buen dia dias tardes noches gracias ok oye saludos test prueba probando hey".split(" "),
);

// Junta las preguntas iguales (sin importar mayúsculas, acentos ni signos) para
// que la coach vea qué se repite, y descarta entradas sin contenido.
export function agrupar(preguntas: PreguntaIA[]): GrupoPregunta[] {
  const grupos = new Map<string, { lista: PreguntaIA[] }>();
  for (const q of preguntas) {
    const clave = q.pregunta
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9ñ ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (clave.replace(/[^a-z]/g, "").length < 4) continue;
    if (clave.split(" ").every((p) => p.length < 3 || SIN_CONTENIDO.has(p))) continue;
    const grupo = grupos.get(clave) ?? { lista: [] };
    grupo.lista.push(q);
    grupos.set(clave, grupo);
  }
  return [...grupos.entries()]
    .map(([clave, { lista }]) => ({
      clave,
      pregunta: lista[0].pregunta,
      veces: lista.length,
      personas: new Set(lista.map((q) => q.autor)).size,
      citas: [...new Set(lista.flatMap((q) => q.citas))],
      ultima: lista[0],
    }))
    .sort((a, b) => b.veces - a.veces || b.ultima.creadaEn.localeCompare(a.ultima.creadaEn));
}

/** Preguntas que el curso no cubre: el asistente no pudo citar ninguna lección. */
export function sinResolver(grupos: GrupoPregunta[]): GrupoPregunta[] {
  return grupos.filter((g) => g.citas.length === 0);
}
