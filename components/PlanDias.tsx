"use client";

import { useEffect, useRef, useState } from "react";
import { api, fechaCorta } from "@/lib/cliente";
import { MAX_EVIDENCIA, planPorDias, type DiaHecho, type PlanPorDias } from "@/lib/planes";
import type { AvancePlan } from "@/lib/tipos";
import { useApp } from "./Contexto";
import { IconoCheck } from "./Iconos";

// Plan por días dentro de una lección (por ejemplo, el plan de 7 días de
// INCREASE): una tarjeta por día con su acción y su evidencia de avance. El
// alumno marca cada día y anota lo que hizo; se guarda solo, en su cuenta (y
// en el navegador, sin cuenta). El equipo de la empresa ve el avance de todos.

type AvanceVista = Omit<AvancePlan, "cuenta">;

const vacio = (p: PlanPorDias): DiaHecho[] => p.dias.map(() => ({ hecho: false, evidencia: "" }));

export default function PlanDias({ id, leccion }: { id: string; leccion: string }) {
  const plan = planPorDias(id);
  if (!plan) return null;
  return <Plan plan={plan} leccion={leccion} />;
}

function Plan({ plan, leccion }: { plan: PlanPorDias; leccion: string }) {
  const { usuario, pedirEntrada } = useApp();
  const clave = `plan:${plan.id}:${leccion}:${usuario?.correo ?? "visitante"}`;
  const [dias, setDias] = useState<DiaHecho[]>(() => vacio(plan));
  const [equipo, setEquipo] = useState<AvanceVista[] | null>(null);
  const [estado, setEstado] = useState<"guardando" | "guardado" | "error" | null>(null);
  const ruta = `/api/plan?leccion=${encodeURIComponent(leccion)}&plan=${encodeURIComponent(plan.id)}`;
  const pendiente = useRef<number | null>(null);

  // Primero lo de este navegador; con cuenta, lo guardado en el servidor gana.
  useEffect(() => {
    let vigente = true;
    try {
      const local = JSON.parse(localStorage.getItem(clave) ?? "null") as DiaHecho[] | null;
      if (Array.isArray(local) && local.length === plan.dias.length) setDias(local);
    } catch {
      // Sin almacenamiento: se empieza en blanco.
    }
    if (!usuario) return;
    api<{ equipo: boolean; avances?: AvanceVista[]; avance?: AvanceVista | null }>(ruta)
      .then((r) => {
        if (!vigente) return;
        if (r.equipo) setEquipo(r.avances ?? []);
        else if (r.avance) setDias(r.avance.dias);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [clave, plan.dias.length, ruta, usuario]);

  const guardar = (nuevos: DiaHecho[]) => {
    try {
      localStorage.setItem(clave, JSON.stringify(nuevos));
    } catch {
      // Sin almacenamiento local: se guarda solo en la cuenta.
    }
    if (!usuario || equipo) return;
    setEstado("guardando");
    api<{ guardado: boolean }>("/api/plan", { method: "POST", json: { leccion, plan: plan.id, dias: nuevos } })
      .then(() => setEstado("guardado"))
      .catch(() => setEstado("error"));
  };

  const cambiar = (i: number, cambio: Partial<DiaHecho>, inmediato: boolean) => {
    const nuevos = dias.map((d, j) => (j === i ? { ...d, ...cambio } : d));
    setDias(nuevos);
    // La casilla se guarda al momento; lo que se escribe, al dejar de escribir.
    if (pendiente.current) window.clearTimeout(pendiente.current);
    if (inmediato) guardar(nuevos);
    else pendiente.current = window.setTimeout(() => guardar(nuevos), 900);
  };

  const hechos = dias.filter((d) => d.hecho).length;
  return (
    <section className="plan-dias" aria-labelledby={`plan-${plan.id}`}>
      <header className="plan-dias-encabezado">
        <h2 id={`plan-${plan.id}`}>{plan.titulo}</h2>
        <p>{plan.instrucciones}</p>
        <p className="diagnostico-avance" aria-live="polite">
          <span className="cifra">
            {hechos}/{plan.dias.length}
          </span>{" "}
          días hechos
          <span className="diagnostico-barra" aria-hidden="true">
            <span style={{ transform: `scaleX(${hechos / plan.dias.length})` }} />
          </span>
        </p>
      </header>

      <ol className="plan-dias-lista">
        {plan.dias.map((dia, i) => (
          <li key={i} className="plan-dia" data-hecho={dias[i]?.hecho}>
            <div className="plan-dia-cabecera">
              <span className="plan-dia-numero">Día {i + 1}</span>
              <h3>{dia.titulo}</h3>
            </div>
            <p>{dia.accion}</p>
            <p className="texto-suave">
              <strong>Evidencia de avance:</strong> {dia.evidencia}
            </p>
            <label className="campo">
              <span>Lo que hiciste (opcional)</span>
              <textarea
                rows={2}
                maxLength={MAX_EVIDENCIA}
                value={dias[i]?.evidencia ?? ""}
                onChange={(e) => cambiar(i, { evidencia: e.target.value }, false)}
              />
            </label>
            <label className="plan-dia-hecho">
              <input type="checkbox" checked={!!dias[i]?.hecho} onChange={(e) => cambiar(i, { hecho: e.target.checked }, true)} />
              <IconoCheck width={14} height={14} aria-hidden="true" />
              {dias[i]?.hecho ? "Día hecho" : "Marcar el día como hecho"}
            </label>
          </li>
        ))}
      </ol>

      {!equipo && (
        <p className="diagnostico-guardado" role="status">
          {!usuario ? (
            <>
              <button type="button" className="enlace" onClick={() => pedirEntrada("alumno")}>
                Entra a tu cuenta
              </button>{" "}
              para guardar tu avance y que tu coach lo vea.
            </>
          ) : estado === "guardando" ? (
            "Guardando…"
          ) : estado === "guardado" ? (
            "Tu avance quedó guardado."
          ) : estado === "error" ? (
            "No pudimos guardar tu avance. Revisa tu conexión."
          ) : null}
        </p>
      )}

      {equipo && <AvanceEquipo plan={plan} avances={equipo} />}
    </section>
  );
}

// Lo que ve el equipo de la empresa: cuántos días lleva cada alumno y su evidencia.
function AvanceEquipo({ plan, avances }: { plan: PlanPorDias; avances: AvanceVista[] }) {
  return (
    <section className="diagnostico-equipo tarjeta" aria-labelledby="plan-equipo-titulo">
      <div className="diagnostico-equipo-encabezado">
        <h3 id="plan-equipo-titulo">
          Avance de tus alumnos <span className="cifra">{avances.length}</span>
        </h3>
      </div>
      {avances.length === 0 ? (
        <p className="texto-suave">Todavía nadie empieza el plan. Cuando un alumno marque un día, aquí verás su avance.</p>
      ) : (
        <ul className="practica-entregas">
          {avances.map((a) => {
            const hechos = a.dias.filter((d) => d.hecho).length;
            return (
              <li key={a.id}>
                <details>
                  <summary className="practica-autor">
                    <strong>{a.autor}</strong>{" "}
                    <span className="texto-suave">
                      · <span className="cifra">{hechos}/{plan.dias.length}</span> días · {fechaCorta(a.actualizadoEn)}
                    </span>
                  </summary>
                  <ol className="plan-evidencias">
                    {plan.dias.map((dia, i) => (
                      <li key={i} data-hecho={a.dias[i]?.hecho}>
                        <strong>
                          Día {i + 1} · {dia.titulo}
                        </strong>{" "}
                        <span className="texto-suave">{a.dias[i]?.hecho ? "· hecho" : "· pendiente"}</span>
                        {a.dias[i]?.evidencia && <p className="practica-texto">{a.dias[i].evidencia}</p>}
                      </li>
                    ))}
                  </ol>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
