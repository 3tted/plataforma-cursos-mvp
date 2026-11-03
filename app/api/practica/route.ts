import { consultar, modificar, nuevoId, type Almacen } from "@/lib/almacen";
import { cursoDeLeccion } from "@/lib/curso";
import { ErrorDeDatos, error, leerJson, manejar, texto } from "@/lib/http";
import { cuentaDeReq, empresaDeDatos, SinPermiso } from "@/lib/permisos";
import { borrarArchivoPractica, guardarArchivoPractica, tipoDePractica, vistaDeEntrega } from "@/lib/practicas";
import { MAX_BYTES_PRACTICA, MAX_TEXTO_PRACTICA } from "@/lib/reglas-practica";
import type { Cuenta, DatosCurso, EntregaPractica } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// Práctica de una lección (cuando la coach la activó): el alumno escribe sus
// notas o respuestas y, si la lección lo permite, sube un archivo. Una entrega
// por alumno y lección, que puede ir corrigiendo. El equipo de la empresa del
// curso ve las de todos sus alumnos.
//   GET    ?leccion=K…   el alumno: su entrega; el equipo: las de todos.
//   POST   {leccion, texto}   guarda las notas.
//   PUT    ?leccion=K…   sube (o reemplaza) el archivo; el nombre va en x-nombre-archivo.
//   DELETE ?leccion=K…   quita el archivo.

async function leccionConPractica(valor: unknown) {
  const leccion = texto(valor, "leccion", 20);
  const datos = await cursoDeLeccion(leccion, { borradores: true });
  const practica = datos?.curso.modulos.flatMap((m) => m.lecciones).find((l) => l.id === leccion)?.practica;
  if (!datos || !practica) throw new ErrorDeDatos("Esta lección no pide práctica.");
  return { leccion, datos, practica };
}

const delEquipo = (cuenta: Cuenta, datos: DatosCurso) => cuenta.rol === "coach" && cuenta.empresa === empresaDeDatos(datos);

function soloAlumnos(cuenta: Cuenta, datos: DatosCurso) {
  if (delEquipo(cuenta, datos)) throw new SinPermiso("Las prácticas las entregan los alumnos; aquí ves las suyas.");
}

/** La entrega del alumno en la lección (la crea vacía si todavía no tiene). */
function suEntrega(a: Almacen, cuenta: Cuenta, leccion: string, curso: string): EntregaPractica {
  a.entregas ??= [];
  let e = a.entregas.find((x) => x.cuenta === cuenta.id && x.leccion === leccion);
  if (!e) {
    const ahora = new Date().toISOString();
    e = { id: nuevoId(a), leccion, curso, cuenta: cuenta.id, autor: cuenta.nombre, texto: "", enviadaEn: ahora, actualizadaEn: ahora };
    a.entregas.push(e);
  }
  return e;
}

export const GET = manejar(async (req: Request) => {
  const cuenta = await cuentaDeReq(req);
  const parametros = new URL(req.url).searchParams;
  if (parametros.has("pendientes")) return pendientesDelEquipo(cuenta);
  const { leccion, datos } = await leccionConPractica(parametros.get("leccion"));
  if (delEquipo(cuenta, datos)) {
    const entregas = await consultar((a) =>
      (a.entregas ?? [])
        .filter((e) => e.leccion === leccion)
        .sort((x, y) => y.actualizadaEn.localeCompare(x.actualizadaEn))
        .map(vistaDeEntrega),
    );
    return Response.json({ equipo: true, entregas });
  }
  const suya = await consultar((a) => (a.entregas ?? []).find((e) => e.cuenta === cuenta.id && e.leccion === leccion));
  return Response.json({ equipo: false, entrega: suya ? vistaDeEntrega(suya) : null });
});

/**
 * Para el panel de la coach: las prácticas de los cursos de su empresa, las
 * que esperan su comentario primero, con el título de la lección y del curso.
 */
async function pendientesDelEquipo(cuenta: Cuenta): Promise<Response> {
  if (cuenta.rol !== "coach" || !cuenta.empresa) throw new SinPermiso("Esto es para el equipo de una empresa.");
  const entregas = await consultar((a) => {
    const lecciones = new Map<string, { leccion: string; curso: string }>();
    for (const c of (a.cursosCoach ?? []).filter((x) => x.empresa === cuenta.empresa)) {
      for (const l of c.modulos.flatMap((m) => m.lecciones)) lecciones.set(l.id, { leccion: l.titulo, curso: c.titulo });
    }
    return (a.entregas ?? [])
      .filter((e) => lecciones.has(e.leccion))
      .map((e) => ({ ...vistaDeEntrega(e), titulos: lecciones.get(e.leccion)! }))
      .sort((x, y) => Number(y.porRevisar) - Number(x.porRevisar) || y.actualizadaEn.localeCompare(x.actualizadaEn))
      .slice(0, 50);
  });
  return Response.json({ entregas, porRevisar: entregas.filter((e) => e.porRevisar).length });
}

// PATCH {id, respuesta}: el equipo le deja (o cambia) su comentario a una entrega.
export const PATCH = manejar(async (req: Request) => {
  const datosPeticion = await leerJson(req);
  const cuenta = await cuentaDeReq(req);
  const id = Number(datosPeticion.id);
  const comentario = texto(datosPeticion.respuesta, "respuesta", 2000);
  const entrega = await consultar((a) => (a.entregas ?? []).find((e) => e.id === id));
  if (!entrega) return error("No encontramos esa práctica.", 404);
  const datos = await cursoDeLeccion(entrega.leccion, { borradores: true });
  if (!datos || !delEquipo(cuenta, datos)) throw new SinPermiso("Solo el equipo de la empresa del curso comenta las prácticas.");
  const vista = await modificar((a) => {
    const e = (a.entregas ?? []).find((x) => x.id === id);
    if (!e) throw new ErrorDeDatos("Esa práctica ya no existe.");
    e.respuesta = { texto: comentario, autor: cuenta.nombre, fecha: new Date().toISOString() };
    return vistaDeEntrega(e);
  });
  return Response.json({ entrega: vista });
});

export const POST = manejar(async (req: Request) => {
  const datosPeticion = await leerJson(req);
  const cuenta = await cuentaDeReq(req);
  const { leccion, datos } = await leccionConPractica(datosPeticion.leccion);
  soloAlumnos(cuenta, datos);
  const notas = typeof datosPeticion.texto === "string" ? datosPeticion.texto.trim() : "";
  if (notas.length > MAX_TEXTO_PRACTICA) return error(`Tus notas son muy largas (máximo ${MAX_TEXTO_PRACTICA} caracteres).`);
  const entrega = await modificar((a) => {
    const e = suEntrega(a, cuenta, leccion, datos.curso.id);
    if (!notas && !e.archivo) throw new ErrorDeDatos("Escribe tus notas o sube un archivo para entregar tu práctica.");
    e.texto = notas;
    e.actualizadaEn = new Date().toISOString();
    return vistaDeEntrega(e);
  });
  return Response.json({ entrega });
});

export const PUT = manejar(async (req: Request) => {
  const cuenta = await cuentaDeReq(req);
  const { leccion, datos, practica } = await leccionConPractica(new URL(req.url).searchParams.get("leccion"));
  soloAlumnos(cuenta, datos);
  if (!practica.archivo) return error("En esta lección la práctica es solo por escrito.");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES_PRACTICA) return error("El archivo pesa demasiado (máximo 4 MB).", 413);
  let nombre = "archivo";
  try {
    nombre = decodeURIComponent(req.headers.get("x-nombre-archivo") ?? "archivo").trim().slice(0, 120) || "archivo";
  } catch {
    // nombre con codificación rota: se queda el genérico
  }
  const contenido = Buffer.from(await req.arrayBuffer());
  if (contenido.length === 0) return error("No llegó el archivo.");
  if (contenido.length > MAX_BYTES_PRACTICA) return error("El archivo pesa demasiado (máximo 4 MB).", 413);
  const tipo = tipoDePractica(nombre, contenido);
  if (!tipo) return error("Sube un PDF, Word, Excel, PowerPoint, JPG o PNG.", 415);

  const id = await modificar((a) => suEntrega(a, cuenta, leccion, datos.curso.id).id);
  const guardado = await guardarArchivoPractica(id, nombre, tipo, contenido);
  const { entrega, anterior } = await modificar((a) => {
    const e = suEntrega(a, cuenta, leccion, datos.curso.id);
    const anterior = e.archivo;
    e.archivo = { nombre, tipo, bytes: contenido.length, ...guardado };
    e.actualizadaEn = new Date().toISOString();
    return { entrega: vistaDeEntrega(e), anterior };
  });
  if (anterior) await borrarArchivoPractica(anterior);
  return Response.json({ entrega });
});

export const DELETE = manejar(async (req: Request) => {
  const cuenta = await cuentaDeReq(req);
  const { leccion, datos } = await leccionConPractica(new URL(req.url).searchParams.get("leccion"));
  soloAlumnos(cuenta, datos);
  const { entrega, anterior } = await modificar((a) => {
    const e = (a.entregas ?? []).find((x) => x.cuenta === cuenta.id && x.leccion === leccion);
    if (!e?.archivo) return { entrega: e ? vistaDeEntrega(e) : null, anterior: undefined };
    const anterior = e.archivo;
    delete e.archivo;
    e.actualizadaEn = new Date().toISOString();
    // Sin notas ni archivo, ya no hay entrega.
    if (!e.texto) a.entregas = a.entregas!.filter((x) => x !== e);
    return { entrega: e.texto ? vistaDeEntrega(e) : null, anterior };
  });
  if (anterior) await borrarArchivoPractica(anterior);
  return Response.json({ entrega });
});
