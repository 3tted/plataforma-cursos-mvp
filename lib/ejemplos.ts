import { promises as fs } from "fs";
import path from "path";
import type { Almacen } from "./almacen";
import { CUENTAS_DEMO, cuentaPorCorreo, nuevoIdCuenta } from "./cuentas";
import type { ComunidadCreada, CursoCreado, Empresa, PreguntaCurso } from "./tipos";

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
}

interface Ejemplo {
  empresa: Pick<Empresa, "id" | "nombre" | "dueno" | "color" | "logo" | "giro">;
  comunidad: Omit<ComunidadCreada, "autor" | "empresa" | "creadaEn">;
  curso: Pick<CursoCreado, "titulo" | "subtitulo" | "aprenderas" | "requisitos" | "preguntas_sugeridas"> & {
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
    autor,
    empresa,
    creadoEn: ahora,
    actualizadoEn: ahora,
  });
}

/**
 * Siembra las empresas de ejemplo que este almacén todavía no tiene. Devuelve si cambió algo.
 * Si sus archivos no están a la mano (una ruta que no lleva /data en el despliegue), lo deja
 * para la siguiente lectura en vez de fallar.
 */
export async function sumarEjemplos(a: Almacen): Promise<boolean> {
  const sembrados = new Set(a.ejemplos ?? []);
  const nuevos = EJEMPLOS.filter((x) => !sembrados.has(x));
  if (nuevos.length === 0) return false;
  let cambiado = false;
  for (const nombre of nuevos) {
    const ejemplo = await leerEjemplo(nombre).catch(() => null);
    if (!ejemplo) continue;
    sembrarEjemplo(a, ejemplo);
    sembrados.add(nombre);
    cambiado = true;
  }
  a.ejemplos = [...sembrados];
  return cambiado;
}
