import { randomBytes } from "crypto";
import { consultar, modificar } from "@/lib/almacen";
import { error, ErrorDeDatos, leerJson, manejar, texto } from "@/lib/http";
import { nuevaInvitacion } from "@/lib/invitaciones";
import { coachDe, SinPermiso } from "@/lib/permisos";
import { RANGOS_ALUMNOS, type SolicitudCoach } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// Solicitudes de acceso de coaches. Cualquiera puede mandar una desde
// /coaches; en el MVP no se envía ningún mensaje: el equipo de Merkatics las
// ve en Mi empresa y, si le da acceso, crea su invitación y se la comparte.

const MAX_SOLICITUDES = 500;

async function equipoDe(req: Request) {
  const coach = await coachDe(req);
  if (!coach.cuenta.admin) throw new SinPermiso("Solo el equipo de Merkatics ve las solicitudes.");
  return coach;
}

// Nueva solicitud: { nombre, contacto, empresa?, tema, alumnos, mensaje? }. No pide sesión.
export const POST = manejar(async (req: Request) => {
  const datos = await leerJson(req);
  const nombre = texto(datos.nombre, "nombre", 80);
  const contacto = texto(datos.contacto, "correo o WhatsApp", 120);
  if (contacto.length < 6) throw new ErrorDeDatos("Escribe un correo o un WhatsApp para poder responderte.");
  const tema = texto(datos.tema, "qué enseñas", 120);
  const alumnos = typeof datos.alumnos === "string" && RANGOS_ALUMNOS.includes(datos.alumnos) ? datos.alumnos : null;
  if (!alumnos) throw new ErrorDeDatos("Elige cuántos alumnos tienes hoy.");
  const empresa = typeof datos.empresa === "string" ? datos.empresa.trim().slice(0, 80) : "";
  const mensaje = typeof datos.mensaje === "string" ? datos.mensaje.trim().slice(0, 600) : "";
  const solicitud: SolicitudCoach = {
    id: randomBytes(8).toString("base64url"),
    nombre,
    contacto,
    ...(empresa ? { empresa } : {}),
    tema,
    alumnos,
    ...(mensaje ? { mensaje } : {}),
    creadaEn: new Date().toISOString(),
    estado: "nueva",
  };
  await modificar((a) => {
    a.solicitudes = [...(a.solicitudes ?? []), solicitud].slice(-MAX_SOLICITUDES);
  });
  return Response.json({ id: solicitud.id }, { status: 201 });
});

// Las solicitudes, de la más nueva a la más vieja (solo el equipo de Merkatics).
export const GET = manejar(async (req: Request) => {
  await equipoDe(req);
  return Response.json(await consultar((a) => [...(a.solicitudes ?? [])].reverse()));
});

// Atender una solicitud: { id, accion: "invitar" | "descartar" }. Invitar crea
// la invitación para abrir su empresa (con el nombre de su negocio) y la devuelve.
export const PATCH = manejar(async (req: Request) => {
  const equipo = await equipoDe(req);
  const datos = await leerJson(req);
  const accion = datos.accion;
  if (accion !== "invitar" && accion !== "descartar") throw new ErrorDeDatos('La acción debe ser "invitar" o "descartar".');
  const resultado = await modificar((a) => {
    const s = (a.solicitudes ?? []).find((x) => x.id === datos.id);
    if (!s) return null;
    if (accion === "descartar") {
      s.estado = "descartada";
      return s;
    }
    if (!s.invitacion) {
      const i = nuevaInvitacion(a, {
        tipo: "empresa",
        ...(s.empresa ? { nombreEmpresa: s.empresa } : {}),
        creadaPor: equipo.nombre,
      });
      s.invitacion = i.codigo;
    }
    s.estado = "invitada";
    return s;
  });
  return resultado ? Response.json(resultado) : error("No encontramos esa solicitud.", 404);
});
