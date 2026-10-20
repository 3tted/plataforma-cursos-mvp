import { randomBytes } from "crypto";
import type { Almacen } from "./almacen";
import { idEmpresaLibre } from "./cuentas";
import { ErrorDeDatos } from "./http";
import type { Cuenta, Invitacion } from "./tipos";

// Ser coach es solo por invitación. La dueña de una empresa invita coaches a
// su empresa; el equipo de Merkatics invita a quien abrirá una empresa nueva.
// La invitación es un enlace que se comparte a mano (el MVP no manda correos)
// y sirve una sola vez.

const DURACION_MS = 14 * 24 * 3_600_000;

export function nuevaInvitacion(a: Almacen, datos: Pick<Invitacion, "tipo" | "empresa" | "nombreEmpresa" | "creadaPor">): Invitacion {
  const ahora = Date.now();
  const invitacion: Invitacion = {
    codigo: randomBytes(12).toString("base64url"),
    ...datos,
    creadaEn: new Date(ahora).toISOString(),
    venceEn: new Date(ahora + DURACION_MS).toISOString(),
  };
  a.invitaciones = [...(a.invitaciones ?? []), invitacion];
  return invitacion;
}

export const vigente = (i: Invitacion) => !i.usadaPor && Date.parse(i.venceEn) > Date.now();

export function invitacionVigente(a: Almacen, codigo: unknown): Invitacion {
  const i = (a.invitaciones ?? []).find((x) => x.codigo === codigo);
  if (!i || !vigente(i)) throw new ErrorDeDatos("Esta invitación ya no sirve: ya se usó o venció. Pide una nueva.");
  if (i.tipo === "coach" && !(a.empresas ?? []).some((e) => e.id === i.empresa)) {
    throw new ErrorDeDatos("La empresa de esta invitación ya no existe.");
  }
  return i;
}

/** Convierte la cuenta en coach: de la empresa que invita o dueña de una empresa nueva. */
export function aceptarInvitacion(a: Almacen, i: Invitacion, cuenta: Cuenta): void {
  if (cuenta.rol === "coach") {
    throw new ErrorDeDatos("Tu cuenta ya es de coach en una empresa. Para entrar a otra, crea otra cuenta con otro correo.");
  }
  const ahora = new Date().toISOString();
  if (i.tipo === "coach") {
    Object.assign(cuenta, { rol: "coach", empresa: i.empresa, rolEmpresa: "coach" });
  } else {
    const nombre = i.nombreEmpresa || cuenta.nombre;
    const id = idEmpresaLibre(a, nombre);
    a.empresas = [...(a.empresas ?? []), { id, dueno: cuenta.nombre, nombre, creadaEn: ahora, actualizadaEn: ahora }];
    Object.assign(cuenta, { rol: "coach", empresa: id, rolEmpresa: "dueno" });
  }
  i.usadaPor = cuenta.nombre;
  i.usadaEn = ahora;
}
