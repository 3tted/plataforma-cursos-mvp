import { randomInt } from "crypto";
import type { Almacen } from "./almacen";
import { nuevoId } from "./almacen";
import type { CobroPlan, MetodoPlan, PlanEmpresa, TarjetaPlan } from "./tipos";

// El plan de cada empresa con Merkatics. PAGOS SIMULADOS: no se contacta a
// ningún procesador, no se pide ni se guarda una tarjeta real y no se cobra
// nada. Sirve para mostrar el flujo completo mientras se elige el procesador.
//
// 1. Al registrarse, la empresa tiene 7 días gratis con todo abierto.
// 2. Elige cómo pagar: tarjeta o Mercado Pago (se cobran solos) u OXXO o SPEI
//    (se le genera una ficha 2 días antes de que termine lo pagado).
// 3. Al terminar la prueba se cobra el primer mes; luego, uno cada mes.
// 4. Si no hay forma de pago, la tarjeta se rechaza o la ficha vence sin
//    pagarse, la empresa queda en pausa (sin borrar nada) hasta que pague.
// 5. Si cancela, no se le vuelve a cobrar y conserva el acceso hasta el fin de
//    lo que ya pagó (o de su prueba).
//
// No hay tareas programadas: el plan se pone al día cada vez que se consulta.

/** Precio provisional (todavía no se define el real). */
export const PRECIO_PLAN = { monto: 1, moneda: "USD" } as const;
export const DIAS_PRUEBA = 7;
/** Días antes del cobro en que se genera la ficha de OXXO o SPEI. */
const DIAS_FICHA = 2;
const DIA = 24 * 3_600_000;

/** Tarjetas de prueba para la demostración: se elige una, nunca se escribe una tarjeta real. */
export const TARJETAS_PRUEBA: (TarjetaPlan & { rechaza?: boolean; nota: string })[] = [
  { id: "visa-4242", marca: "Visa", ultimos4: "4242", nota: "Se aprueba" },
  { id: "mastercard-4444", marca: "Mastercard", ultimos4: "4444", nota: "Se aprueba" },
  { id: "visa-0002", marca: "Visa", ultimos4: "0002", rechaza: true, nota: "Se rechaza (para probar)" },
];

export const AUTOMATICOS: MetodoPlan[] = ["tarjeta", "mercadopago"];
export const METODOS_PLAN: MetodoPlan[] = ["tarjeta", "oxxo", "spei", "mercadopago"];

const iso = (ms: number) => new Date(ms).toISOString();
const t = (fecha: string) => new Date(fecha).getTime();

/** La misma fecha un mes después (el 31 de enero pasa al 3 de marzo, como en JavaScript). */
function unMesDespues(fecha: number): number {
  const d = new Date(fecha);
  d.setMonth(d.getMonth() + 1);
  return d.getTime();
}

function digitos(n: number): string {
  return Array.from({ length: n }, () => randomInt(10)).join("");
}

export function planNuevo(ahora = Date.now()): PlanEmpresa {
  const fin = iso(ahora + DIAS_PRUEBA * DIA);
  return { estado: "prueba", inicio: iso(ahora), pruebaHasta: fin, cubiertoHasta: fin, cobros: [] };
}

const siguientePeriodo = (p: PlanEmpresa) => p.cobros.filter((c) => c.estado === "pagado").length + 1;
const pendiente = (p: PlanEmpresa) => p.cobros.find((c) => c.estado === "pendiente");

function cobro(a: Almacen, p: PlanEmpresa, metodo: MetodoPlan, estado: CobroPlan["estado"], ahora: number): CobroPlan {
  const c: CobroPlan = {
    id: nuevoId(a),
    periodo: siguientePeriodo(p),
    monto: PRECIO_PLAN.monto,
    moneda: PRECIO_PLAN.moneda,
    metodo,
    estado,
    referencia:
      metodo === "oxxo"
        ? digitos(14)
        : metodo === "spei"
          ? digitos(7)
          : metodo === "mercadopago"
            ? `MP-DEMO-${digitos(8)}`
            : `TJ-DEMO-${digitos(8)}`,
    creadoEn: iso(ahora),
    ...(estado === "pagado" ? { pagadoEn: iso(ahora) } : {}),
  };
  // CLABE claramente ficticia: empieza con ceros para que nadie la confunda con una real.
  if (metodo === "spei") c.clabe = `000000${digitos(12)}`;
  p.cobros.push(c);
  return c;
}

/** El acceso pagado se recorre un mes: desde donde iba o, si ya había vencido, desde hoy. */
function recorrer(p: PlanEmpresa, ahora: number) {
  p.cubiertoHasta = iso(unMesDespues(Math.max(t(p.cubiertoHasta), ahora)));
}

function estadoCorriente(p: PlanEmpresa, ahora: number) {
  p.estado = ahora < t(p.pruebaHasta) ? "prueba" : "activo";
  delete p.motivo;
}

/** Cobra con tarjeta o Mercado Pago (simulado). Devuelve si pasó. */
function cobrarSolo(a: Almacen, p: PlanEmpresa, ahora: number): boolean {
  const rechaza = p.metodo === "tarjeta" && TARJETAS_PRUEBA.find((x) => x.id === p.tarjeta?.id)?.rechaza;
  const c = cobro(a, p, p.metodo!, rechaza ? "fallido" : "pagado", ahora);
  if (c.estado === "fallido") {
    p.estado = "pausado";
    p.motivo = "rechazada";
    return false;
  }
  recorrer(p, ahora);
  estadoCorriente(p, ahora);
  return true;
}

/**
 * Pone el plan al día con la fecha de hoy: cobra lo que toca, genera las
 * fichas y pausa lo vencido. Devuelve si cambió algo (para guardarlo).
 */
export function ponerAlDia(a: Almacen, p: PlanEmpresa, ahora = Date.now()): boolean {
  const antes = JSON.stringify(p);
  // Como mucho un año de cobros de golpe (por si nadie lo consultó en meses).
  for (let vuelta = 0; vuelta < 13; vuelta++) {
    if (p.estado === "pausado" || p.estado === "cancelado") break;
    const vence = t(p.cubiertoHasta);
    if (p.cancelado) {
      if (ahora >= vence) p.estado = "cancelado";
      else estadoCorriente(p, ahora);
      break;
    }
    if (!p.metodo) {
      if (ahora >= vence) {
        p.estado = "pausado";
        p.motivo = "sin-metodo";
      } else estadoCorriente(p, ahora);
      break;
    }
    if (AUTOMATICOS.includes(p.metodo)) {
      if (ahora < vence) {
        estadoCorriente(p, ahora);
        break;
      }
      if (!cobrarSolo(a, p, vence)) break;
      continue;
    }
    // OXXO o SPEI: la ficha sale unos días antes y se paga a mano.
    if (ahora >= vence - DIAS_FICHA * DIA && !pendiente(p)) {
      const c = cobro(a, p, p.metodo, "pendiente", Math.max(ahora, vence - DIAS_FICHA * DIA));
      c.venceEn = iso(vence);
    }
    if (ahora >= vence) {
      p.estado = "pausado";
      p.motivo = "sin-pago";
    } else estadoCorriente(p, ahora);
    break;
  }
  return JSON.stringify(p) !== antes;
}

/** Elige o cambia la forma de pago. Si estaba en pausa y es automática, se cobra en ese momento. */
export function elegirMetodo(a: Almacen, p: PlanEmpresa, metodo: MetodoPlan, tarjeta: TarjetaPlan | undefined, ahora = Date.now()) {
  // La ficha de antes ya no sirve: se genera otra con el método nuevo.
  for (const c of p.cobros) if (c.estado === "pendiente") c.estado = "anulado";
  p.metodo = metodo;
  if (metodo === "tarjeta" && tarjeta) p.tarjeta = tarjeta;
  else delete p.tarjeta;
  if (p.estado === "pausado") {
    if (AUTOMATICOS.includes(metodo)) cobrarSolo(a, p, ahora);
    else {
      const c = cobro(a, p, metodo, "pendiente", ahora);
      c.venceEn = iso(ahora + 3 * DIA);
      p.motivo = "sin-pago";
    }
    return;
  }
  ponerAlDia(a, p, ahora);
}

/** Simula el aviso del procesador de que se pagó la ficha de OXXO o la transferencia SPEI. */
export function pagarFicha(p: PlanEmpresa, id: number, ahora = Date.now()) {
  const c = p.cobros.find((x) => x.id === id && x.estado === "pendiente");
  if (!c) return false;
  c.estado = "pagado";
  c.pagadoEn = iso(ahora);
  recorrer(p, ahora);
  if (!p.cancelado) estadoCorriente(p, ahora);
  return true;
}

export function cancelarPlan(p: PlanEmpresa, ahora = Date.now()) {
  p.cancelado = true;
  for (const c of p.cobros) if (c.estado === "pendiente") c.estado = "anulado";
  if (p.estado === "pausado" || ahora >= t(p.cubiertoHasta)) {
    p.estado = "cancelado";
    delete p.motivo;
  }
}

export function reactivarPlan(a: Almacen, p: PlanEmpresa, ahora = Date.now()) {
  delete p.cancelado;
  if (p.estado === "cancelado") {
    // Ya terminó lo pagado: vuelve como pausada hasta que pague.
    p.estado = "pausado";
    p.motivo = p.metodo ? "sin-pago" : "sin-metodo";
    if (p.metodo) elegirMetodo(a, p, p.metodo, p.tarjeta, ahora);
    return;
  }
  ponerAlDia(a, p, ahora);
}

/**
 * Solo para la demostración: adelanta el reloj del plan hasta el siguiente
 * cobro (el fin de la prueba o del mes pagado), para ver qué pasa sin esperar.
 */
export function adelantar(a: Almacen, p: PlanEmpresa, ahora = Date.now()) {
  const vence = t(p.cubiertoHasta);
  // Con OXXO o SPEI, primero hasta el día en que sale la ficha; luego, hasta que vence.
  const manual = p.metodo && !AUTOMATICOS.includes(p.metodo) && !p.cancelado;
  const destino = manual && !pendiente(p) && ahora < vence - DIAS_FICHA * DIA ? vence - DIAS_FICHA * DIA : vence;
  const salto = Math.max(0, destino - ahora) + 1000;
  const mover = (f: string) => iso(t(f) - salto);
  p.inicio = mover(p.inicio);
  p.pruebaHasta = mover(p.pruebaHasta);
  p.cubiertoHasta = mover(p.cubiertoHasta);
  for (const c of p.cobros) {
    c.creadoEn = mover(c.creadoEn);
    if (c.pagadoEn) c.pagadoEn = mover(c.pagadoEn);
    if (c.venceEn) c.venceEn = mover(c.venceEn);
  }
  ponerAlDia(a, p, ahora);
}

/** ¿Su panel de coach está en pausa? (Sus alumnos siguen viendo sus cursos.) */
export const enPausa = (p: PlanEmpresa | undefined) => p?.estado === "pausado" || p?.estado === "cancelado";
