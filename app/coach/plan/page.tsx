"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import CodigoBarras from "@/components/CodigoBarras";
import { useApp } from "@/components/Contexto";
import { IconoFlechaDer } from "@/components/Iconos";
import NavCoach from "@/components/NavCoach";
import { AUTOMATICO, diasHasta, fechaLarga, NOMBRE_METODO, usePlan, type DatosPlan } from "@/components/usePlan";
import { useTitulo } from "@/components/useTitulo";
import { agrupar } from "@/lib/cliente";
import type { CobroPlan, MetodoPlan, PlanEmpresa } from "@/lib/tipos";

// «Mi plan»: la prueba de 7 días de la empresa, su forma de pago y sus cobros.
// PAGOS SIMULADOS: no se pide ninguna tarjeta real ni se cobra nada.

const METODOS: { id: MetodoPlan; detalle: string }[] = [
  { id: "tarjeta", detalle: "Se cobra sola cada mes." },
  { id: "mercadopago", detalle: "Se cobra sola cada mes con tu cuenta de Mercado Pago." },
  { id: "oxxo", detalle: "Cada mes te generamos una ficha para pagar en efectivo." },
  { id: "spei", detalle: "Cada mes te damos una CLABE para transferir desde tu banco." },
];

const ESTADO_COBRO: Record<CobroPlan["estado"], { texto: string; clase: string }> = {
  pagado: { texto: "Pagado", clase: "pastilla-ok" },
  pendiente: { texto: "Pendiente", clase: "pastilla-pendiente" },
  fallido: { texto: "Rechazado", clase: "pastilla-peligro" },
  anulado: { texto: "Sin usar", clase: "" },
};

export default function PaginaPlan() {
  return (
    <Suspense>
      <Plan />
    </Suspense>
  );
}

function Plan() {
  useTitulo("Mi plan");
  const { usuario } = useApp();
  const bienvenida = useSearchParams().get("nueva") === "1";
  const { datos, accion } = usePlan();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const hacer = async (clave: string, json: Record<string, unknown>) => {
    setError(null);
    setOcupado(clave);
    try {
      await accion(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(null);
    }
  };

  if (usuario && usuario.rol !== "coach") {
    return (
      <div className="pagina-estrecha">
        <h1>Mi plan</h1>
        <p className="texto-suave">Esta página es para las empresas registradas en Merkatics.</p>
      </div>
    );
  }

  return (
    <div className="mi-plan">
      <NavCoach />
      <header className="cabecera-pagina">
        <h1>Mi plan</h1>
        <p className="texto-suave">
          {datos
            ? `Plan Merkatics: ${datos.diasPrueba} días gratis y después ${datos.precio.monto} ${datos.precio.moneda} al mes (precio provisional).`
            : "Tu prueba gratis, tu forma de pago y tus cobros."}
        </p>
      </header>

      {!datos && <p className="texto-suave">Cargando tu plan…</p>}

      {datos && !datos.plan && (
        <section className="tarjeta plan-estado">
          <h2>Tu empresa no tiene un plan de pago</h2>
          <p className="texto-suave">
            Es una empresa de ejemplo o se registró antes de que existieran los planes: no se le cobra nada. Las empresas
            nuevas empiezan con {datos.diasPrueba} días gratis.
          </p>
        </section>
      )}

      {datos?.plan && (
        <>
          {bienvenida && datos.plan.estado === "prueba" && !datos.plan.metodo && (
            <div className="aviso plan-bienvenida" role="status">
              <p>
                <strong>¡Tu empresa ya está lista!</strong> Tienes {datos.diasPrueba} días gratis para configurarla.
                Elige abajo cómo pagarás después de la prueba; mientras, ya puedes crear tu primera comunidad.
              </p>
              <Link href="/coach/comunidades?crear=comunidad" className="boton boton-chico">
                Crear mi comunidad
              </Link>
            </div>
          )}
          <div className="aviso aviso-demo">
            <strong>Modo demostración:</strong> no se cobra nada. Las tarjetas son de prueba y las fichas y la CLABE son
            ficticias.
          </div>
          <Estado datos={datos} plan={datos.plan} />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Ficha
            plan={datos.plan}
            administra={datos.administra}
            ocupado={ocupado}
            alPagar={(id) => hacer("pagar", { accion: "pagar", cobro: id })}
          />
          <div className="mi-plan-rejilla">
            <FormaDePago datos={datos} plan={datos.plan} ocupado={ocupado} hacer={hacer} />
            <div className="mi-plan-lateral">
              <Cobros plan={datos.plan} />
              {datos.administra && <Demostracion plan={datos.plan} ocupado={ocupado} hacer={hacer} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Estado({ datos, plan }: { datos: DatosPlan; plan: PlanEmpresa }) {
  const precio = `${datos.precio.monto} ${datos.precio.moneda}`;
  const metodo = plan.metodo ? nombreDe(plan) : null;
  const dias = diasHasta(plan.pruebaHasta);
  const usados = Math.min(datos.diasPrueba, datos.diasPrueba - dias);

  let titulo: string;
  let texto: string;
  let clase = "";
  if (plan.estado === "prueba") {
    titulo = dias <= 1 ? "Prueba gratis: hoy es tu último día" : `Prueba gratis: te quedan ${dias} días`;
    texto = plan.cancelado
      ? `Cancelaste tu plan: no se te cobrará nada. Tu empresa sigue abierta hasta el ${fechaLarga(plan.pruebaHasta)}.`
      : !metodo
        ? `Elige cómo pagar antes del ${fechaLarga(plan.pruebaHasta)} para que tu empresa siga activa. Ese día se cobra el primer mes (${precio}).`
        : AUTOMATICO(plan.metodo)
          ? `El ${fechaLarga(plan.pruebaHasta)} se cobra el primer mes (${precio}) con ${metodo}. Puedes cancelar antes sin costo.`
          : `Dos días antes del ${fechaLarga(plan.pruebaHasta)} te generamos tu ficha del primer mes (${precio}) para pagar con ${metodo}.`;
  } else if (plan.estado === "activo") {
    titulo = "Plan activo";
    clase = "plan-estado-ok";
    texto = plan.cancelado
      ? `Cancelaste tu plan: no se te volverá a cobrar. Tu empresa sigue abierta hasta el ${fechaLarga(plan.cubiertoHasta)}.`
      : `Pagado hasta el ${fechaLarga(plan.cubiertoHasta)}. ${
          AUTOMATICO(plan.metodo) ? `Ese día se cobra el siguiente mes con ${metodo}.` : `Antes de esa fecha te generamos tu ficha con ${metodo}.`
        }`;
  } else if (plan.estado === "pausado") {
    titulo = "Tu empresa está en pausa";
    clase = "plan-estado-pausa";
    texto =
      plan.motivo === "rechazada"
        ? "Tu tarjeta fue rechazada. Elige otra tarjeta u otra forma de pago para reactivarla."
        : plan.motivo === "sin-metodo"
          ? "Terminó tu prueba sin una forma de pago. Elige una para seguir."
          : "No se recibió el pago de tu ficha. Págala o elige otra forma de pago.";
    texto += " Tus alumnos siguen viendo tus cursos; lo que se pausa es crear comunidades y cursos nuevos.";
  } else {
    titulo = "Plan cancelado";
    clase = "plan-estado-pausa";
    texto = "Terminó lo que tenías pagado. Reactiva tu plan para seguir creando comunidades y cursos.";
  }

  return (
    <section className={`tarjeta plan-estado ${clase}`} aria-labelledby="plan-estado-titulo">
      <h2 id="plan-estado-titulo">{titulo}</h2>
      <p>{texto}</p>
      {plan.estado === "prueba" && (
        <div className="plan-dias" aria-hidden="true">
          {Array.from({ length: datos.diasPrueba }, (_, i) => (
            <span key={i} data-usado={i < usados} />
          ))}
        </div>
      )}
      {plan.metodo && (
        <p className="texto-suave plan-metodo-actual">
          Forma de pago: <strong>{nombreDe(plan)}</strong>
        </p>
      )}
    </section>
  );
}

const nombreDe = (p: PlanEmpresa) =>
  p.metodo === "tarjeta" && p.tarjeta ? `${p.tarjeta.marca} terminación ${p.tarjeta.ultimos4}` : NOMBRE_METODO[p.metodo!];

function Ficha({
  plan,
  administra,
  ocupado,
  alPagar,
}: {
  plan: PlanEmpresa;
  administra: boolean;
  ocupado: string | null;
  alPagar: (id: number) => void;
}) {
  const c = plan.cobros.find((x) => x.estado === "pendiente");
  if (!c) return null;
  const monto = `${c.monto} ${c.moneda}`;
  return (
    <section className="tarjeta ficha" aria-labelledby="ficha-plan-titulo">
      <div className="ficha-titulo">
        <h2 id="ficha-plan-titulo">{c.metodo === "oxxo" ? "Tu ficha de pago OXXO" : "Datos para tu transferencia SPEI"}</h2>
        <span className="pastilla pastilla-pendiente">Pendiente de pago</span>
      </div>
      <dl className="ficha-datos">
        <div>
          <dt>Monto</dt>
          <dd className="ficha-monto">{monto}</dd>
        </div>
        {c.clabe && (
          <div>
            <dt>CLABE (ficticia)</dt>
            <dd className="ficha-referencia">{agrupar(c.clabe, 6)}</dd>
          </div>
        )}
        <div>
          <dt>{c.metodo === "oxxo" ? "Referencia" : "Referencia numérica"}</dt>
          <dd className="ficha-referencia">{c.metodo === "oxxo" ? agrupar(c.referencia, 4) : c.referencia}</dd>
        </div>
        {c.venceEn && (
          <div>
            <dt>Paga antes del</dt>
            <dd>{fechaLarga(c.venceEn)}</dd>
          </div>
        )}
      </dl>
      {c.metodo === "oxxo" && (
        <div className="ficha-codigo">
          <CodigoBarras texto={c.referencia} />
          <span className="cifra">{agrupar(c.referencia, 4)}</span>
        </div>
      )}
      <p className="texto-suave">
        Mes {c.periodo} del plan. Tu empresa sigue activa en cuanto se confirma el pago: no tienes que mandar comprobante.
      </p>
      {administra && (
        <button type="button" className="boton" onClick={() => alPagar(c.id)} disabled={ocupado !== null}>
          {ocupado === "pagar" ? "Confirmando…" : c.metodo === "oxxo" ? "Simular pago en OXXO" : "Simular transferencia recibida"}
        </button>
      )}
    </section>
  );
}

function FormaDePago({
  datos,
  plan,
  ocupado,
  hacer,
}: {
  datos: DatosPlan;
  plan: PlanEmpresa;
  ocupado: string | null;
  hacer: (clave: string, json: Record<string, unknown>) => Promise<void>;
}) {
  const [metodo, setMetodo] = useState<MetodoPlan>(plan.metodo ?? "tarjeta");
  const [tarjeta, setTarjeta] = useState(plan.tarjeta?.id ?? datos.tarjetas[0]?.id ?? "");
  useEffect(() => {
    if (plan.metodo) setMetodo(plan.metodo);
    if (plan.tarjeta) setTarjeta(plan.tarjeta.id);
  }, [plan.metodo, plan.tarjeta]);

  const terminado = plan.estado === "cancelado" || plan.cancelado;
  const igual = metodo === plan.metodo && (metodo !== "tarjeta" || tarjeta === plan.tarjeta?.id);
  // En pausa se puede reintentar con lo mismo, salvo que ya haya una ficha esperando su pago.
  const fichaPendiente = plan.cobros.some((c) => c.estado === "pendiente");
  const sinCambio = igual && (plan.estado !== "pausado" || fichaPendiente);
  const precio = `${datos.precio.monto} ${datos.precio.moneda}`;
  const boton =
    plan.estado === "pausado"
      ? AUTOMATICO(metodo)
        ? `Pagar ${precio} y reactivar`
        : "Generar mi ficha"
      : plan.metodo
        ? "Cambiar forma de pago"
        : "Guardar forma de pago";

  return (
    <section className="tarjeta plan-forma" aria-labelledby="forma-pago-titulo">
      <h2 id="forma-pago-titulo">Forma de pago</h2>
      {!datos.administra && <p className="nota">La forma de pago la eligen el dueño y los administradores.</p>}
      {terminado ? (
        <>
          <p className="texto-suave">Tu plan está cancelado. Reactívalo para volver a elegir cómo pagar.</p>
          {datos.administra && (
            <button type="button" className="boton" onClick={() => hacer("reactivar", { accion: "reactivar" })} disabled={ocupado !== null}>
              {ocupado === "reactivar" ? "Reactivando…" : "Reactivar mi plan"}
            </button>
          )}
        </>
      ) : (
        <fieldset className="plan-campos" disabled={!datos.administra || ocupado !== null}>
          <legend className="sr-only">Forma de pago</legend>
          <div className="metodos" role="radiogroup" aria-label="Forma de pago">
            {METODOS.map((m) => (
              <label key={m.id} className="metodo" data-activo={metodo === m.id}>
                <input
                  type="radio"
                  name="metodo-plan"
                  value={m.id}
                  checked={metodo === m.id}
                  onChange={() => setMetodo(m.id)}
                  aria-labelledby={`plan-${m.id}`}
                  aria-describedby={`plan-${m.id}-detalle`}
                />
                <span className="metodo-nombre" id={`plan-${m.id}`}>
                  {NOMBRE_METODO[m.id]}
                </span>
                <span className="texto-suave" id={`plan-${m.id}-detalle`}>
                  {m.detalle}
                </span>
              </label>
            ))}
          </div>

          {metodo === "tarjeta" && (
            <fieldset className="plan-tarjetas">
              <legend>Tarjeta de prueba</legend>
              <p className="nota">En la demostración no se escribe ninguna tarjeta: elige una de prueba.</p>
              {datos.tarjetas.map((t) => (
                <label key={t.id} className="plan-tarjeta" data-activo={tarjeta === t.id}>
                  <input type="radio" name="tarjeta-plan" checked={tarjeta === t.id} onChange={() => setTarjeta(t.id)} />
                  <span className="plan-tarjeta-numero cifra">
                    {t.marca} •••• {t.ultimos4}
                  </span>
                  <span className="texto-suave">{t.nota}</span>
                </label>
              ))}
            </fieldset>
          )}

          {datos.administra && (
            <button
              type="button"
              className="boton"
              disabled={sinCambio || ocupado !== null}
              onClick={() => hacer("metodo", { accion: "metodo", metodo, ...(metodo === "tarjeta" ? { tarjeta } : {}) })}
            >
              {ocupado === "metodo" ? "Guardando…" : boton}
            </button>
          )}
        </fieldset>
      )}

      {datos.administra && !terminado && (
        <p className="nota plan-cancelar">
          {plan.cancelado ? null : (
            <button
              type="button"
              className="enlace-boton"
              disabled={ocupado !== null}
              onClick={() => {
                if (window.confirm("¿Cancelar tu plan? No se te volverá a cobrar y tu empresa sigue abierta hasta el fin de lo que ya pagaste.")) {
                  void hacer("cancelar", { accion: "cancelar" });
                }
              }}
            >
              Cancelar mi plan
            </button>
          )}
        </p>
      )}
      {datos.administra && plan.cancelado && plan.estado !== "cancelado" && (
        <button type="button" className="boton boton-secundario" onClick={() => hacer("reactivar", { accion: "reactivar" })} disabled={ocupado !== null}>
          No cancelar: seguir con mi plan
        </button>
      )}
    </section>
  );
}

function Cobros({ plan }: { plan: PlanEmpresa }) {
  const lista = [...plan.cobros].reverse();
  return (
    <section className="tarjeta plan-cobros" aria-labelledby="cobros-titulo">
      <h2 id="cobros-titulo">Cobros</h2>
      {lista.length === 0 ? (
        <p className="texto-suave">Todavía no hay cobros: el primero es al terminar tu prueba ({fechaLarga(plan.pruebaHasta)}).</p>
      ) : (
        <ul className="plan-cobros-lista">
          {lista.map((c) => (
            <li key={c.id}>
              <span>
                <strong>Mes {c.periodo}</strong>
                <span className="texto-suave">
                  {" "}
                  · {NOMBRE_METODO[c.metodo]} · {fechaLarga(c.pagadoEn ?? c.creadoEn)}
                </span>
              </span>
              <span className="plan-cobro-monto cifra">
                {c.monto} {c.moneda}
              </span>
              <span className={`pastilla ${ESTADO_COBRO[c.estado].clase}`}>{ESTADO_COBRO[c.estado].texto}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Para presentar el flujo sin esperar 7 días ni un mes.
function Demostracion({
  plan,
  ocupado,
  hacer,
}: {
  plan: PlanEmpresa;
  ocupado: string | null;
  hacer: (clave: string, json: Record<string, unknown>) => Promise<void>;
}) {
  if (plan.estado === "pausado" || plan.estado === "cancelado") return null;
  const manual = plan.metodo && !AUTOMATICO(plan.metodo) && !plan.cancelado;
  const ficha = plan.cobros.some((c) => c.estado === "pendiente");
  const destino = manual && !ficha ? "el día en que sale la ficha" : plan.estado === "prueba" ? "el día 7 (fin de la prueba)" : "el siguiente cobro";
  return (
    <section className="tarjeta plan-demo" aria-labelledby="demo-titulo">
      <h2 id="demo-titulo">Probar sin esperar</h2>
      <p className="texto-suave">Solo para la demostración: adelanta el reloj de tu plan hasta {destino} y mira qué pasa.</p>
      <button type="button" className="boton boton-fantasma-borde" onClick={() => hacer("adelantar", { accion: "adelantar" })} disabled={ocupado !== null}>
        {ocupado === "adelantar" ? "Adelantando…" : "Adelantar"} <IconoFlechaDer width={15} height={15} />
      </button>
    </section>
  );
}
