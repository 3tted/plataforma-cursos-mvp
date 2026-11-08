"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DiagnosticoVistaPrevia } from "@/components/DiagnosticoRadar";
import { IconoAsistenteGeneral, IconoBorrar, IconoFlechaIzq, IconoPregunta } from "@/components/Iconos";
import { olvidarDiagnostico } from "@/components/useDiagnostico";
import { useTitulo } from "@/components/useTitulo";
import { api } from "@/lib/cliente";
import {
  CTA_COACH,
  LIMITES,
  maximoDe,
  preguntasDe,
  problemasDe,
  RANGOS_AREA,
  totalPreguntas,
  type Banda,
  type Diagnostico,
  type Dimension,
  type PreguntaDiagnostico,
} from "@/lib/diagnosticos";

// Editor de un diagnóstico del coach: el cuestionario con el que empieza su
// curso. Al abrir uno nuevo elige cómo armarlo: con una guía paso a paso, con
// la IA o él mismo. A un lado siempre tiene ayuda: consejos, la guía, y la IA
// para armarlo, sugerir preguntas o revisar las suyas.

interface Datos {
  diagnostico: Diagnostico;
  problemas: string[];
  publicado: boolean;
  conCambios: boolean;
  curso: { id: string; titulo: string; estado: string; primerPaso: boolean } | null;
  ia: boolean;
}

type Revision = {
  general: string;
  sugerencias: { area: string; numero: number; pregunta: string; problema: string; propuesta: string }[];
};

type Modo = "inicio" | "guia" | "ia" | "editor";

const opcionesNuevas = () => [
  { texto: "", puntos: 0 },
  { texto: "", puntos: 1 },
  { texto: "", puntos: 2 },
];

export default function EditorDiagnostico() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [d, setD] = useState<Diagnostico | null>(null);
  const [guardadoJson, setGuardadoJson] = useState("");
  const [primerPaso, setPrimerPaso] = useState(true);
  const [modo, setModo] = useState<Modo>("editor");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [vista, setVista] = useState(false);
  useTitulo(d?.titulo || "Diagnóstico");

  useEffect(() => {
    api<Datos>(`/api/coach/diagnosticos/${encodeURIComponent(id)}`)
      .then((r) => {
        setDatos(r);
        setD(r.diagnostico);
        setGuardadoJson(JSON.stringify(r.diagnostico));
        setPrimerPaso(r.curso ? r.curso.primerPaso || !r.publicado : false);
        // Uno recién creado (sin preguntas escritas) empieza eligiendo cómo armarlo.
        const vacio = r.diagnostico.dimensiones.every((x) => preguntasDe(x).every((p) => !p.texto));
        setModo(vacio && !r.publicado ? "inicio" : "editor");
      })
      .catch((e) => setError((e as Error).message));
  }, [id]);

  const problemas = useMemo(() => (d ? problemasDe(d) : []), [d]);
  const sinGuardar = !!d && (JSON.stringify(d) !== guardadoJson || (datos?.curso && primerPaso !== datos.curso.primerPaso));

  // Avisa antes de salir con cambios sin guardar.
  useEffect(() => {
    if (!sinGuardar) return;
    const alSalir = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, [sinGuardar]);

  if (error && !datos) {
    return (
      <div className="pagina-estrecha">
        <h1>No pudimos abrir el diagnóstico</h1>
        <p className="texto-suave">{error}</p>
        <Link href="/coach/comunidades" className="boton boton-secundario">
          Volver a mis cursos
        </Link>
      </div>
    );
  }
  if (!datos || !d) return <p className="texto-suave">Cargando el diagnóstico…</p>;

  const cambiar = (f: (x: Diagnostico) => Diagnostico) => {
    setAviso(null);
    setD((x) => (x ? f(x) : x));
  };
  const cambiarArea = (i: number, f: (x: Dimension) => Dimension) =>
    cambiar((x) => ({ ...x, dimensiones: x.dimensiones.map((dim, k) => (k === i ? f(dim) : dim)) }));
  const cambiarPregunta = (i: number, j: number, f: (p: PreguntaDiagnostico) => PreguntaDiagnostico) =>
    cambiarArea(i, (dim) => ({ ...dim, preguntas: preguntasDe(dim).map((p, k) => (k === j ? f(p) : p)) }));

  const variasAreas = d.dimensiones.length > 1;
  const volver = datos.curso ? `/coach/curso/${datos.curso.id}` : "/coach/comunidades";

  const guardar = async () => {
    setError(null);
    setAviso(null);
    setOcupado("guardar");
    try {
      const r = await api<{ problemas: string[]; publicado: boolean; conCambios: boolean; primerPaso: boolean }>(
        `/api/coach/diagnosticos/${encodeURIComponent(id)}`,
        // Sin invitación se manda null (si no, el servidor pondría la de siempre).
        { method: "PUT", json: { diagnostico: { ...d, cta: d.cta ?? null }, primerPaso } },
      );
      olvidarDiagnostico(id);
      setGuardadoJson(JSON.stringify(d));
      setDatos((x) => (x ? { ...x, publicado: r.publicado, conCambios: r.conCambios, curso: x.curso && { ...x.curso, primerPaso: r.primerPaso } } : x));
      setPrimerPaso(r.primerPaso || (primerPaso && r.problemas.length > 0));
      setAviso(
        r.problemas.length > 0
          ? r.publicado
            ? "Guardado. Tus alumnos siguen viendo la versión anterior hasta que completes lo que falta."
            : "Guardado como borrador. Completa lo que falta para que tus alumnos lo vean."
          : r.primerPaso
            ? "Guardado. Ya es la primera lección del curso: tus alumnos lo responden antes de seguir."
            : "Guardado. Está completo.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(null);
    }
  };

  const borrar = async () => {
    if (!window.confirm("¿Borrar este diagnóstico? Se quita del curso. Los resultados que ya tienes de tus alumnos se quedan.")) return;
    setOcupado("borrar");
    try {
      await api(`/api/coach/diagnosticos/${encodeURIComponent(id)}`, { method: "DELETE" });
      router.push(volver);
    } catch (e) {
      setError((e as Error).message);
      setOcupado(null);
    }
  };

  const ia = async <T,>(clave: string, json: Record<string, unknown>): Promise<T | null> => {
    setError(null);
    setOcupado(clave);
    try {
      return await api<T>(`/api/coach/diagnosticos/${encodeURIComponent(id)}/ia`, { method: "POST", json });
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setOcupado(null);
    }
  };

  const usarPropuesta = (nuevo: Diagnostico) => {
    setD({ ...nuevo, cta: d.cta === undefined ? undefined : (d.cta ?? CTA_COACH) });
    setRevision(null);
    setModo("editor");
    setAviso("La IA armó este borrador. Revísalo: cambia lo que no suene a ti y luego guárdalo.");
  };

  const ponerVariasAreas = (si: boolean) => {
    if (si === variasAreas) return;
    if (si) {
      cambiar((x) => ({
        ...x,
        dimensiones: [
          { ...x.dimensiones[0], nombre: x.dimensiones[0].nombre || "Área 1" },
          { id: `a${Date.now()}`, nombre: "Área 2", corto: "", descripcion: "", pregunta: "", afirmaciones: [], preguntas: [{ texto: "" }] },
        ],
        porDimension: x.porDimension.length ? x.porDimension : RANGOS_AREA,
      }));
    } else {
      if (!window.confirm("¿Juntar todas las preguntas en un solo puntaje? Se quitan los nombres de las áreas.")) return;
      cambiar((x) => ({
        ...x,
        dimensiones: [{ ...x.dimensiones[0], nombre: "", corto: "", preguntas: x.dimensiones.flatMap(preguntasDe) }],
      }));
    }
  };

  const total = totalPreguntas(d);
  let numero = 0;

  return (
    <div className="diag-editor">
      <div className="editor-barra diag-editor-barra">
        <Link href={volver} className="volver">
          <IconoFlechaIzq width={16} height={16} /> {datos.curso?.titulo ? `Volver a «${datos.curso.titulo}»` : "Volver"}
        </Link>
      </div>

      <header className="cabecera-pagina">
        <p className="coaches-etiqueta">Diagnóstico de inicio{datos.curso?.titulo ? ` · ${datos.curso.titulo}` : ""}</p>
        <h1>{d.titulo || "Tu diagnóstico"}</h1>
        <p className="texto-suave">
          Un cuestionario corto con el que tu alumno empieza el curso. Cada respuesta suma puntos; al final ve su
          resultado y por dónde le conviene empezar.
        </p>
      </header>

      {modo === "inicio" && <Inicio ia={datos.ia} alElegir={setModo} />}
      {modo === "guia" && (
        <Guia
          ia={datos.ia}
          alTerminar={(siguiente) => setModo(siguiente)}
        />
      )}
      {modo === "ia" && (
        <FormaIA
          ocupado={ocupado === "generar"}
          error={error}
          conPreguntas={total > 0 && !d.dimensiones.every((x) => preguntasDe(x).every((p) => !p.texto))}
          alGenerar={async (pedido) => {
            const r = await ia<{ diagnostico: Diagnostico }>("generar", { accion: "generar", ...pedido });
            if (r) usarPropuesta(r.diagnostico);
          }}
          alCancelar={() => setModo(total > 0 ? "editor" : "inicio")}
        />
      )}

      {modo === "editor" && (
        <div className="diag-editor-rejilla">
          <div className="diag-editor-principal">
            {aviso && (
              <p className="aviso" role="status">
                {aviso}
              </p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            <section className="tarjeta editor-seccion" aria-labelledby="diag-datos">
              <h2 id="diag-datos">1. De qué trata</h2>
              <label className="campo">
                <span>Título</span>
                <input
                  value={d.titulo}
                  onChange={(e) => cambiar((x) => ({ ...x, titulo: e.target.value }))}
                  maxLength={120}
                  placeholder="Por ejemplo: ¿Qué tan listo está tu negocio para vender en línea?"
                />
              </label>
              <label className="campo">
                <span>Instrucciones para tu alumno</span>
                <textarea
                  rows={2}
                  value={d.instrucciones}
                  onChange={(e) => cambiar((x) => ({ ...x, instrucciones: e.target.value }))}
                  maxLength={600}
                  placeholder="Responde según lo que haces normalmente, no según lo que te gustaría hacer."
                />
              </label>
              <fieldset className="diag-forma">
                <legend>¿Cómo se calcula el resultado?</legend>
                <label className="metodo" data-activo={!variasAreas}>
                  <input type="radio" name="forma" checked={!variasAreas} onChange={() => ponerVariasAreas(false)} />
                  <span className="metodo-nombre">Un solo puntaje</span>
                  <span className="texto-suave">Todas las preguntas suman a un total, con su nivel.</span>
                </label>
                <label className="metodo" data-activo={variasAreas}>
                  <input type="radio" name="forma" checked={variasAreas} onChange={() => ponerVariasAreas(true)} />
                  <span className="metodo-nombre">Por áreas</span>
                  <span className="texto-suave">Agrupas las preguntas por tema y el alumno ve cuál es su área más baja (con gráfica desde 3 áreas).</span>
                </label>
              </fieldset>
            </section>

            <section className="editor-seccion" aria-labelledby="diag-preguntas">
              <h2 id="diag-preguntas">2. Preguntas</h2>
              {d.dimensiones.map((dim, i) => (
                <div key={dim.id} className="tarjeta diag-area">
                  {variasAreas && (
                    <div className="diag-area-cabecera">
                      <label className="campo">
                        <span>Área {i + 1}</span>
                        <input
                          value={dim.nombre}
                          onChange={(e) => cambiarArea(i, (x) => ({ ...x, nombre: e.target.value }))}
                          maxLength={60}
                          placeholder="Por ejemplo: Ventas"
                        />
                      </label>
                      {d.dimensiones.length > 2 && (
                        <button
                          type="button"
                          className="boton-icono"
                          aria-label={`Quitar el área ${dim.nombre || i + 1}`}
                          title="Quitar el área"
                          onClick={() => {
                            if (!window.confirm(`¿Quitar el área «${dim.nombre || i + 1}» y sus preguntas?`)) return;
                            cambiar((x) => ({ ...x, dimensiones: x.dimensiones.filter((_, k) => k !== i) }));
                          }}
                        >
                          <IconoBorrar width={17} height={17} />
                        </button>
                      )}
                    </div>
                  )}
                  {variasAreas && (
                    <label className="campo">
                      <span>Si es su área más baja, ¿qué le recomiendas?</span>
                      <textarea
                        rows={2}
                        value={dim.descripcion}
                        onChange={(e) => cambiarArea(i, (x) => ({ ...x, descripcion: e.target.value }))}
                        maxLength={600}
                        placeholder="Por ejemplo: Empieza por el módulo 2: ahí armas tu lista de clientes y tu primer mensaje de venta."
                      />
                    </label>
                  )}
                  <ol className="diag-preguntas">
                    {preguntasDe(dim).map((p, j) => {
                      numero += 1;
                      return (
                        <li key={j} className="diag-pregunta">
                          <div className="diag-pregunta-fila">
                            <span className="pregunta-numero cifra">{numero}</span>
                            <textarea
                              rows={2}
                              aria-label={`Pregunta ${numero}`}
                              value={p.texto}
                              onChange={(e) => cambiarPregunta(i, j, (x) => ({ ...x, texto: e.target.value }))}
                              maxLength={300}
                              placeholder={
                                p.opciones
                                  ? "Por ejemplo: ¿Cada cuánto revisas tus ventas?"
                                  : "Por ejemplo: Reviso mis ventas cada semana."
                              }
                            />
                            <button
                              type="button"
                              className="boton-icono"
                              aria-label={`Quitar la pregunta ${numero}`}
                              title="Quitar la pregunta"
                              onClick={() => cambiarArea(i, (x) => ({ ...x, preguntas: preguntasDe(x).filter((_, k) => k !== j) }))}
                            >
                              <IconoBorrar width={16} height={16} />
                            </button>
                          </div>
                          <div className="diag-pregunta-tipo" role="radiogroup" aria-label={`Tipo de la pregunta ${numero}`}>
                            <button
                              type="button"
                              aria-pressed={!p.opciones}
                              onClick={() => cambiarPregunta(i, j, (x) => ({ texto: x.texto }))}
                            >
                              Escala del 1 al 5
                            </button>
                            <button
                              type="button"
                              aria-pressed={!!p.opciones}
                              onClick={() => cambiarPregunta(i, j, (x) => ({ texto: x.texto, opciones: x.opciones ?? opcionesNuevas() }))}
                            >
                              Opciones con puntos
                            </button>
                          </div>
                          {p.opciones ? (
                            <div className="diag-opciones">
                              {p.opciones.map((o, k) => (
                                <div key={k} className="diag-opcion">
                                  <input
                                    aria-label={`Opción ${k + 1} de la pregunta ${numero}`}
                                    value={o.texto}
                                    onChange={(e) =>
                                      cambiarPregunta(i, j, (x) => ({
                                        ...x,
                                        opciones: x.opciones!.map((y, m) => (m === k ? { ...y, texto: e.target.value } : y)),
                                      }))
                                    }
                                    maxLength={160}
                                    placeholder={`Opción ${k + 1}`}
                                  />
                                  <label className="diag-puntos">
                                    <input
                                      type="number"
                                      min={0}
                                      max={LIMITES.puntos}
                                      value={o.puntos}
                                      onChange={(e) =>
                                        cambiarPregunta(i, j, (x) => ({
                                          ...x,
                                          opciones: x.opciones!.map((y, m) =>
                                            m === k ? { ...y, puntos: Math.max(0, Math.min(LIMITES.puntos, Math.round(Number(e.target.value)) || 0)) } : y,
                                          ),
                                        }))
                                      }
                                    />
                                    <span>pts</span>
                                  </label>
                                  {p.opciones!.length > 2 && (
                                    <button
                                      type="button"
                                      className="boton-icono boton-icono-chico"
                                      aria-label={`Quitar la opción ${k + 1}`}
                                      onClick={() => cambiarPregunta(i, j, (x) => ({ ...x, opciones: x.opciones!.filter((_, m) => m !== k) }))}
                                    >
                                      <IconoBorrar width={14} height={14} />
                                    </button>
                                  )}
                                </div>
                              ))}
                              {p.opciones.length < LIMITES.opciones && (
                                <button
                                  type="button"
                                  className="enlace"
                                  onClick={() =>
                                    cambiarPregunta(i, j, (x) => ({
                                      ...x,
                                      opciones: [...x.opciones!, { texto: "", puntos: x.opciones!.length }],
                                    }))
                                  }
                                >
                                  + Agregar opción
                                </button>
                              )}
                              <p className="nota">La respuesta que muestra la mejor práctica da más puntos.</p>
                            </div>
                          ) : (
                            <p className="nota">Se responde de «Casi nunca» (1) a «Casi siempre» (5): escríbela para que «casi siempre» sea lo deseable.</p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                  <div className="diag-area-acciones">
                    {preguntasDe(dim).length < LIMITES.preguntasPorArea && total < LIMITES.preguntas && (
                      <button
                        type="button"
                        className="boton boton-chico boton-secundario"
                        onClick={() => cambiarArea(i, (x) => ({ ...x, preguntas: [...preguntasDe(x), { texto: "" }] }))}
                      >
                        + Agregar pregunta
                      </button>
                    )}
                    {datos.ia && (
                      <button
                        type="button"
                        className="boton boton-chico boton-fantasma-borde"
                        disabled={ocupado !== null}
                        onClick={async () => {
                          const tipo = preguntasDe(dim).some((p) => p.opciones) ? "mixto" : "escala";
                          const r = await ia<{ preguntas: PreguntaDiagnostico[] }>(`sugerir-${i}`, {
                            accion: "sugerir",
                            diagnostico: d,
                            area: i,
                            cantidad: 3,
                            tipo,
                          });
                          if (r?.preguntas.length) {
                            cambiarArea(i, (x) => ({
                              ...x,
                              preguntas: [...preguntasDe(x).filter((p) => p.texto), ...r.preguntas].slice(0, LIMITES.preguntasPorArea),
                            }));
                            setAviso(`La IA agregó ${r.preguntas.length} preguntas${dim.nombre ? ` en «${dim.nombre}»` : ""}. Revísalas o quítalas.`);
                          }
                        }}
                      >
                        <IconoAsistenteGeneral width={15} height={15} /> {ocupado === `sugerir-${i}` ? "Pensando…" : "Sugerir preguntas con IA"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {variasAreas && d.dimensiones.length < LIMITES.areas && (
                <button
                  type="button"
                  className="boton boton-secundario"
                  onClick={() =>
                    cambiar((x) => ({
                      ...x,
                      dimensiones: [
                        ...x.dimensiones,
                        {
                          id: `a${Date.now()}`,
                          nombre: "",
                          corto: "",
                          descripcion: "",
                          pregunta: "",
                          afirmaciones: [],
                          preguntas: [{ texto: "" }],
                        },
                      ],
                    }))
                  }
                >
                  + Agregar área
                </button>
              )}
            </section>

            <section className="tarjeta editor-seccion" aria-labelledby="diag-resultados">
              <h2 id="diag-resultados">3. Resultados</h2>
              <p className="texto-suave">
                En porcentaje del puntaje máximo ({maximoDe(d)} puntos con tus preguntas de hoy). Así, si después agregas o
                quitas preguntas, los rangos siguen funcionando.
              </p>
              <Rangos
                titulo="Resultado general: lo que lee tu alumno"
                rangos={d.global}
                largo
                alCambiar={(global) => cambiar((x) => ({ ...x, global }))}
              />
              {variasAreas && (
                <Rangos
                  titulo="Nivel de cada área (una etiqueta corta)"
                  rangos={d.porDimension}
                  alCambiar={(porDimension) => cambiar((x) => ({ ...x, porDimension }))}
                />
              )}
            </section>

            <section className="tarjeta editor-seccion" aria-labelledby="diag-final">
              <h2 id="diag-final">4. Al terminar</h2>
              <label className="casilla">
                <input
                  type="checkbox"
                  checked={!!d.cta}
                  onChange={(e) => cambiar((x) => ({ ...x, cta: e.target.checked ? CTA_COACH : undefined }))}
                />
                Invitarlo a agendar una sesión contigo (con tu WhatsApp o tu agenda)
              </label>
              {d.cta && (
                <>
                  <label className="campo">
                    <span>Título de la invitación</span>
                    <input
                      value={d.cta.titulo}
                      maxLength={140}
                      onChange={(e) => cambiar((x) => ({ ...x, cta: { ...(x.cta ?? CTA_COACH), titulo: e.target.value } }))}
                    />
                  </label>
                  <label className="campo">
                    <span>Texto</span>
                    <textarea
                      rows={2}
                      value={d.cta.texto}
                      maxLength={600}
                      onChange={(e) => cambiar((x) => ({ ...x, cta: { ...(x.cta ?? CTA_COACH), texto: e.target.value } }))}
                    />
                  </label>
                </>
              )}
              <label className="campo">
                <span>Nota al pie (opcional)</span>
                <input
                  value={d.aviso}
                  maxLength={400}
                  onChange={(e) => cambiar((x) => ({ ...x, aviso: e.target.value }))}
                  placeholder="Por ejemplo: Es una autoevaluación orientativa, no una evaluación profesional."
                />
              </label>
            </section>

            <section className="editor-seccion" aria-labelledby="diag-vista">
              <div className="diag-vista-cabecera">
                <h2 id="diag-vista">5. Pruébalo como alumno</h2>
                <button type="button" className="boton boton-chico boton-secundario" onClick={() => setVista(!vista)} aria-expanded={vista}>
                  {vista ? "Ocultar vista previa" : "Ver vista previa"}
                </button>
              </div>
              {vista && (
                <div className="diag-vista">
                  {problemas.length > 0 && <p className="nota">Todavía le faltan detalles: la vista previa puede verse incompleta.</p>}
                  <DiagnosticoVistaPrevia d={d} />
                </div>
              )}
            </section>
          </div>

          <aside className="diag-ayuda" aria-label="Ayuda">
            <div className="tarjeta diag-ayuda-tarjeta">
              <h2>
                <IconoPregunta width={18} height={18} /> ¿Necesitas ayuda?
              </h2>
              <button type="button" className="boton boton-chico boton-secundario boton-bloque" onClick={() => setModo("guia")}>
                Ver la guía para hacer buenas preguntas
              </button>
              {datos.ia ? (
                <>
                  <button
                    type="button"
                    className="boton boton-chico boton-fantasma-borde boton-bloque"
                    disabled={ocupado !== null}
                    onClick={async () => {
                      const r = await ia<{ revision: Revision }>("revisar", { accion: "revisar", diagnostico: d });
                      if (r) setRevision(r.revision);
                    }}
                  >
                    <IconoAsistenteGeneral width={15} height={15} /> {ocupado === "revisar" ? "Revisando…" : "Que la IA revise mis preguntas"}
                  </button>
                  <button type="button" className="boton boton-chico boton-fantasma-borde boton-bloque" onClick={() => setModo("ia")}>
                    <IconoAsistenteGeneral width={15} height={15} /> Que la IA lo arme todo
                  </button>
                </>
              ) : (
                <p className="nota">La IA no está conectada ahora: puedes armarlo con la guía.</p>
              )}
              {revision && (
                <div className="diag-revision" role="status">
                  <h3>Lo que dice la IA</h3>
                  {revision.general && <p>{revision.general}</p>}
                  {revision.sugerencias.length === 0 ? (
                    <p className="texto-suave">Tus preguntas están bien escritas.</p>
                  ) : (
                    <ul>
                      {revision.sugerencias.map((s, k) => (
                        <li key={k}>
                          <p>
                            <strong>Pregunta {s.numero}:</strong> {s.problema}
                          </p>
                          <p className="diag-revision-propuesta">«{s.propuesta}»</p>
                          <button
                            type="button"
                            className="enlace"
                            onClick={() => {
                              // Cambia la pregunta con ese número (en el orden en que se ven).
                              let n = 0;
                              cambiar((x) => ({
                                ...x,
                                dimensiones: x.dimensiones.map((dim) => ({
                                  ...dim,
                                  preguntas: preguntasDe(dim).map((p) => {
                                    if (!p.texto) return p;
                                    n += 1;
                                    return n === s.numero ? { ...p, texto: s.propuesta } : p;
                                  }),
                                })),
                              }));
                              setRevision((r) => (r ? { ...r, sugerencias: r.sugerencias.filter((_, m) => m !== k) } : r));
                            }}
                          >
                            Usar esta versión
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button type="button" className="enlace enlace-discreto" onClick={() => setRevision(null)}>
                    Cerrar
                  </button>
                </div>
              )}
            </div>
            <div className="tarjeta diag-ayuda-tarjeta">
              <h2>Consejos rápidos</h2>
              <ul className="diag-consejos">
                <li>Pregunta por lo que tu alumno <strong>hace</strong>, no por lo que cree de sí mismo.</li>
                <li>Una sola idea por pregunta: nada de «y» ni «o».</li>
                <li>Que no se note cuál es la respuesta «buena».</li>
                <li>De 8 a 20 preguntas: se responde en 3 a 7 minutos.</li>
                <li>Mide lo que tu curso enseña: así el resultado le dice por dónde empezar.</li>
              </ul>
            </div>
          </aside>
        </div>
      )}

      {modo === "editor" && (
        <div className="diag-guardar" role="region" aria-label="Guardar el diagnóstico">
          <div className="diag-guardar-estado">
            {problemas.length > 0 ? (
              <details>
                <summary>
                  Le {problemas.length === 1 ? "falta 1 detalle" : `faltan ${problemas.length} detalles`} para que tus alumnos lo vean
                </summary>
                <ul>
                  {problemas.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </details>
            ) : (
              <span className="texto-suave">
                Completo · {total} {total === 1 ? "pregunta" : "preguntas"}
              </span>
            )}
            {datos.curso && (
              <label className="casilla">
                <input type="checkbox" checked={primerPaso} onChange={(e) => setPrimerPaso(e.target.checked)} />
                Que sea el primer paso del curso
              </label>
            )}
          </div>
          <div className="diag-guardar-acciones">
            <button type="button" className="enlace enlace-discreto" onClick={() => void borrar()} disabled={ocupado !== null}>
              Borrar diagnóstico
            </button>
            <button type="button" className="boton" onClick={() => void guardar()} disabled={!sinGuardar || ocupado !== null}>
              {ocupado === "guardar" ? "Guardando…" : sinGuardar ? "Guardar" : "Guardado"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- al empezar

function Inicio({ ia, alElegir }: { ia: boolean; alElegir: (m: Modo) => void }) {
  return (
    <section className="diag-inicio" aria-labelledby="diag-inicio-titulo">
      <h2 id="diag-inicio-titulo">¿Cómo quieres armarlo?</h2>
      <div className="diag-inicio-opciones">
        <button type="button" className="tarjeta diag-inicio-opcion" onClick={() => alElegir("guia")}>
          <IconoPregunta width={24} height={24} />
          <strong>Guíame primero</strong>
          <span className="texto-suave">Una guía corta de cómo hacer buenas preguntas, con ejemplos. Al final eliges cómo seguir.</span>
        </button>
        {ia && (
          <button type="button" className="tarjeta diag-inicio-opcion" onClick={() => alElegir("ia")}>
            <IconoAsistenteGeneral width={24} height={24} />
            <strong>Que la IA lo arme</strong>
            <span className="texto-suave">Le dices qué quieres medir y te propone las preguntas, los puntos y los resultados. Tú lo ajustas.</span>
          </button>
        )}
        <button type="button" className="tarjeta diag-inicio-opcion" onClick={() => alElegir("editor")}>
          <span className="diag-inicio-icono" aria-hidden="true">✎</span>
          <strong>Lo hago yo</strong>
          <span className="texto-suave">Escribes tus preguntas. A un lado tienes consejos y, si quieres, la IA te sugiere o revisa.</span>
        </button>
      </div>
    </section>
  );
}

const PASOS_GUIA = [
  {
    titulo: "Decide qué quieres descubrir",
    texto:
      "Piensa en qué necesitas saber de tu alumno para ayudarlo mejor. Por ejemplo: «qué tan ordenadas tiene sus finanzas» o «en qué parte de su proceso de venta se atora».",
  },
  {
    titulo: "Elige: un solo puntaje o por áreas",
    texto:
      "Un solo puntaje sirve para decir «estás en nivel inicial, intermedio o avanzado». Por áreas (de 2 a 5) le dice además cuál es su punto más débil, como el Radar de Liderazgo.",
  },
  {
    titulo: "Pregunta por lo que hace",
    texto: "Las respuestas sobre hechos son más honestas que las opiniones sobre uno mismo.",
    bien: "Reviso mis ventas cada semana.",
    mal: "Soy bueno con los números.",
  },
  {
    titulo: "Una idea por pregunta, sin respuesta obvia",
    texto: "Si la pregunta tiene «y» u «o», pártela en dos. Y evita palabras que delaten la respuesta correcta.",
    bien: "Tengo un precio definido para cada servicio.",
    mal: "¿Tienes precios claros y los respetas siempre, como debe ser?",
  },
  {
    titulo: "Escala u opciones",
    texto:
      "Escala (1 a 5): para hábitos y frecuencias, «Casi nunca… Casi siempre». Opciones con puntos: cuando las respuestas son distintas entre sí; la mejor práctica da más puntos.",
    ejemplo: "¿Cómo consigues clientes? · Solo por recomendación (0) · Publico a veces en redes (1) · Tengo un plan semanal de contenido (2)",
  },
  {
    titulo: "Define los resultados y qué recomiendas",
    texto:
      "Escribe qué lee tu alumno en cada nivel (por ejemplo, de 0 a 39 %, de 40 a 69 % y de 70 a 100 %) y, si usas áreas, qué le recomiendas si esa es la más baja: idealmente, qué parte de tu curso le ayuda.",
  },
  {
    titulo: "Cierra con un siguiente paso",
    texto: "Al terminar, invítalo a agendar una sesión contigo: llega con su resultado y ya sabes de qué hablar.",
  },
];

function Guia({ ia, alTerminar }: { ia: boolean; alTerminar: (m: Modo) => void }) {
  const [paso, setPaso] = useState(0);
  const p = PASOS_GUIA[paso];
  const ultimo = paso === PASOS_GUIA.length - 1;
  return (
    <section className="tarjeta diag-guia" aria-labelledby="diag-guia-titulo">
      <p className="coaches-etiqueta">
        Guía · paso {paso + 1} de {PASOS_GUIA.length}
      </p>
      <h2 id="diag-guia-titulo">{p.titulo}</h2>
      <p>{p.texto}</p>
      {"bien" in p && p.bien && (
        <div className="diag-guia-ejemplos">
          <p className="diag-guia-bien">
            <strong>Así sí:</strong> «{p.bien}»
          </p>
          <p className="diag-guia-mal">
            <strong>Así no:</strong> «{p.mal}»
          </p>
        </div>
      )}
      {"ejemplo" in p && p.ejemplo && (
        <p className="diag-guia-ejemplo">
          <strong>Ejemplo:</strong> {p.ejemplo}
        </p>
      )}
      <div className="diag-guia-puntos" aria-hidden="true">
        {PASOS_GUIA.map((_, i) => (
          <span key={i} data-activo={i <= paso} />
        ))}
      </div>
      <div className="diag-guia-acciones">
        {paso > 0 && (
          <button type="button" className="boton boton-fantasma" onClick={() => setPaso(paso - 1)}>
            Anterior
          </button>
        )}
        {!ultimo ? (
          <button type="button" className="boton" onClick={() => setPaso(paso + 1)}>
            Siguiente
          </button>
        ) : (
          <>
            {ia && (
              <button type="button" className="boton" onClick={() => alTerminar("ia")}>
                <IconoAsistenteGeneral width={17} height={17} /> Armarlo con IA
              </button>
            )}
            <button type="button" className={ia ? "boton boton-secundario" : "boton"} onClick={() => alTerminar("editor")}>
              Hacerlo yo mismo
            </button>
          </>
        )}
        {!ultimo && (
          <button type="button" className="enlace enlace-discreto" onClick={() => alTerminar("editor")}>
            Saltar la guía
          </button>
        )}
      </div>
    </section>
  );
}

interface PedidoIA {
  tema: string;
  para: string;
  preguntas: number;
  areas: number;
  tipo: "escala" | "opciones" | "mixto";
  indicaciones: string;
}

function FormaIA({
  ocupado,
  error,
  conPreguntas,
  alGenerar,
  alCancelar,
}: {
  ocupado: boolean;
  error: string | null;
  conPreguntas: boolean;
  alGenerar: (p: PedidoIA) => void;
  alCancelar: () => void;
}) {
  const [p, setP] = useState<PedidoIA>({ tema: "", para: "", preguntas: 12, areas: 4, tipo: "escala", indicaciones: "" });
  return (
    <form
      className="tarjeta diag-forma-ia"
      onSubmit={(e) => {
        e.preventDefault();
        if (conPreguntas && !window.confirm("La IA va a reemplazar las preguntas que ya tienes. ¿Seguir?")) return;
        alGenerar(p);
      }}
    >
      <h2>
        <IconoAsistenteGeneral width={20} height={20} /> Que la IA arme tu diagnóstico
      </h2>
      <p className="texto-suave">Te propone las preguntas, los puntos y los resultados. Después tú lo revisas y lo cambias como quieras.</p>
      <label className="campo">
        <span>¿Qué quieres medir?</span>
        <textarea
          rows={3}
          required
          value={p.tema}
          onChange={(e) => setP({ ...p, tema: e.target.value })}
          maxLength={400}
          placeholder="Por ejemplo: qué tan preparado está un negocio pequeño para vender por WhatsApp: si tiene catálogo, cómo responde, cómo da seguimiento y cómo cobra."
        />
      </label>
      <label className="campo">
        <span>¿Para quién es? (opcional)</span>
        <input
          value={p.para}
          onChange={(e) => setP({ ...p, para: e.target.value })}
          maxLength={300}
          placeholder="Por ejemplo: dueños de negocios de comida que empiezan a vender en línea"
        />
      </label>
      <div className="forma-fila">
        <label className="campo">
          <span>Preguntas</span>
          <select value={p.preguntas} onChange={(e) => setP({ ...p, preguntas: Number(e.target.value) })}>
            {[8, 12, 16, 20].map((n) => (
              <option key={n} value={n}>
                {n} (unos {Math.max(2, Math.round(n / 3))} min)
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Resultado</span>
          <select value={p.areas} onChange={(e) => setP({ ...p, areas: Number(e.target.value) })}>
            <option value={0}>Un solo puntaje</option>
            {[2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                Por {n} áreas
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Tipo de preguntas</span>
          <select value={p.tipo} onChange={(e) => setP({ ...p, tipo: e.target.value as PedidoIA["tipo"] })}>
            <option value="escala">Escala del 1 al 5</option>
            <option value="opciones">Opciones con puntos</option>
            <option value="mixto">De los dos tipos</option>
          </select>
        </label>
      </div>
      <label className="campo">
        <span>Algo más que deba saber la IA (opcional)</span>
        <input
          value={p.indicaciones}
          onChange={(e) => setP({ ...p, indicaciones: e.target.value })}
          maxLength={600}
          placeholder="Por ejemplo: usa un tono cercano; incluye una pregunta sobre precios"
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="diag-guia-acciones">
        <button type="submit" className="boton" disabled={ocupado || p.tema.trim().length < 5}>
          {ocupado ? "La IA está armando tu diagnóstico…" : "Armar mi diagnóstico"}
        </button>
        <button type="button" className="boton boton-fantasma" onClick={alCancelar} disabled={ocupado}>
          Cancelar
        </button>
      </div>
      {ocupado && <p className="nota">Suele tardar entre 10 y 30 segundos.</p>}
    </form>
  );
}

// ---------------------------------------------------------------- rangos

function Rangos({
  titulo,
  rangos,
  largo = false,
  alCambiar,
}: {
  titulo: string;
  rangos: Banda[];
  largo?: boolean;
  alCambiar: (r: Banda[]) => void;
}) {
  const cambiarRango = (i: number, cambio: Partial<Banda>) => alCambiar(rangos.map((r, k) => (k === i ? { ...r, ...cambio } : r)));
  const num = (v: string) => Math.max(0, Math.min(100, Math.round(Number(v)) || 0));
  return (
    <fieldset className="diag-rangos">
      <legend>{titulo}</legend>
      {rangos.map((r, i) => (
        <div key={i} className="diag-rango" data-largo={largo}>
          <div className="diag-rango-limites">
            <label>
              <span className="sr-only">Desde</span>
              <input type="number" min={0} max={100} value={r.desde} onChange={(e) => cambiarRango(i, { desde: num(e.target.value) })} />
            </label>
            <span aria-hidden="true">a</span>
            <label>
              <span className="sr-only">Hasta</span>
              <input type="number" min={0} max={100} value={r.hasta} onChange={(e) => cambiarRango(i, { hasta: num(e.target.value) })} />
            </label>
            <span>%</span>
          </div>
          {largo ? (
            <textarea
              rows={2}
              aria-label={`Mensaje del rango ${r.desde} a ${r.hasta} %`}
              value={r.texto}
              maxLength={400}
              onChange={(e) => cambiarRango(i, { texto: e.target.value })}
              placeholder="Lo que lee tu alumno con este resultado"
            />
          ) : (
            <input
              aria-label={`Nivel del rango ${r.desde} a ${r.hasta} %`}
              value={r.texto}
              maxLength={60}
              onChange={(e) => cambiarRango(i, { texto: e.target.value })}
              placeholder="Por ejemplo: En desarrollo"
            />
          )}
          {rangos.length > 2 && (
            <button
              type="button"
              className="boton-icono boton-icono-chico"
              aria-label={`Quitar el rango ${r.desde} a ${r.hasta} %`}
              onClick={() => alCambiar(rangos.filter((_, k) => k !== i))}
            >
              <IconoBorrar width={14} height={14} />
            </button>
          )}
        </div>
      ))}
      {rangos.length < LIMITES.rangos && (
        <button
          type="button"
          className="enlace"
          onClick={() => {
            const ultimo = rangos[rangos.length - 1];
            alCambiar([...rangos, { desde: Math.min(100, (ultimo?.hasta ?? 0) + 1), hasta: 100, texto: "" }]);
          }}
        >
          + Agregar rango
        </button>
      )}
    </fieldset>
  );
}
