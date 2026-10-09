import { nuevoId, type Almacen } from "./almacen";
import { COMUNIDADES, TEMAS } from "./comunidades";
import { ErrorDeDatos } from "./http";
import type { ComunidadCreada, CursoCreado, LeccionCreada, ModuloCreado, PreguntaCurso } from "./tipos";

// Comunidades y cursos que crea la coach desde la plataforma. El borrador se
// guarda aunque esté incompleto; al publicar se revisa que el alumno pueda
// tomarlo completo (lecciones con contenido, preguntas bien formadas).

// Límites para que un curso quepa holgado en el almacén (Redis guarda todo en un documento).
const MAX_MODULOS = 8;
const MAX_LECCIONES = 30;
const MAX_TEXTO_LECCION = 20_000;
const MAX_PREGUNTAS = 30;

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const lista = (v: unknown, max: number, largo: number) =>
  (Array.isArray(v) ? v : [])
    .map((x) => texto(x, largo))
    .filter(Boolean)
    .slice(0, max);

function slug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/** Valida los datos de una comunidad nueva y la arma. */
export function nuevaComunidad(a: Almacen, autor: string, datos: Record<string, unknown>): ComunidadCreada {
  const nombre = texto(datos.nombre, 60);
  if (nombre.length < 3) throw new ErrorDeDatos("Ponle un nombre a tu comunidad (al menos 3 letras).");
  const descripcion = texto(datos.descripcion, 240);
  if (descripcion.length < 10) throw new ErrorDeDatos("Escribe una descripción corta: para quién es tu comunidad.");
  const tema = TEMAS.includes(String(datos.tema)) ? String(datos.tema) : "Otro";
  const precio = Math.round(Number(datos.precio_mensual));
  if (!Number.isFinite(precio) || precio < 50 || precio > 5000) {
    throw new ErrorDeDatos("El precio de la membresía debe ser entre $50 y $5,000 al mes.");
  }
  const base = slug(nombre) || "comunidad";
  const usados = new Set([...COMUNIDADES.map((c) => c.id), ...(a.comunidadesCoach ?? []).map((c) => c.id)]);
  let id = base;
  for (let n = 2; usados.has(id); n++) id = `${base}-${n}`;
  return {
    id,
    nombre,
    coach: autor,
    coach_titulo: texto(datos.coach_titulo, 80) || "Coach",
    descripcion,
    tema,
    precio_mensual: precio,
    moneda: "MXN",
    autor,
    creadaEn: new Date().toISOString(),
  };
}

/** Un borrador nuevo con un módulo y una lección vacíos, listo para editar. Puede nacer sin comunidad (""). */
export function nuevoCurso(a: Almacen, autor: string, comunidad: string, origen: CursoCreado["origen"] = "manual"): CursoCreado {
  const ahora = new Date().toISOString();
  return {
    id: `c${nuevoId(a)}`,
    comunidad,
    estado: "borrador",
    origen,
    titulo: "",
    subtitulo: "",
    aprenderas: [],
    requisitos: "",
    preguntas_sugeridas: [],
    modulos: [{ id: "M1", titulo: "", lecciones: [leccionVacia(a)] }],
    examen: [],
    autor,
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
}

function leccionVacia(a: Almacen): LeccionCreada {
  return {
    id: `K${nuevoId(a)}`,
    titulo: "",
    duracion_min: 5,
    gratis: false,
    resumen: "",
    contenido: "",
    transcripcion: "",
    preguntas_sugeridas: [],
    repaso: [],
  };
}

function pregunta(a: Almacen, v: unknown, prefijo: string, ids: Map<string, string>): PreguntaCurso {
  const p = (v ?? {}) as Record<string, unknown>;
  const opciones = (Array.isArray(p.opciones) ? p.opciones : []).slice(0, 6).map((o) => texto(o, 200));
  const correcta = Number.isInteger(p.correcta) ? Math.min(Math.max(Number(p.correcta), 0), Math.max(opciones.length - 1, 0)) : 0;
  const id = typeof p.id === "string" && new RegExp(`^${prefijo}\\d+$`).test(p.id) ? p.id : `${prefijo}${nuevoId(a)}`;
  const leccion = typeof p.leccion === "string" ? (ids.get(p.leccion) ?? p.leccion) : undefined;
  return {
    id,
    enunciado: texto(p.enunciado, 400),
    opciones,
    correcta,
    ...(texto(p.explicacion, 600) ? { explicacion: texto(p.explicacion, 600) } : {}),
    ...(leccion ? { leccion } : {}),
  };
}

/**
 * Guarda lo que manda el editor sobre el borrador actual. Las lecciones nuevas
 * (sin id K…) reciben su id aquí; las preguntas del examen que apuntaban a una
 * lección nueva se actualizan con su id definitivo.
 */
export function aplicarEdicion(a: Almacen, actual: CursoCreado, entrada: Record<string, unknown>): CursoCreado {
  const ids = new Map<string, string>(); // id del editor → id guardado
  const existentes = new Set(actual.modulos.flatMap((m) => m.lecciones.map((l) => l.id)));

  const modulosEntrada = (Array.isArray(entrada.modulos) ? entrada.modulos : []).slice(0, MAX_MODULOS);
  let totalLecciones = 0;
  const modulos: ModuloCreado[] = modulosEntrada.map((mv, i) => {
    const m = (mv ?? {}) as Record<string, unknown>;
    const lecciones = (Array.isArray(m.lecciones) ? m.lecciones : [])
      .slice(0, Math.max(0, MAX_LECCIONES - totalLecciones))
      .map((lv) => {
        const l = (lv ?? {}) as Record<string, unknown>;
        const pedido = typeof l.id === "string" ? l.id : "";
        const id = /^K\d+$/.test(pedido) && existentes.has(pedido) ? pedido : `K${nuevoId(a)}`;
        if (pedido) ids.set(pedido, id);
        return { l, id };
      });
    totalLecciones += lecciones.length;
    return {
      id: `M${i + 1}`,
      titulo: texto(m.titulo, 120),
      lecciones: lecciones.map(({ l, id }) => ({
        id,
        titulo: texto(l.titulo, 140),
        duracion_min: Math.min(Math.max(Math.round(Number(l.duracion_min)) || 5, 1), 240),
        gratis: l.gratis === true,
        resumen: texto(l.resumen, 300),
        contenido: texto(l.contenido, MAX_TEXTO_LECCION),
        transcripcion: texto(l.transcripcion, MAX_TEXTO_LECCION),
        preguntas_sugeridas: lista(l.preguntas_sugeridas, 4, 200),
        repaso: (Array.isArray(l.repaso) ? l.repaso : []).slice(0, 5).map((p) => pregunta(a, p, "KR", ids)),
      })),
    };
  });

  return {
    ...actual,
    titulo: texto(entrada.titulo, 120),
    subtitulo: texto(entrada.subtitulo, 240),
    aprenderas: lista(entrada.aprenderas, 8, 160),
    requisitos: texto(entrada.requisitos, 300),
    preguntas_sugeridas: lista(entrada.preguntas_sugeridas, 4, 200),
    modulos,
    examen: (Array.isArray(entrada.examen) ? entrada.examen : []).slice(0, MAX_PREGUNTAS).map((p) => pregunta(a, p, "KF", ids)),
    actualizadoEn: new Date().toISOString(),
  };
}

/** Lo que falta para que el curso se pueda publicar (vacío: listo). */
export function pendientesParaPublicar(c: CursoCreado): string[] {
  const faltan: string[] = [];
  if (!c.comunidad) faltan.push("Elige en qué comunidad va el curso (arriba, en «Comunidad»).");
  if (!c.titulo) faltan.push("El curso necesita un título.");
  const lecciones = c.modulos.flatMap((m) => m.lecciones);
  if (lecciones.length === 0) faltan.push("Agrega al menos una lección.");
  c.modulos.forEach((m, i) => {
    if (!m.titulo) faltan.push(`El módulo ${i + 1} necesita un título.`);
    if (m.lecciones.length === 0) faltan.push(`El módulo ${i + 1} no tiene lecciones.`);
  });
  const ids = new Set(lecciones.map((l) => l.id));
  lecciones.forEach((l, i) => {
    const nombre = l.titulo ? `«${l.titulo}»` : `La lección ${i + 1}`;
    if (!l.titulo) faltan.push(`La lección ${i + 1} necesita un título.`);
    if (l.contenido.length < 40) faltan.push(`${nombre} necesita su texto (al menos un párrafo).`);
    l.repaso.forEach((p, j) => {
      const problema = problemaDePregunta(p);
      if (problema) faltan.push(`Repaso de ${nombre}, pregunta ${j + 1}: ${problema}`);
    });
  });
  if (c.examen.length === 0) faltan.push("El examen final necesita al menos una pregunta.");
  c.examen.forEach((p, j) => {
    const problema = problemaDePregunta(p);
    if (problema) faltan.push(`Examen final, pregunta ${j + 1}: ${problema}`);
    else if (p.leccion && !ids.has(p.leccion)) faltan.push(`Examen final, pregunta ${j + 1}: la lección elegida ya no existe.`);
  });
  return faltan;
}

function problemaDePregunta(p: PreguntaCurso): string | null {
  if (!p.enunciado) return "falta escribir la pregunta.";
  const llenas = p.opciones.filter(Boolean);
  if (llenas.length < 2) return "necesita al menos dos opciones.";
  if (llenas.length !== p.opciones.length) return "hay opciones vacías.";
  if (!p.opciones[p.correcta]) return "marca cuál es la respuesta correcta.";
  return null;
}
