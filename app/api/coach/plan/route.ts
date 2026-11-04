import { consultar, modificar, type Almacen } from "@/lib/almacen";
import { ErrorDeDatos, idNumerico, leerJson, manejar } from "@/lib/http";
import {
  adelantar,
  cancelarPlan,
  DIAS_PRUEBA,
  elegirMetodo,
  METODOS_PLAN,
  pagarFicha,
  ponerAlDia,
  PRECIO_PLAN,
  reactivarPlan,
  TARJETAS_PRUEBA,
} from "@/lib/plan";
import { coachDe, conPermiso, empresaDeCoach } from "@/lib/permisos";
import type { MetodoPlan, PlanEmpresa } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// El plan de la empresa con Merkatics (lib/plan.ts). PAGOS SIMULADOS.
//   GET   el plan al día, el precio y las tarjetas de prueba. Lo ve todo el equipo.
//   POST  { accion } — solo el dueño o un administrador:
//         "metodo" {metodo, tarjeta?}   elegir o cambiar la forma de pago
//         "pagar" {cobro}               simular que se pagó la ficha de OXXO o SPEI
//         "cancelar" / "reactivar"
//         "adelantar"                   demostración: saltar al siguiente cobro

const extras = {
  precio: PRECIO_PLAN,
  diasPrueba: DIAS_PRUEBA,
  tarjetas: TARJETAS_PRUEBA.map(({ id, marca, ultimos4, nota }) => ({ id, marca, ultimos4, nota })),
};

const lo = (plan: PlanEmpresa | null, administra: boolean) => Response.json({ plan, administra, ...extras });

export const GET = manejar((req: Request) =>
  conPermiso(async () => {
    const coach = await coachDe(req);
    const actual = await consultar((a) => empresaDeCoach(a, coach).plan ?? null);
    if (!actual) return lo(null, coach.administra);
    // Solo se escribe si ponerlo al día cambia algo (un cobro, una ficha, la pausa).
    const copia = structuredClone(actual);
    if (!ponerAlDia({ siguienteId: 1 } as Almacen, copia)) return lo(actual, coach.administra);
    const plan = await modificar((a) => {
      const p = empresaDeCoach(a, coach).plan!;
      ponerAlDia(a, p);
      return p;
    });
    return lo(plan, coach.administra);
  }),
);

export const POST = manejar((req: Request) =>
  conPermiso(async () => {
    const coach = await coachDe(req);
    const datos = await leerJson(req);
    const plan = await modificar((a) => {
      const e = empresaDeCoach(a, coach, { administrar: true });
      if (!e.plan) throw new ErrorDeDatos("Tu empresa no tiene un plan de pago.");
      const p = e.plan;
      ponerAlDia(a, p);
      switch (datos.accion) {
        case "metodo": {
          const metodo = datos.metodo as MetodoPlan;
          if (!METODOS_PLAN.includes(metodo)) throw new ErrorDeDatos("Elige una forma de pago válida.");
          let tarjeta;
          if (metodo === "tarjeta") {
            const elegida = TARJETAS_PRUEBA.find((t) => t.id === datos.tarjeta);
            if (!elegida) throw new ErrorDeDatos("Elige una de las tarjetas de prueba.");
            tarjeta = { id: elegida.id, marca: elegida.marca, ultimos4: elegida.ultimos4 };
          }
          if (p.estado === "cancelado" || p.cancelado) throw new ErrorDeDatos("Tu plan está cancelado: reactívalo primero.");
          elegirMetodo(a, p, metodo, tarjeta);
          break;
        }
        case "pagar":
          if (!pagarFicha(p, idNumerico(String(datos.cobro)))) throw new ErrorDeDatos("Esa ficha ya no está pendiente.");
          break;
        case "cancelar":
          cancelarPlan(p);
          break;
        case "reactivar":
          reactivarPlan(a, p);
          break;
        case "adelantar":
          adelantar(a, p);
          break;
        default:
          throw new ErrorDeDatos("Acción no válida.");
      }
      e.actualizadaEn = new Date().toISOString();
      return p;
    });
    return lo(plan, true);
  }),
);
