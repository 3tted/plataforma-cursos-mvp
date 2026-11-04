"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api, fechaCorta } from "@/lib/cliente";
import {
  calcular,
  diagnostico as buscarDiagnostico,
  mensajeDeResultado,
  type Diagnostico,
  type Resultado,
} from "@/lib/diagnosticos";
import type { AgendaComunidad, ResultadoDiagnostico } from "@/lib/tipos";
import AgendarSesion from "./AgendarSesion";
import { useApp } from "./Contexto";
import { IconoDescargar } from "./Iconos";

// Diagnóstico de autoevaluación dentro de una lección (por ejemplo, el Radar
// de Liderazgo High Impact de INCREASE): afirmaciones del 1 al 5 agrupadas por
// dimensión, una gráfica de radar con el resultado, por dónde empezar y la
// invitación a agendar con la coach. No cuenta como examen. Las respuestas se
// recuerdan en el navegador; al revelar el resultado, el de un alumno con
// cuenta se guarda en el servidor para que el equipo de la empresa lo vea.
// En la página pública de la empresa (/radar/<empresa>) se responde sin
// cuenta: se ve el resultado completo y se piden nombre y WhatsApp o correo
// para guardarlo y agendar. Si después crea su cuenta en el mismo navegador,
// su resultado pasa solo a la lección.

type ResultadoGuardado = Omit<ResultadoDiagnostico, "cuenta">

interface Guardado {
  respuestas: Record<string, (number | null)[]>;
  revelado: boolean;
}

const vacio = (d: Diagnostico): Guardado => ({
  respuestas: Object.fromEntries(d.dimensiones.map((x) => [x.id, x.afirmaciones.map(() => null)])),
  revelado: false,
});

/** Lo que se respondió sin cuenta (en la página pública o en la lección). */
const claveVisitante = (d: Diagnostico) => `diagnostico:${d.id}:visitante`;

const sinRespuestas = (g: Guardado) => Object.values(g.respuestas).flat().every((v) => v === null);
const completo = (g: Guardado) => Object.values(g.respuestas).flat().every((v) => v !== null);

/** Lo que necesita la página pública: la empresa, su comunidad y su agenda. */
export interface RadarPublico {
  empresa: string;
  coach: string;
  comunidad: string;
  agenda?: AgendaComunidad;
}

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

export default function DiagnosticoRadar({ id, leccion }: { id: string; leccion: string }) {
  const d = buscarDiagnostico(id);
  if (!d) return null;
  return <Radar d={d} leccion={leccion} />;
}

/** El diagnóstico en la página pública de la empresa, sin cuenta. */
export function DiagnosticoPublico({ id, publico }: { id: string; publico: RadarPublico }) {
  const d = buscarDiagnostico(id);
  if (!d) return null;
  return <Radar d={d} publico={publico} />;
}

function Radar({ d, leccion, publico }: { d: Diagnostico; leccion?: string; publico?: RadarPublico }) {
  const { usuario: conCuenta, pedirEntrada } = useApp();
  // En la página pública todo es como visitante, aunque haya sesión abierta.
  const usuario = publico ? null : conCuenta;
  const clave = usuario ? `diagnostico:${d.id}:${usuario.correo}` : claveVisitante(d);
  const [estado, setEstado] = useState<Guardado>(() => vacio(d));
  const [listo, setListo] = useState(false);
  const [aviso, setAviso] = useState("");
  // null: todavía no se sabe; el equipo de la empresa ve los resultados de sus alumnos.
  const [equipo, setEquipo] = useState<ResultadoGuardado[] | null>(null);
  const [guardado, setGuardado] = useState<"si" | "no" | "error" | null>(null);
  const ruta = `/api/diagnostico?leccion=${encodeURIComponent(leccion ?? "")}&diagnostico=${encodeURIComponent(d.id)}`;

  const guardar = (respuestas: Guardado["respuestas"]) => {
    setGuardado(null);
    api<{ guardado: boolean }>("/api/diagnostico", {
      method: "POST",
      json: { leccion, diagnostico: d.id, respuestas },
    })
      .then((r) => setGuardado(r.guardado ? "si" : "no"))
      .catch(() => setGuardado("error"));
  };
  const guardarRef = useRef(guardar);
  guardarRef.current = guardar;

  // Se lee después de montar: en el servidor no hay localStorage. Con cuenta,
  // lo guardado en el servidor gana (por ejemplo, si lo hizo en otro dispositivo).
  useEffect(() => {
    let vigente = true;
    let local = leer(clave, d);
    // Lo respondió sin cuenta (en la página pública) y luego entró: se lo trae.
    if (usuario && sinRespuestas(local)) {
      const visita = leer(claveVisitante(d), d);
      if (!sinRespuestas(visita)) local = visita;
    }
    setEstado(local);
    setListo(true);
    if (!usuario || !leccion) return;
    api<{ equipo: boolean; resultados?: ResultadoGuardado[]; resultado?: ResultadoGuardado | null }>(ruta)
      .then((r) => {
        if (!vigente) return;
        if (r.equipo) setEquipo(r.resultados ?? []);
        else if (r.resultado) {
          setGuardado("si");
          if (!local.revelado) setEstado({ respuestas: r.resultado.respuestas, revelado: true });
        } else if (local.revelado && completo(local)) {
          // Ya lo había revelado antes de tener cuenta: se guarda para su coach.
          guardarRef.current(local.respuestas);
        }
      })
      .catch(() => {
        // Sin conexión: se queda lo de este navegador.
      });
    return () => {
      vigente = false;
    };
  }, [clave, d, ruta, usuario, leccion]);

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
    if (!usuario || equipo || !leccion) return;
    guardar(estado.respuestas);
  };

  const reiniciar = () => {
    if (respondidas > 0 && !window.confirm("¿Borrar tus respuestas y empezar de nuevo?")) return;
    setAviso("");
    setGuardado(null);
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

      {estado.revelado && respondidas === total && (
        <>
          <ResultadoRadar d={d} r={resultado} />
          {publico && <ContactoRadar d={d} r={resultado} respuestas={estado.respuestas} publico={publico} />}
          {!equipo && !publico && (
            <p className="diagnostico-guardado" role="status">
              {!usuario ? (
                <>
                  <button type="button" className="enlace" onClick={() => pedirEntrada("alumno")}>
                    Entra a tu cuenta
                  </button>{" "}
                  para guardar tu resultado y que tu coach lo vea.
                </>
              ) : guardado === "si" ? (
                "Tu resultado quedó guardado: tu coach lo puede ver para acompañarte."
              ) : guardado === "error" ? (
                "No pudimos guardar tu resultado. Revisa tu conexión y vuelve a tocar «Revelar mi Radar»."
              ) : null}
            </p>
          )}
          {d.cta && !publico && (
            <AgendarSesion
              titulo={d.cta.titulo}
              texto={d.cta.texto}
              mensaje={mensajeDeResultado(d, resultado, usuario?.nombre ?? "")}
            />
          )}
        </>
      )}

      {equipo && <ResultadosEquipo d={d} resultados={equipo} />}

      <p className="diagnostico-nota texto-suave">{d.aviso}</p>
    </section>
  );
}

interface Contacto {
  nombre: string;
  whatsapp: string;
  correo: string;
}

// En la página pública, después del resultado: nombre y WhatsApp o correo para
// guardarlo y que el equipo de la empresa le dé seguimiento. Ya enviado, se ven
// los botones para agendar y la invitación a seguir con el curso gratis. Los
// datos se recuerdan en este navegador; si vuelve a revelar su Radar con otras
// respuestas, se actualiza solo.
function ContactoRadar({
  d,
  r,
  respuestas,
  publico,
}: {
  d: Diagnostico;
  r: Resultado;
  respuestas: Guardado["respuestas"];
  publico: RadarPublico;
}) {
  const clave = `radar-contacto:${publico.empresa}`;
  const [forma, setForma] = useState<Contacto>({ nombre: "", whatsapp: "", correo: "" });
  const [guardado, setGuardado] = useState<Contacto | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const enviadas = useRef("");
  const firma = JSON.stringify(respuestas);

  const enviar = async (contacto: Contacto) => {
    await api("/api/radar/" + encodeURIComponent(publico.empresa), {
      method: "POST",
      json: { ...contacto, respuestas },
    });
    enviadas.current = firma;
  };

  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem(clave) ?? "null") as (Contacto & { firma?: string }) | null;
      if (g?.nombre) {
        setGuardado(g);
        setForma(g);
        enviadas.current = g.firma ?? "";
      }
    } catch {
      // Sin almacenamiento: se piden los datos otra vez.
    }
  }, [clave]);

  // Volvió a revelar con otras respuestas: se actualiza lo que ve la coach.
  useEffect(() => {
    if (!guardado || enviadas.current === firma) return;
    enviar(guardado)
      .then(() => {
        try {
          localStorage.setItem(clave, JSON.stringify({ ...guardado, firma }));
        } catch {
          // Nada: ya quedó guardado en el servidor.
        }
      })
      .catch(() => {
        // Se intenta de nuevo la próxima vez que lo revele.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardado, firma]);

  const alEnviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!forma.nombre.trim()) return setError("Escribe tu nombre.");
    if (!forma.whatsapp.trim() && !forma.correo.trim()) return setError("Déjanos tu WhatsApp o tu correo.");
    setError("");
    setEnviando(true);
    try {
      const contacto = { nombre: forma.nombre.trim(), whatsapp: forma.whatsapp.trim(), correo: forma.correo.trim() };
      await enviar(contacto);
      try {
        localStorage.setItem(clave, JSON.stringify({ ...contacto, firma }));
      } catch {
        // Sin almacenamiento: ya quedó guardado en el servidor.
      }
      setGuardado(contacto);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  if (!guardado) {
    return (
      <form className="radar-contacto tarjeta" onSubmit={alEnviar} noValidate>
        <h3>Guarda tu resultado y agenda tu sesión</h3>
        <p>
          Déjanos tu nombre y tu WhatsApp o correo. {publico.coach} recibe tu Radar para preparar tu Sesión de Claridad
          Estratégica, y tú ves los botones para agendarla.
        </p>
        <label className="campo">
          <span>Tu nombre</span>
          <input
            value={forma.nombre}
            onChange={(e) => setForma({ ...forma, nombre: e.target.value })}
            maxLength={80}
            autoComplete="name"
            required
          />
        </label>
        <div className="radar-contacto-fila">
          <label className="campo">
            <span>WhatsApp</span>
            <input
              value={forma.whatsapp}
              onChange={(e) => setForma({ ...forma, whatsapp: e.target.value })}
              inputMode="tel"
              autoComplete="tel"
              maxLength={20}
              placeholder="10 dígitos"
            />
          </label>
          <label className="campo">
            <span>o correo</span>
            <input
              type="email"
              value={forma.correo}
              onChange={(e) => setForma({ ...forma, correo: e.target.value })}
              autoComplete="email"
              maxLength={120}
            />
          </label>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="radar-contacto-acciones">
          <button type="submit" className="boton" disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar mi resultado"}
          </button>
          <span className="texto-suave">Tus datos solo los ve el equipo de {publico.coach} para contactarte.</span>
        </div>
      </form>
    );
  }

  const nombre = guardado.nombre.split(" ")[0];
  return (
    <>
      <p className="diagnostico-guardado" role="status">
        Listo, {nombre}: tu resultado quedó guardado y {publico.coach} ya lo puede ver.{" "}
        <button type="button" className="enlace" onClick={() => setGuardado(null)}>
          Cambiar mis datos
        </button>
      </p>
      {d.cta && (
        <AgendarSesion
          titulo={d.cta.titulo}
          texto={d.cta.texto}
          mensaje={mensajeDeResultado(d, r, guardado.nombre)}
          publico={{ agenda: publico.agenda }}
        />
      )}
      <aside className="radar-reto">
        <div>
          <h3>Sigue con el reto de 7 días, gratis</h3>
          <p>
            Trabaja tu dimensión más baja con una acción de 15 a 25 minutos al día. Crea tu cuenta desde este mismo
            navegador y tu Radar pasa solo a tu curso.
          </p>
        </div>
        <Link className="boton boton-secundario" href={`/c/${publico.comunidad}`}>
          Empezar el reto
        </Link>
      </aside>
    </>
  );
}

// Lo que ve el equipo de la empresa: el resultado de cada alumno, con su
// dimensión más baja, para darle seguimiento. Se puede descargar en CSV.
function ResultadosEquipo({ d, resultados }: { d: Diagnostico; resultados: ResultadoGuardado[] }) {
  const nombre = (id: string) => d.dimensiones.find((x) => x.id === id)?.nombre ?? id;
  const maximo = d.dimensiones.reduce((s, x) => s + x.afirmaciones.length, 0) * Math.max(...d.escala.map((e) => e.valor));

  const descargar = () => {
    const celda = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
    const filas = [
      ["Alumno", "Correo", "Fecha", ...d.dimensiones.map((x) => x.nombre), "Total", "Dimensión más baja"],
      ...resultados.map((r) => [
        r.autor,
        r.correo,
        r.actualizadoEn.slice(0, 10),
        ...d.dimensiones.map((x) => r.puntos[x.id] ?? ""),
        r.total,
        r.masBajas.map(nombre).join(" y "),
      ]),
    ];
    const csv = "﻿" + filas.map((f) => f.map(celda).join(",")).join("\r\n");
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    enlace.download = `${d.id}-resultados.csv`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  };

  return (
    <section className="diagnostico-equipo tarjeta" aria-labelledby="diagnostico-equipo-titulo">
      <div className="diagnostico-equipo-encabezado">
        <h3 id="diagnostico-equipo-titulo">
          Resultados de tus alumnos <span className="cifra">{resultados.length}</span>
        </h3>
        {resultados.length > 0 && (
          <button type="button" className="boton boton-fantasma" onClick={descargar}>
            <IconoDescargar width={16} height={16} /> Descargar en Excel (CSV)
          </button>
        )}
      </div>
      {resultados.length === 0 ? (
        <p className="texto-suave">
          Todavía nadie revela su Radar. Cuando un alumno lo haga, aquí verás su resultado y su dimensión más baja.
        </p>
      ) : (
        <div className="diagnostico-tabla">
          <table>
            <thead>
              <tr>
                <th scope="col">Alumno</th>
                {d.dimensiones.map((x) => (
                  <th key={x.id} scope="col">
                    {x.corto}
                  </th>
                ))}
                <th scope="col">Total</th>
                <th scope="col">Por dónde empezar</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((r) => (
                <tr key={r.id}>
                  <th scope="row">
                    {r.autor}
                    <span className="texto-suave">
                      {r.correo} · {fechaCorta(r.actualizadoEn)}
                    </span>
                  </th>
                  {d.dimensiones.map((x) => (
                    <td key={x.id} className="cifra" data-baja={r.masBajas.includes(x.id)}>
                      {r.puntos[x.id]}
                    </td>
                  ))}
                  <td className="cifra">
                    {r.total}/{maximo}
                  </td>
                  <td>{r.masBajas.map(nombre).join(" y ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
