import Anthropic from "@anthropic-ai/sdk";
import { todasLasLecciones } from "./curso";
import type { DatosCurso, TurnoChat } from "./tipos";

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

export const MODELO = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

type Esfuerzo = "low" | "medium" | "high";
const ESFUERZO: Esfuerzo = (["low", "medium", "high"] as const).includes(
  process.env.ANTHROPIC_EFFORT as Esfuerzo,
)
  ? (process.env.ANTHROPIC_EFFORT as Esfuerzo)
  : "low";

// Si el modelo principal declina una pregunta por sus filtros de seguridad,
// la API la reintenta con el modelo de respaldo recomendado.
const MODELOS_CON_RESPALDO = new Set(["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1"]);

// El asistente puede redactar con Claude (de pago) o con Gemini (tiene un plan
// gratuito con límites). IA_PROVEEDOR elige uno a mano; si no se define, se usa
// el primero que tenga clave. Sin ninguna clave queda el modo demostración.
export type ProveedorIA = "claude" | "gemini";

const claveClaude = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const claveGemini = () => Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

export const MODELO_GEMINI = process.env.GEMINI_MODEL || "gemini-flash-latest";

export function proveedorIA(): ProveedorIA | null {
  const elegido = process.env.IA_PROVEEDOR?.trim().toLowerCase();
  if (elegido === "demo") return null;
  if (elegido === "claude") return claveClaude() ? "claude" : null;
  if (elegido === "gemini") return claveGemini() ? "gemini" : null;
  if (claveClaude()) return "claude";
  if (claveGemini()) return "gemini";
  return null;
}

export function iaDisponible(): boolean {
  return proveedorIA() !== null;
}

export function modeloActivo(): string | null {
  const proveedor = proveedorIA();
  return proveedor === "claude" ? MODELO : proveedor === "gemini" ? MODELO_GEMINI : null;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

// Quien no es miembro solo recibe el resumen de las lecciones de pago: el
// asistente puede decir dónde está la respuesta, pero no entregarla.
function contenidoDelCurso({ curso }: DatosCurso, miembro: boolean): string {
  return todasLasLecciones(curso)
    .map((l) => {
      if (!miembro && !l.gratis) {
        return `<leccion id="${l.id}" acceso="miembros">\n[${l.id}] ${l.modulo.titulo} — ${l.titulo}\nResumen: ${l.resumen}\n</leccion>`;
      }
      const partes = [
        `[${l.id}] ${l.modulo.titulo} — ${l.titulo}`,
        l.contenido,
        l.transcripcion ? `Transcripción del video:\n${l.transcripcion}` : "",
      ];
      return `<leccion id="${l.id}">\n${partes.filter(Boolean).join("\n\n")}\n</leccion>`;
    })
    .join("\n\n");
}

const REGLA_NO_MIEMBRO = `
- Este alumno todavía no es miembro. Las lecciones con acceso="miembros" solo traen su resumen. Si la respuesta está en una de ellas, no la expliques ni des sus pasos, cálculos o fórmulas: di en qué lección se explica, cítala con su identificador, cuenta en una frase de qué trata y comenta que con la membresía puedes responderle con esa lección completa. Todo lo que esté en las lecciones abiertas respóndelo con normalidad.`;

export function instrucciones({ comunidad, curso }: DatosCurso, miembro: boolean): string {
  return `Eres el asistente del curso "${curso.titulo}", de la comunidad ${comunidad.nombre}, creado por ${comunidad.coach} (${comunidad.coach_titulo}). Resuelves las dudas de los alumnos sobre el contenido del curso, que aparece completo más abajo dentro de <curso>.

Cómo responder:
- Escribe en español de México, con un tono cercano y claro, como un buen tutor. Trata al alumno de "tú".
- Básate en el contenido del curso. Puedes hacer cálculos con los datos que te dé el alumno aplicando los métodos y fórmulas de las lecciones; muestra la operación.
- Cita la lección de donde sale cada idea con su identificador entre corchetes, por ejemplo [L4] o [L5, L6]. Usa solo identificadores que existan en el curso.
- Si el curso no cubre la pregunta, dilo claramente y sin inventar, y sugiere publicarla en la comunidad para que ${comunidad.coach} la responda. Si das una orientación general, aclara que no viene del curso.
- En temas fiscales o legales que dependan del caso particular del alumno, recomienda confirmarlo con su contador.
- Sé breve: de uno a tres párrafos cortos, o una lista corta. Usa **negritas** para lo más importante. No uses tablas ni encabezados.${miembro ? "" : REGLA_NO_MIEMBRO}

<curso>
${contenidoDelCurso({ comunidad, curso }, miembro)}
</curso>`;
}

// Asistente general (el de "Asistente" en el menú): no conoce los cursos ni
// cita lecciones. Las dudas de un curso las responde el asistente del curso.
export const INSTRUCCIONES_GENERALES = `Eres el Asistente Merkatics, un asistente de IA de uso general dentro de la plataforma de cursos y comunidades de Merkatics. Ayudas a alumnos y coaches con lo que necesiten: ideas para su negocio, redactar mensajes o publicaciones, explicar un tema, organizar su trabajo o resolver dudas generales.

Cómo responder:
- Escribe en español de México, con un tono cercano y claro. Trata a la persona de "tú".
- No tienes acceso al contenido de los cursos. Si te preguntan por un curso, una lección o lo que dijo una coach, explica que para eso está el asistente del curso (en cada lección y en la comunidad), que responde con las lecciones y las cita.
- No inventes datos de la plataforma, como precios, coaches, fechas o políticas.
- En temas fiscales, legales, médicos o financieros que dependan del caso de la persona, da una orientación general y recomienda confirmarlo con un profesional.
- Sé breve y útil: de uno a tres párrafos cortos, o una lista corta. Usa **negritas** para lo más importante. No uses tablas ni encabezados.`;

// La pregunta del alumno, con la lección que está viendo si viene de una.
export function preguntaConContexto(datos: DatosCurso, pregunta: string, leccionActual: string | null): string {
  const leccion = leccionActual
    ? todasLasLecciones(datos.curso).find((l) => l.id === leccionActual)
    : undefined;
  const contexto = leccion
    ? `(El alumno está viendo la lección [${leccion.id}] "${leccion.titulo}".)\n\n`
    : "";
  return contexto + pregunta;
}

function mensajes(
  datos: DatosCurso,
  pregunta: string,
  historial: TurnoChat[],
  leccionActual: string | null,
): Anthropic.Beta.BetaMessageParam[] {
  return [...historial, { role: "user", content: preguntaConContexto(datos, pregunta, leccionActual) }];
}

// ---------------------------------------------------------------------------
// Respuesta con Claude (en streaming)
// ---------------------------------------------------------------------------

let cliente: Anthropic | null = null;

function streamDeClaude(sistema: string, messages: Anthropic.Beta.BetaMessageParam[]) {
  cliente ??= new Anthropic();
  const conRespaldo = MODELOS_CON_RESPALDO.has(MODELO);
  return cliente.beta.messages.stream({
    model: MODELO,
    max_tokens: 16000,
    // El curso va en el prompt de sistema con caché: las preguntas siguientes
    // reutilizan ese prefijo y cuestan mucho menos.
    system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
    messages,
    output_config: { effort: ESFUERZO },
    ...(conRespaldo
      ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
      : {}),
  });
}

export function responderConClaude(
  datos: DatosCurso,
  pregunta: string,
  historial: TurnoChat[],
  leccionActual: string | null,
  miembro: boolean,
) {
  return streamDeClaude(instrucciones(datos, miembro), mensajes(datos, pregunta, historial, leccionActual));
}

export function responderGeneralConClaude(pregunta: string, historial: TurnoChat[]) {
  return streamDeClaude(INSTRUCCIONES_GENERALES, [...historial, { role: "user", content: pregunta }]);
}

export function mensajeDeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return "La clave de la API no es válida. Revisa ANTHROPIC_API_KEY en tu archivo .env.local.";
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return "La clave de la API no tiene permiso para usar este modelo.";
  }
  if (error instanceof Anthropic.NotFoundError) {
    return `El modelo "${MODELO}" no está disponible para esta cuenta. Revisa ANTHROPIC_MODEL.`;
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "El asistente recibió demasiadas preguntas seguidas. Espera un minuto e inténtalo de nuevo.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "No se pudo conectar con el servicio de IA. Revisa tu conexión a internet.";
  }
  if (error instanceof Anthropic.APIError) {
    return "El servicio de IA tuvo un problema. Inténtalo de nuevo en unos momentos.";
  }
  return "Ocurrió un error inesperado al generar la respuesta.";
}

// ---------------------------------------------------------------------------
// Modo demostración (sin clave de API): búsqueda por palabras clave
// ---------------------------------------------------------------------------

const PALABRAS_VACIAS = new Set(
  (
    "que para por con como cual cuales cuando donde quien una uno unos unas los las del " +
    "al lo le les se su sus mis tus mas pero porque esta este esto estos estas ese esa eso " +
    "hay muy ser son era fue sin sobre entre tiene tengo tienes hace hacer puedo puede " +
    "debo debe deberia quiero necesito cuanto cuanta cuantos cuantas mucho poco todo toda " +
    "todos todas otro otra ya tambien solo asi aqui mi tu yo me te nos el la en de es y o a " +
    // Saludos y muletillas: no deben hacer que el asistente cite una lección.
    "hola buenas buenos dias tardes noches gracias saludos oye porfa favor dime ayuda ayudame " +
    "pregunta duda dudas algo alguien"
  ).split(" "),
);

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Raíz muy simple: las primeras 4 letras bastan para juntar "costo" y
// "costos", "calculo" y "calcular", o "pagarme" y "págate".
function raices(texto: string): string[] {
  return (normalizar(texto).match(/[a-z0-9]+/g) ?? [])
    .filter((p) => p.length > 2 && !PALABRAS_VACIAS.has(p))
    .map((p) => (p.length > 4 ? p.slice(0, 4) : p));
}

interface Fragmento {
  leccion: string;
  texto: string;
  raices: Map<string, number>;
  palabras: number;
  raicesTitulo: Set<string>;
  sugeridas: string[];
}

function contar(texto: string): Map<string, number> {
  const conteo = new Map<string, number>();
  for (const r of raices(texto)) conteo.set(r, (conteo.get(r) ?? 0) + 1);
  return conteo;
}

// Convierte un bloque de la lección en texto para citar: los párrafos se unen
// en una línea y cada elemento de lista conserva su propio renglón, para que
// las operaciones ("$350 − $150 = $200") no salgan corridas.
function limpiar(bloque: string): string {
  const salida: string[] = [];
  const lineas = bloque
    .replace(/^#+\s*(.+)$/gm, "**$1.**")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (const linea of lineas) {
    const esVineta = /^(?:[-*]|\d+\.)\s+/.test(linea);
    const texto = linea.replace(/^(?:[-*]|\d+\.)\s+/, "");
    const ultima = salida.at(-1);
    if (esVineta || ultima === undefined || /\*\*$/.test(ultima)) salida.push(esVineta ? `• ${texto}` : texto);
    else salida[salida.length - 1] = `${ultima} ${texto}`;
  }
  return salida.join("\n");
}

function fragmentos({ curso }: DatosCurso): Fragmento[] {
  const lista: Fragmento[] = [];
  for (const leccion of todasLasLecciones(curso)) {
    const raicesTitulo = new Set(raices(leccion.titulo));
    const sugeridas = leccion.preguntas_sugeridas.map(normalizar);
    const agregar = (texto: string) =>
      lista.push({
        leccion: leccion.id,
        texto,
        raices: contar(texto),
        palabras: texto.split(/\s+/).length,
        raicesTitulo,
        sugeridas,
      });
    // Cada encabezado se une con el párrafo que le sigue. Los ejercicios se
    // omiten: son tareas para el alumno, no respuestas.
    const bloques = leccion.contenido.split(/\n\s*\n/);
    for (let i = 0; i < bloques.length; i++) {
      let bloque = bloques[i];
      const esEncabezado = /^#+\s/.test(bloque.trim());
      if (esEncabezado && i + 1 < bloques.length) bloque += "\n" + bloques[++i];
      // Una frase que presenta una lista ("tienes cuatro palancas:") viaja con su lista.
      while (/:\s*$/.test(bloque) && i + 1 < bloques.length && /^\s*(?:[-*]|\d+\.)\s/.test(bloques[i + 1])) {
        bloque += "\n" + bloques[++i];
      }
      if (esEncabezado && /^#+\s*ejercicio/i.test(bloque.trim())) continue;
      const texto = limpiar(bloque);
      if (texto.length > 40) agregar(texto);
    }
    if (leccion.transcripcion) agregar(limpiar(leccion.transcripcion));
  }
  return lista;
}

// Recorta por renglones. Una lista entra completa con la frase que la
// presenta: cortar justo después de "tienes cuatro palancas:" deja la
// respuesta a medias.
function recortar(texto: string, maximo = 420): string {
  if (texto.length <= maximo) return texto;
  const lineas = texto.split("\n");
  const salida: string[] = [];
  let largo = 0;
  for (const linea of lineas) {
    const limite = linea.startsWith("• ") && salida.length > 0 ? maximo * 2 : maximo;
    if (largo + linea.length > limite) break;
    salida.push(linea);
    largo += linea.length + 1;
  }
  if (salida.length === 0) {
    const corte = lineas[0].lastIndexOf(". ", maximo);
    return lineas[0].slice(0, corte > 120 ? corte + 1 : maximo).trim() + " …";
  }
  while (salida.length > 1 && salida[salida.length - 1].trim().endsWith(":")) salida.pop();
  const resultado = salida.join("\n");
  return resultado.length < texto.length ? `${resultado} …` : resultado;
}

function citar(f: Fragmento): string {
  return `${recortar(f.texto)} [${f.leccion}]`
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
}

export function responderEnModoDemo(
  datos: DatosCurso,
  pregunta: string,
  leccionActual: string | null,
  miembro: boolean,
): string {
  const consulta = [...new Set(raices(pregunta))];
  const preguntaNormal = normalizar(pregunta.trim());
  // Con varias palabras de contenido, un fragmento debe coincidir en al menos dos.
  const minimoCoincidencias = consulta.length >= 3 ? 2 : 1;
  const todos = fragmentos(datos);
  const frecuencia = new Map<string, number>();
  for (const f of todos) for (const r of f.raices.keys()) frecuencia.set(r, (frecuencia.get(r) ?? 0) + 1);
  const promedioPalabras = todos.reduce((s, f) => s + f.palabras, 0) / Math.max(1, todos.length);

  const puntuados = todos
    .map((f) => {
      let puntos = 0;
      let coincidencias = 0;
      for (const r of consulta) {
        const idf = Math.log(1 + todos.length / (frecuencia.get(r) ?? 1));
        const veces = f.raices.get(r) ?? 0;
        if (!veces) continue;
        coincidencias++;
        puntos += idf * Math.min(2, 1 + 0.25 * (veces - 1));
        // Si la palabra también está en el título de la lección, esa lección
        // probablemente es la que responde.
        if (f.raicesTitulo.has(r)) puntos += idf * 0.5;
      }
      if (coincidencias < minimoCoincidencias) return { f, puntos: 0 };
      // Los fragmentos largos acumulan coincidencias por azar: se normalizan.
      puntos /= 0.6 + 0.4 * (f.palabras / promedioPalabras);
      if (f.leccion === leccionActual) puntos *= 1.25;
      // Las preguntas sugeridas de una lección apuntan a esa lección.
      if (f.sugeridas.includes(preguntaNormal)) puntos *= 1.6;
      return { f, puntos };
    })
    .filter((x) => x.puntos >= 2)
    .sort((a, b) => b.puntos - a.puntos);

  const aviso = "**Modo demostración:** estos son los fragmentos del curso que responden tu pregunta.";

  if (consulta.length === 0 || puntuados.length === 0) {
    return `**Modo demostración:** no encontré esto en el curso. Puedes llevar tu pregunta a la comunidad para que ${datos.comunidad.coach} la responda.`;
  }

  // Quien no es miembro no recibe texto de las lecciones de pago: se le dice
  // en cuál está la respuesta y de qué trata (el mismo resumen del índice).
  const lecciones = todasLasLecciones(datos.curso);
  const abierta = (id: string) => miembro || lecciones.find((l) => l.id === id)?.gratis !== false;
  const abiertos = puntuados.filter((x) => abierta(x.f.leccion));
  const cerrados = puntuados.filter((x) => !abierta(x.f.leccion));

  if (cerrados.length && (!abiertos.length || cerrados[0].puntos > abiertos[0].puntos)) {
    const leccion = lecciones.find((l) => l.id === cerrados[0].f.leccion)!;
    const partes = [
      `**Esto se explica en una lección para miembros:** [${leccion.id}]`,
      `De qué trata: ${leccion.resumen}`,
      "Con la membresía, el asistente te responde con esa lección completa.",
    ];
    if (abiertos.length && abiertos[0].puntos >= cerrados[0].puntos * 0.5) {
      partes.push(`Mientras tanto, esto dice una lección gratis:\n\n${citar(abiertos[0].f)}`);
    }
    return partes.join("\n\n");
  }

  const elegidos: Fragmento[] = [];
  for (const { f } of abiertos) {
    if (elegidos.some((e) => e.texto === f.texto)) continue;
    elegidos.push(f);
    if (elegidos.length === 2) break;
  }
  // Solo se mencionan las lecciones de pago que de verdad tratan el tema.
  const umbral = (abiertos[0]?.puntos ?? 0) * 0.6;
  const tambien = [...new Set(cerrados.filter((x) => x.puntos >= umbral).map((x) => x.f.leccion))].slice(0, 2);
  const extra = tambien.length
    ? `\n\nTambién se habla de esto en ${tambien.map((id) => `[${id}]`).join(" ")}, para miembros.`
    : "";
  return `${aviso}\n\n${elegidos.map(citar).join("\n\n")}${extra}`;
}
