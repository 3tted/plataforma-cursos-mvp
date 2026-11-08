import { consultar, modificar, nuevoId, type Almacen } from "@/lib/almacen";
import { correoValido, normalizarCorreo } from "@/lib/cuentas";
import { marcaDe } from "@/lib/curso";
import { calcular, diagnosticoEn, problemasDe, respuestasValidas, diagnosticoDeLeccion } from "@/lib/diagnosticos";
import { ErrorDeDatos, error, leerJson, manejar, texto } from "@/lib/http";
import { coachOpcional } from "@/lib/permisos";
import type { ProspectoDiagnostico } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// La página pública del diagnóstico de una empresa (/radar/<empresa>): cualquiera
// lo responde sin cuenta, ve su resultado completo y deja su nombre y su
// WhatsApp o correo para guardarlo o agendar. El equipo de la empresa ve esos
// contactos (prospectos) en su panel.
//   GET   la marca, la comunidad (con su agenda) y la lección del curso publicado
//         que lleva el diagnóstico; al equipo de la empresa, además, sus prospectos.
//   POST  {nombre, whatsapp?, correo?, respuestas}   guarda (o actualiza) un prospecto.

/** Tope de prospectos por empresa: el almacén es un solo documento. */
const MAXIMO_PROSPECTOS = 500;

type Params = { params: Promise<{ empresa: string }> };

/** La primera lección publicada de la empresa que incrusta un diagnóstico. */
function radarDe(a: Almacen, empresa: string) {
  const e = (a.empresas ?? []).find((x) => x.id === empresa);
  if (!e) return null;
  for (const curso of a.cursosCoach ?? []) {
    if (curso.empresa !== e.id || curso.estado !== "publicado") continue;
    const comunidad = (a.comunidadesCoach ?? []).find((c) => c.id === curso.comunidad);
    if (!comunidad) continue;
    for (const leccion of curso.modulos.flatMap((m) => m.lecciones)) {
      const id = diagnosticoDeLeccion(leccion.contenido);
      const d = id ? diagnosticoEn(a, id) : undefined;
      // Uno creado por el coach que todavía está incompleto no se publica.
      if (!d || problemasDe(d).length > 0) continue;
      return {
        empresa: { id: e.id, nombre: e.nombre },
        ...marcaDe(a, e.id),
        comunidad: {
          id: comunidad.id,
          nombre: comunidad.nombre,
          coach: comunidad.coach,
          ...(comunidad.agenda ? { agenda: comunidad.agenda } : {}),
        },
        curso: curso.id,
        leccion: leccion.id,
        diagnostico: d.id,
      };
    }
  }
  return null;
}

/** Lo que ve el equipo: sin las respuestas una por una (con los puntos basta). */
const vista = ({ respuestas: _respuestas, empresa: _empresa, ...p }: ProspectoDiagnostico) => p;

export const GET = manejar(async (req: Request, { params }: Params) => {
  const { empresa } = await params;
  const coach = await coachOpcional(req);
  const datos = await consultar((a) => {
    const radar = radarDe(a, empresa);
    if (!radar) return null;
    if (coach?.empresa !== radar.empresa.id) return radar;
    const prospectos = (a.prospectos ?? [])
      .filter((p) => p.empresa === radar.empresa.id)
      .sort((x, y) => y.actualizadoEn.localeCompare(x.actualizadoEn))
      .map(vista);
    return { ...radar, prospectos };
  });
  return datos ? Response.json(datos) : error("Esta empresa no tiene un diagnóstico público.", 404);
});

/** WhatsApp: 10 dígitos de México (se le pone el 52) o con su código de país. */
function whatsappDe(valor: unknown): string | undefined {
  const digitos = typeof valor === "string" ? valor.replace(/\D/g, "") : "";
  if (!digitos) return undefined;
  const numero = digitos.length === 10 ? `52${digitos}` : digitos;
  if (numero.length < 11 || numero.length > 15) {
    throw new ErrorDeDatos("Escribe tu WhatsApp con sus 10 dígitos (o con el código de país si no es de México).");
  }
  return numero;
}

export const POST = manejar(async (req: Request, { params }: Params) => {
  const { empresa } = await params;
  const cuerpo = await leerJson(req);
  const nombre = texto(cuerpo.nombre, "nombre", 80);
  const whatsapp = whatsappDe(cuerpo.whatsapp);
  const correo = normalizarCorreo(cuerpo.correo) || undefined;
  if (correo && !correoValido(correo)) return error("Revisa tu correo: parece que le falta algo.");
  if (!whatsapp && !correo) return error("Déjanos tu WhatsApp o tu correo para poder contactarte.");

  const { radar, d } = await consultar((a) => {
    const r = radarDe(a, empresa);
    return { radar: r, d: r ? diagnosticoEn(a, r.diagnostico) : undefined };
  });
  if (!radar || !d) return error("Esta empresa no tiene un diagnóstico público.", 404);
  const respuestas = respuestasValidas(d, cuerpo.respuestas);
  if (!respuestas) return error("Responde todas las afirmaciones antes de guardar tu resultado.");

  const r = calcular(d, respuestas);
  const cambios = {
    nombre,
    ...(whatsapp ? { whatsapp } : {}),
    ...(correo ? { correo } : {}),
    respuestas,
    puntos: Object.fromEntries(r.dimensiones.map((x) => [x.dimension.id, x.puntos])),
    total: r.total,
    masBajas: r.masBajas.map((x) => x.id),
    actualizadoEn: new Date().toISOString(),
  };
  await modificar((a) => {
    a.prospectos ??= [];
    // La misma persona (mismo WhatsApp o correo) que lo vuelve a hacer: se actualiza su resultado.
    const existente = a.prospectos.find(
      (p) =>
        p.empresa === radar.empresa.id &&
        p.diagnostico === d.id &&
        ((whatsapp && p.whatsapp === whatsapp) || (correo && p.correo === correo)),
    );
    if (existente) {
      Object.assign(existente, cambios);
      return;
    }
    const suyos = a.prospectos.filter((p) => p.empresa === radar.empresa.id);
    if (suyos.length >= MAXIMO_PROSPECTOS) {
      // Se va el más viejo de esta empresa.
      const viejo = suyos.reduce((x, y) => (x.actualizadoEn <= y.actualizadoEn ? x : y));
      a.prospectos.splice(a.prospectos.indexOf(viejo), 1);
    }
    a.prospectos.push({ id: nuevoId(a), empresa: radar.empresa.id, diagnostico: d.id, creadoEn: cambios.actualizadoEn, ...cambios });
  });
  return Response.json({ guardado: true });
});
