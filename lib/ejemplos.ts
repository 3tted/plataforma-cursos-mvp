import { promises as fs } from "fs";
import path from "path";
import type { Almacen } from "./almacen";
import { cifrarContrasena, cuentaPorCorreo, nuevoIdCuenta } from "./cuentas";
import type { ComunidadCreada, CursoCreado, Empresa, PracticaLeccion, PreguntaCurso } from "./tipos";

// Empresas de ejemplo con su comunidad y su curso (data/ejemplos/*.json). Se
// siembran una sola vez en el almacén, como si su dueño las hubiera creado
// desde la plataforma: después se editan, se publican o se borran como
// cualquier otra, y no vuelven a aparecer. La cuenta de su dueño viene en el
// ejemplo, con su propia contraseña.

const DATOS = path.join(process.cwd(), "data");
const EJEMPLOS = ["increase"];

interface LeccionEjemplo {
  titulo: string;
  archivo: string;
  duracion_min: number;
  resumen: string;
  practica?: PracticaLeccion;
  abreAlDiaSiguiente?: boolean;
  /** Título que tenía antes en el curso ya publicado (al reorganizarlo conserva su id y lo de sus alumnos). */
  antes?: string;
}

interface Ejemplo {
  empresa: Pick<Empresa, "id" | "nombre" | "dueno" | "color" | "logo" | "giro">;
  /** La cuenta de su dueño. `antes`: el correo que tenía (para cambiarla en los almacenes que ya la tienen). */
  cuenta: { nombre: string; correo: string; contrasena: string; antes?: string };
  comunidad: Omit<ComunidadCreada, "autor" | "empresa" | "creadaEn">;
  curso: Pick<CursoCreado, "titulo" | "subtitulo" | "aprenderas" | "requisitos" | "preguntas_sugeridas" | "sinExamen"> & {
    modulos: { titulo: string; lecciones: LeccionEjemplo[] }[];
    examen: Omit<PreguntaCurso, "id">[];
  };
}

const siguiente = (a: Almacen) => a.siguienteId++;

/** Lee el ejemplo y el texto de sus lecciones antes de tocar el almacén: si falta un archivo, no queda a medias. */
async function leerEjemplo(nombre: string): Promise<LeidoEjemplo> {
  const e = JSON.parse(await fs.readFile(path.join(DATOS, "ejemplos", `${nombre}.json`), "utf8")) as Ejemplo;
  const archivos = e.curso.modulos.flatMap((m) => m.lecciones.map((l) => l.archivo));
  const textos = await Promise.all(archivos.map((a) => fs.readFile(path.join(DATOS, a), "utf8")));
  // La contraseña se cifra aquí (es asíncrono) para que lo demás toque el almacén de un jalón.
  const contrasena = await cifrarContrasena(e.cuenta.contrasena);
  return { e, textos: new Map(archivos.map((a, i) => [a, textos[i].trim()])), contrasena };
}

interface LeidoEjemplo {
  e: Ejemplo;
  textos: Map<string, string>;
  contrasena: { sal: string; hash: string };
}

function sembrarEjemplo(a: Almacen, { e, textos, contrasena }: LeidoEjemplo): void {
  const ahora = new Date().toISOString();
  const empresa = e.empresa.id;
  const autor = e.empresa.dueno;

  a.empresas ??= [];
  if (!a.empresas.some((x) => x.id === empresa)) a.empresas.push({ ...e.empresa, creadaEn: ahora, actualizadaEn: ahora });

  a.cuentas ??= [];
  if (!cuentaPorCorreo(a, e.cuenta.correo)) {
    a.cuentas.push({
      id: nuevoIdCuenta(),
      correo: e.cuenta.correo,
      nombre: e.cuenta.nombre,
      rol: "coach",
      empresa,
      rolEmpresa: "dueno",
      contrasena,
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
      ...(l.abreAlDiaSiguiente ? { abreAlDiaSiguiente: true } : {}),
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

/**
 * El curso pasó de 6 lecciones a 3 módulos y 11 lecciones (diagnóstico, reto
 * de 7 días con un día por lección y sesión de claridad). Solo se reorganiza si
 * sigue como se sembró; las lecciones que se quedan conservan su id, así no se
 * pierden los resultados del Radar ni las prácticas ya entregadas.
 */
const LECCIONES_ANTERIORES = [
  "¿Tu liderazgo está preparado para el siguiente nivel?",
  "Responde tu Radar High Impact™",
  "Cómo interpretar tu puntuación",
  "El Espejo Ejecutivo™",
  "Tu plan de acción de 7 días",
  "Siguiente paso: Sesión de Claridad Estratégica",
];
const SUBTITULO_ANTERIOR =
  "Diagnóstico de liderazgo y expansión de potencial: identifica tu principal brecha y sal con una ruta de 7 días.";

function armarReto(a: Almacen, { e, textos }: { e: Ejemplo; textos: Map<string, string> }): void {
  const curso = cursoDelEjemplo(a, e);
  const actuales = curso?.modulos.flatMap((m) => m.lecciones) ?? [];
  if (!curso || actuales.map((l) => l.titulo).join("|") !== LECCIONES_ANTERIORES.join("|")) return;
  const porTitulo = new Map(actuales.map((l) => [l.titulo, l]));
  curso.modulos = e.curso.modulos.map((m, i) => ({
    id: `M${i + 1}`,
    titulo: m.titulo,
    lecciones: m.lecciones.map((l) => {
      const anterior = l.antes ? porTitulo.get(l.antes) : undefined;
      return {
        id: anterior?.id ?? `K${siguiente(a)}`,
        titulo: l.titulo,
        duracion_min: l.duracion_min,
        gratis: true,
        resumen: l.resumen,
        contenido: textos.get(l.archivo) ?? anterior?.contenido ?? "",
        transcripcion: "",
        preguntas_sugeridas: [],
        repaso: [],
        ...(l.practica ? { practica: anterior?.practica ?? l.practica } : {}),
        ...(l.abreAlDiaSiguiente ? { abreAlDiaSiguiente: true } : {}),
      };
    }),
  }));
  if (curso.subtitulo === SUBTITULO_ANTERIOR) curso.subtitulo = e.curso.subtitulo;
  curso.actualizadoEn = new Date().toISOString();
}

/**
 * La cuenta del dueño era de demostración (gabo.orpinel@example.com, con la
 * contraseña de demo). Ahora entra con el correo y la contraseña del ejemplo;
 * conserva su id, así que sigue siendo dueña de todo lo de la empresa.
 */
function cambiarCuenta(a: Almacen, { e, contrasena }: LeidoEjemplo): void {
  const cuenta = e.cuenta.antes ? cuentaPorCorreo(a, e.cuenta.antes) : undefined;
  if (!cuenta || cuenta.empresa !== e.empresa.id || cuentaPorCorreo(a, e.cuenta.correo)) return;
  cuenta.correo = e.cuenta.correo;
  cuenta.contrasena = contrasena;
  delete cuenta.demo;
}

/** El Radar es un diagnóstico: el curso queda sin examen final (sus preguntas se guardan). */
function quitarExamen(a: Almacen, { e }: { e: Ejemplo }): void {
  const curso = cursoDelEjemplo(a, e);
  if (curso && e.curso.sinExamen && curso.sinExamen === undefined) curso.sinExamen = true;
}

/**
 * Borra las respuestas del curso (a pedido del usuario, para empezar limpio):
 * resultados del Radar, prospectos de su página pública, prácticas entregadas
 * y el avance de los alumnos en sus lecciones. Las inscripciones se quedan.
 * Los archivos de las prácticas ya no aparecen en ninguna parte.
 */
function limpiarRespuestas(a: Almacen, { e }: { e: Ejemplo }): void {
  const curso = cursoDelEjemplo(a, e);
  if (!curso) return;
  const lecciones = new Set(curso.modulos.flatMap((m) => m.lecciones.map((l) => l.id)));
  const delCurso = (x: { leccion: string }) => lecciones.has(x.leccion);
  a.diagnosticos = (a.diagnosticos ?? []).filter((x) => x.curso !== curso.id && !delCurso(x));
  a.prospectos = (a.prospectos ?? []).filter((x) => x.empresa !== e.empresa.id);
  a.entregas = (a.entregas ?? []).filter((x) => x.curso !== curso.id && !delCurso(x));
  a.planes = (a.planes ?? []).filter((x) => x.curso !== curso.id && !delCurso(x));
  a.repasos = (a.repasos ?? []).filter((x) => !delCurso(x));
  a.examenes = (a.examenes ?? []).filter((x) => x.curso !== curso.id);
  for (const p of a.progreso ?? []) {
    p.completadas = p.completadas.filter((id) => !lecciones.has(id));
    if (p.fechas) for (const id of lecciones) delete p.fechas[id];
  }
  const ahora = new Date().toISOString();
  a.reinicios ??= {};
  for (const id of lecciones) a.reinicios[id] = ahora;
}

const cursoDelEjemplo = (a: Almacen, e: Ejemplo) =>
  (a.cursosCoach ?? []).find((c) => c.empresa === e.empresa.id && c.comunidad === e.comunidad.id && c.titulo === e.curso.titulo);

/**
 * Cambios que llegaron después de sembrar un ejemplo. Se aplican una sola vez
 * en los almacenes que ya lo tenían ("increase:practicas"…); uno recién
 * sembrado ya los trae.
 */
const ACTUALIZACIONES: { id: string; aplicar: (a: Almacen, ejemplo: LeidoEjemplo) => void }[] = [
  { id: "practicas", aplicar: sumarPracticas },
  { id: "agenda", aplicar: sumarAgenda },
  { id: "plan", aplicar: sumarPlan },
  { id: "sin-examen", aplicar: quitarExamen },
  { id: "reto-7-dias", aplicar: armarReto },
  { id: "cuenta", aplicar: cambiarCuenta },
  { id: "limpiar-respuestas", aplicar: limpiarRespuestas },
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
