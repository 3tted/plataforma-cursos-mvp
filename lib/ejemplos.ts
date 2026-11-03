import { promises as fs } from "fs";
import path from "path";
import type { Almacen } from "./almacen";
import { CUENTAS_DEMO, cuentaPorCorreo, nuevoIdCuenta } from "./cuentas";
import type { ComunidadCreada, CursoCreado, Empresa, PracticaLeccion, PreguntaCurso } from "./tipos";

// Empresas de ejemplo con su comunidad y su curso (data/ejemplos/*.json). Se
// siembran una sola vez en el almacén, como si su dueño las hubiera creado
// desde la plataforma: después se editan, se publican o se borran como
// cualquier otra, y no vuelven a aparecer. Su cuenta de demostración es la de
// CUENTAS_DEMO que lleva su empresa.

const DATOS = path.join(process.cwd(), "data");
const EJEMPLOS = ["increase"];

interface LeccionEjemplo {
  titulo: string;
  archivo: string;
  duracion_min: number;
  resumen: string;
  practica?: PracticaLeccion;
}

interface Ejemplo {
  empresa: Pick<Empresa, "id" | "nombre" | "dueno" | "color" | "logo" | "giro">;
  comunidad: Omit<ComunidadCreada, "autor" | "empresa" | "creadaEn">;
  curso: Pick<CursoCreado, "titulo" | "subtitulo" | "aprenderas" | "requisitos" | "preguntas_sugeridas" | "sinExamen"> & {
    modulos: { titulo: string; lecciones: LeccionEjemplo[] }[];
    examen: Omit<PreguntaCurso, "id">[];
  };
}

const siguiente = (a: Almacen) => a.siguienteId++;

/** Lee el ejemplo y el texto de sus lecciones antes de tocar el almacén: si falta un archivo, no queda a medias. */
async function leerEjemplo(nombre: string): Promise<{ e: Ejemplo; textos: Map<string, string> }> {
  const e = JSON.parse(await fs.readFile(path.join(DATOS, "ejemplos", `${nombre}.json`), "utf8")) as Ejemplo;
  const archivos = e.curso.modulos.flatMap((m) => m.lecciones.map((l) => l.archivo));
  const textos = await Promise.all(archivos.map((a) => fs.readFile(path.join(DATOS, a), "utf8")));
  return { e, textos: new Map(archivos.map((a, i) => [a, textos[i].trim()])) };
}

function sembrarEjemplo(a: Almacen, { e, textos }: { e: Ejemplo; textos: Map<string, string> }): void {
  const ahora = new Date().toISOString();
  const empresa = e.empresa.id;
  const autor = e.empresa.dueno;

  a.empresas ??= [];
  if (!a.empresas.some((x) => x.id === empresa)) a.empresas.push({ ...e.empresa, creadaEn: ahora, actualizadaEn: ahora });

  a.cuentas ??= [];
  for (const d of CUENTAS_DEMO.filter((x) => x.empresa === empresa)) {
    if (cuentaPorCorreo(a, d.correo)) continue;
    a.cuentas.push({
      id: nuevoIdCuenta(),
      correo: d.correo,
      nombre: d.nombre,
      rol: d.rol,
      empresa,
      rolEmpresa: d.rolEmpresa ?? "coach",
      demo: true,
      creadaEn: ahora,
    });
  }

  a.comunidadesCoach ??= [];
  if (a.comunidadesCoach.some((c) => c.id === e.comunidad.id)) return;
  a.comunidadesCoach.push({ ...e.comunidad, autor, empresa, creadaEn: ahora });

  const modulos = e.curso.modulos.map((m, i) => ({
    id: `M${i + 1}`,
    titulo: m.titulo,
    lecciones: m.lecciones.map((l) => ({
      id: `K${siguiente(a)}`,
      titulo: l.titulo,
      duracion_min: l.duracion_min,
      // El diagnóstico es la puerta de entrada: todo el curso es gratis.
      gratis: true,
      resumen: l.resumen,
      contenido: textos.get(l.archivo) ?? "",
      transcripcion: "",
      preguntas_sugeridas: [],
      repaso: [],
      ...(l.practica ? { practica: l.practica } : {}),
    })),
  }));
  a.cursosCoach ??= [];
  a.cursosCoach.push({
    id: `c${siguiente(a)}`,
    comunidad: e.comunidad.id,
    estado: "publicado",
    origen: "manual",
    titulo: e.curso.titulo,
    subtitulo: e.curso.subtitulo,
    aprenderas: e.curso.aprenderas,
    requisitos: e.curso.requisitos,
    preguntas_sugeridas: e.curso.preguntas_sugeridas,
    modulos,
    examen: e.curso.examen.map((p) => ({ ...p, id: `KF${siguiente(a)}` })),
    ...(e.curso.sinExamen ? { sinExamen: true } : {}),
    autor,
    empresa,
    creadoEn: ahora,
    actualizadoEn: ahora,
  });
}

/**
 * Las prácticas llegaron después de sembrar INCREASE: en los almacenes que ya
 * la tenían se activan una sola vez en sus lecciones (por título), sin tocar
 * las que su dueño ya cambió.
 */
function sumarPracticas(a: Almacen, { e }: { e: Ejemplo }): void {
  const curso = cursoDelEjemplo(a, e);
  if (!curso) return;
  const porTitulo = new Map(e.curso.modulos.flatMap((m) => m.lecciones).map((l) => [l.titulo, l.practica]));
  for (const l of curso.modulos.flatMap((m) => m.lecciones)) {
    const practica = porTitulo.get(l.titulo);
    if (practica && !l.practica) l.practica = practica;
  }
}

/** La invitación a pedir la sesión «en la comunidad» pasó a ser los botones de agenda (WhatsApp o liga). */
const INVITACION_ANTERIOR = "Para pedir tu sesión, publícalo en la comunidad, en la categoría Dudas, con tu dimensión más baja.";

function sumarAgenda(a: Almacen, { e }: { e: Ejemplo }): void {
  for (const l of cursoDelEjemplo(a, e)?.modulos.flatMap((m) => m.lecciones) ?? []) {
    if (l.contenido.includes(INVITACION_ANTERIOR)) l.contenido = l.contenido.replace(INVITACION_ANTERIOR, "<!-- agendar -->");
  }
}

/**
 * El plan de 7 días pasó de texto a una lista por días (<!-- plan:… -->): si la
 * lección sigue con el texto de antes, se cambia por el nuevo, y su práctica
 * (si nadie la cambió) pasa a pedir el plan de 30 días.
 */
const PRACTICA_PLAN_ANTERIOR =
  "Registra la evidencia de avance de cada día: qué hiciste y qué cambió. Si te sirve, sube una foto o un documento con tu plan de 30 días.";

function sumarPlan(a: Almacen, { e, textos }: { e: Ejemplo; textos: Map<string, string> }): void {
  const curso = cursoDelEjemplo(a, e);
  const fuente = e.curso.modulos.flatMap((m) => m.lecciones).find((l) => l.archivo.endsWith("05-plan.md"));
  const leccion = curso?.modulos.flatMap((m) => m.lecciones).find((l) => l.titulo === fuente?.titulo);
  if (!fuente || !leccion) return;
  if (leccion.contenido.includes("## Día 1 · Haz visible la brecha") && !leccion.contenido.includes("<!-- plan:")) {
    leccion.contenido = textos.get(fuente.archivo) ?? leccion.contenido;
  }
  if (leccion.practica?.instrucciones === PRACTICA_PLAN_ANTERIOR && fuente.practica) leccion.practica = fuente.practica;
}

/** El Radar es un diagnóstico: el curso queda sin examen final (sus preguntas se guardan). */
function quitarExamen(a: Almacen, { e }: { e: Ejemplo }): void {
  const curso = cursoDelEjemplo(a, e);
  if (curso && e.curso.sinExamen && curso.sinExamen === undefined) curso.sinExamen = true;
}

const cursoDelEjemplo = (a: Almacen, e: Ejemplo) =>
  (a.cursosCoach ?? []).find((c) => c.empresa === e.empresa.id && c.comunidad === e.comunidad.id && c.titulo === e.curso.titulo);

/**
 * Cambios que llegaron después de sembrar un ejemplo. Se aplican una sola vez
 * en los almacenes que ya lo tenían ("increase:practicas"…); uno recién
 * sembrado ya los trae.
 */
const ACTUALIZACIONES: { id: string; aplicar: (a: Almacen, ejemplo: { e: Ejemplo; textos: Map<string, string> }) => void }[] = [
  { id: "practicas", aplicar: sumarPracticas },
  { id: "agenda", aplicar: sumarAgenda },
  { id: "plan", aplicar: sumarPlan },
  { id: "sin-examen", aplicar: quitarExamen },
];

/**
 * Siembra las empresas de ejemplo que este almacén todavía no tiene y aplica
 * sus actualizaciones pendientes. Devuelve si cambió algo. Si sus archivos no
 * están a la mano (una ruta que no lleva /data en el despliegue), lo deja para
 * la siguiente lectura en vez de fallar.
 */
export async function sumarEjemplos(a: Almacen): Promise<boolean> {
  const sembrados = new Set(a.ejemplos ?? []);
  const claves = (nombre: string) => [nombre, ...ACTUALIZACIONES.map((x) => `${nombre}:${x.id}`)];
  const pendientes = EJEMPLOS.filter((x) => claves(x).some((c) => !sembrados.has(c)));
  if (pendientes.length === 0) return false;
  let cambiado = false;
  for (const nombre of pendientes) {
    const ejemplo = await leerEjemplo(nombre).catch(() => null);
    if (!ejemplo) continue;
    if (!sembrados.has(nombre)) sembrarEjemplo(a, ejemplo);
    else for (const x of ACTUALIZACIONES) if (!sembrados.has(`${nombre}:${x.id}`)) x.aplicar(a, ejemplo);
    for (const c of claves(nombre)) sembrados.add(c);
    cambiado = true;
  }
  a.ejemplos = [...sembrados];
  return cambiado;
}
