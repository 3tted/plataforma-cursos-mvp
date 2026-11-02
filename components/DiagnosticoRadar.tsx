"use client";

import { useEffect, useMemo, useState } from "react";
import { calcular, diagnostico as buscarDiagnostico, type Diagnostico, type Resultado } from "@/lib/diagnosticos";
import { useApp } from "./Contexto";

// Diagnóstico de autoevaluación dentro de una lección (por ejemplo, el Radar
// de Liderazgo High Impact de INCREASE): afirmaciones del 1 al 5 agrupadas por
// dimensión, una gráfica de radar con el resultado y por dónde empezar. Las
// respuestas se guardan en este navegador para que el alumno vuelva a su
// resultado; no cuentan como examen.

interface Guardado {
  respuestas: Record<string, (number | null)[]>;
  revelado: boolean;
}

const vacio = (d: Diagnostico): Guardado => ({
  respuestas: Object.fromEntries(d.dimensiones.map((x) => [x.id, x.afirmaciones.map(() => null)])),
  revelado: false,
});

function leer(clave: string, d: Diagnostico): Guardado {
  try {
    const g = JSON.parse(localStorage.getItem(clave) ?? "null") as Guardado | null;
    if (!g?.respuestas) return vacio(d);
    // Solo lo que corresponde a las afirmaciones de hoy, por si el diagnóstico cambió.
    const base = vacio(d);
    for (const x of d.dimensiones) {
      base.respuestas[x.id] = x.afirmaciones.map((_, i) => {
        const v = g.respuestas[x.id]?.[i];
        return typeof v === "number" ? v : null;
      });
    }
    return { respuestas: base.respuestas, revelado: Boolean(g.revelado) };
  } catch {
    return vacio(d);
  }
}

export default function DiagnosticoRadar({ id }: { id: string }) {
  const d = buscarDiagnostico(id);
  if (!d) return null;
  return <Radar d={d} />;
}

function Radar({ d }: { d: Diagnostico }) {
  const { usuario } = useApp();
  const clave = `diagnostico:${d.id}:${usuario?.correo ?? "visitante"}`;
  const [estado, setEstado] = useState<Guardado>(() => vacio(d));
  const [listo, setListo] = useState(false);
  const [aviso, setAviso] = useState("");

  // Se lee después de montar: en el servidor no hay localStorage.
  useEffect(() => {
    setEstado(leer(clave, d));
    setListo(true);
  }, [clave, d]);

  useEffect(() => {
    if (!listo) return;
    try {
      localStorage.setItem(clave, JSON.stringify(estado));
    } catch {
      // Sin almacenamiento (modo privado): el resultado se ve, pero no se guarda.
    }
  }, [clave, estado, listo]);

  const total = d.dimensiones.reduce((s, x) => s + x.afirmaciones.length, 0);
  const respondidas = Object.values(estado.respuestas).flat().filter((v) => v !== null).length;
  const resultado = useMemo(() => calcular(d, estado.respuestas), [d, estado.respuestas]);

  const responder = (dimension: string, i: number, valor: number) => {
    setAviso("");
    setEstado((e) => ({
      ...e,
      respuestas: { ...e.respuestas, [dimension]: e.respuestas[dimension].map((v, j) => (j === i ? valor : v)) },
    }));
  };

  const revelar = () => {
    if (respondidas < total) {
      setAviso(`Te faltan ${total - respondidas} afirmaciones por responder.`);
      document.querySelector(".diagnostico-afirmacion[data-pendiente='true']")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setEstado((e) => ({ ...e, revelado: true }));
    requestAnimationFrame(() => document.getElementById("diagnostico-resultado")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const reiniciar = () => {
    if (respondidas > 0 && !window.confirm("¿Borrar tus respuestas y empezar de nuevo?")) return;
    setAviso("");
    setEstado(vacio(d));
  };

  let numero = 0;
  return (
    <section className="diagnostico" aria-labelledby={`diagnostico-${d.id}`}>
      <header className="diagnostico-encabezado">
        <h2 id={`diagnostico-${d.id}`}>{d.titulo}</h2>
        <p>{d.instrucciones}</p>
        <ol className="diagnostico-escala" aria-label="Escala">
          {d.escala.map((e) => (
            <li key={e.valor}>
              <span className="diagnostico-valor cifra">{e.valor}</span>
              <span>
                <strong>{e.texto}</strong>
                <span className="texto-suave"> · {e.detalle}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="diagnostico-avance" aria-live="polite">
          <span className="cifra">
            {respondidas}/{total}
          </span>{" "}
          respondidas
          <span className="diagnostico-barra" aria-hidden="true">
            <span style={{ transform: `scaleX(${respondidas / total})` }} />
          </span>
        </p>
      </header>

      {d.dimensiones.map((dimension, k) => {
        const valores = estado.respuestas[dimension.id];
        const completa = valores.every((v) => v !== null);
        const parcial = resultado.dimensiones[k];
        return (
          <div key={dimension.id} className="diagnostico-dimension">
            <h3>
              <span className="cifra">{String(k + 1).padStart(2, "0")}</span> {dimension.nombre}
            </h3>
            <p className="diagnostico-pregunta">{dimension.pregunta}</p>
            {dimension.afirmaciones.map((afirmacion, i) => {
              numero += 1;
              return (
                <fieldset key={i} className="diagnostico-afirmacion" data-pendiente={valores[i] === null}>
                  <legend>
                    <span className="pregunta-numero cifra">{numero}</span>
                    <span>{afirmacion}</span>
                  </legend>
                  <div className="diagnostico-opciones">
                    {d.escala.map((e) => (
                      <label key={e.valor} data-elegida={valores[i] === e.valor} title={e.texto}>
                        <input
                          type="radio"
                          name={`${d.id}-${dimension.id}-${i}`}
                          checked={valores[i] === e.valor}
                          onChange={() => responder(dimension.id, i, e.valor)}
                        />
                        <span className="cifra">{e.valor}</span>
                        <span className="diagnostico-opcion-texto">{e.texto}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
            <p className="diagnostico-subtotal">
              Puntuación:{" "}
              <span className="cifra">
                {parcial.puntos}/{parcial.maximo}
              </span>{" "}
              · {completa ? parcial.banda.texto : "Pendiente"}
            </p>
          </div>
        );
      })}

      <div className="diagnostico-acciones">
        <button type="button" className="boton" onClick={revelar}>
          Revelar mi Radar
        </button>
        <button type="button" className="boton boton-fantasma" onClick={reiniciar}>
          Reiniciar evaluación
        </button>
        {aviso && (
          <p className="diagnostico-aviso" role="alert">
            {aviso}
          </p>
        )}
      </div>

      {estado.revelado && respondidas === total && <ResultadoRadar d={d} r={resultado} />}

      <p className="diagnostico-nota texto-suave">{d.aviso}</p>
    </section>
  );
}

function ResultadoRadar({ d, r }: { d: Diagnostico; r: Resultado }) {
  return (
    <div id="diagnostico-resultado" className="diagnostico-resultado tarjeta">
      <h3>Tu Radar High Impact</h3>
      <div className="diagnostico-resultado-cuerpo">
        <Grafica r={r} />
        <div>
          <ul className="diagnostico-puntos">
            {r.dimensiones.map(({ dimension, puntos, maximo, banda }) => (
              <li key={dimension.id} data-baja={r.masBajas.includes(dimension)}>
                <span>{dimension.nombre}</span>
                <span className="cifra">
                  {puntos}/{maximo}
                </span>
                <span className="diagnostico-banda">{banda.texto}</span>
              </li>
            ))}
          </ul>
          <p className="diagnostico-total">
            Total:{" "}
            <span className="cifra">
              {r.total}/{r.maximo}
            </span>
          </p>
          <p>{r.global.texto}</p>
        </div>
      </div>
      <div className="diagnostico-empezar">
        <h4>
          {r.masBajas.length === 1
            ? `Por dónde empezar: ${r.masBajas[0].nombre}`
            : `Por dónde empezar: ${r.masBajas.map((x) => x.nombre).join(" y ")} (empatadas)`}
        </h4>
        <p>{r.masBajas.map((x) => x.descripcion).join(" ")}</p>
        <p className="texto-suave">{d.regla}</p>
      </div>
    </div>
  );
}

// Gráfica de radar: un eje por dimensión, del centro (0) al borde (el máximo).
function Grafica({ r }: { r: Resultado }) {
  const tam = 320;
  const centro = tam / 2;
  const radio = 116;
  const n = r.dimensiones.length;
  const punto = (i: number, fraccion: number) => {
    const angulo = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [centro + Math.cos(angulo) * radio * fraccion, centro + Math.sin(angulo) * radio * fraccion] as const;
  };
  const anillos = [0.25, 0.5, 0.75, 1];
  const figura = r.dimensiones.map((x, i) => punto(i, x.puntos / x.maximo).join(",")).join(" ");
  return (
    <svg
      className="diagnostico-grafica"
      // Margen a los lados para las etiquetas de los ejes izquierdo y derecho.
      viewBox={`-95 2 ${tam + 190} ${tam - 4}`}
      role="img"
      aria-label={r.dimensiones.map((x) => `${x.dimension.nombre}: ${x.puntos} de ${x.maximo}`).join("; ")}
    >
      {anillos.map((f) => (
        <polygon key={f} className="radar-anillo" points={r.dimensiones.map((_, i) => punto(i, f).join(",")).join(" ")} />
      ))}
      {r.dimensiones.map((_, i) => {
        const [x, y] = punto(i, 1);
        return <line key={i} className="radar-eje" x1={centro} y1={centro} x2={x} y2={y} />;
      })}
      <polygon className="radar-figura" points={figura} />
      {r.dimensiones.map((x, i) => {
        const [px, py] = punto(i, x.puntos / x.maximo);
        return <circle key={x.dimension.id} className="radar-punto" cx={px} cy={py} r={4.5} />;
      })}
      {r.dimensiones.map((x, i) => {
        const [lx, ly] = punto(i, 1.16);
        const ancla = Math.abs(lx - centro) < 4 ? "middle" : lx > centro ? "start" : "end";
        return (
          <text key={x.dimension.id} className="radar-etiqueta" x={lx} y={ly} textAnchor={ancla} dominantBaseline="middle">
            {x.dimension.corto} <tspan className="radar-cifra">{x.puntos}</tspan>
          </text>
        );
      })}
    </svg>
  );
}
