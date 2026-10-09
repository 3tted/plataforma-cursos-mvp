"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type KeyboardEvent } from "react";
import { useApp } from "@/components/Contexto";
import {
  IconoAsistente,
  IconoCandado,
  IconoCheck,
  IconoExamen,
  IconoFlechaDer,
  IconoFlechaIzq,
  IconoSello,
} from "@/components/Iconos";
import Markdown from "@/components/Markdown";
import PreguntaRapida from "@/components/PreguntaRapida";
import RepasoLeccion from "@/components/RepasoLeccion";
import { useEvaluaciones } from "@/components/useEvaluaciones";
import { useTitulo } from "@/components/useTitulo";
import VideoLeccion from "@/components/VideoLeccion";
import { moneda } from "@/lib/cliente";

type Pestana = "resumen" | "transcripcion" | "repaso";

export default function PaginaLeccion() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const {
    datos,
    errorDatos,
    recargarCurso,
    lecciones,
    completadas,
    alternarCompletada,
    tieneAcceso,
    setLeccionContexto,
    setPreguntaPendiente,
    pagoPendiente,
    cursos,
    cursoId,
    cambiarCurso,
    usuario,
    vistos,
    marcarVisto,
    repasados,
    marcarRepasado,
  } = useApp();
  const evaluaciones = useEvaluaciones();
  // El sello se anima solo cuando la alumna marca la lección, no al volver a abrirla.
  const [recienMarcada, setRecienMarcada] = useState(false);
  // La pestaña elegida vale para esta lección; al cambiar de lección se vuelve al resumen.
  const [eleccion, setEleccion] = useState<{ leccion: string; pestana: Pestana } | null>(null);
  const leccion = lecciones.find((l) => l.id === id);
  useTitulo(leccion?.titulo ?? (datos ? "Lección" : null));

  // Un enlace a una lección de otro curso cambia el curso activo. Las
  // lecciones que agrega la coach (C1, C2…) son del curso principal.
  const cursoDeLeccion =
    cursos.find((c) => c.lecciones.includes(id))?.id ?? (/^C\d+$/.test(id) ? cursos[0]?.id : undefined);
  useEffect(() => {
    if (cursoDeLeccion && cursoDeLeccion !== cursoId) cambiarCurso(cursoDeLeccion);
  }, [cursoDeLeccion, cursoId, cambiarCurso]);

  if (!datos) {
    return errorDatos ? (
      <div className="error chat-aviso" role="alert">
        <span>No pudimos cargar la lección. Revisa tu conexión e inténtalo de nuevo.</span>
        <button type="button" className="boton boton-chico boton-secundario" onClick={() => void recargarCurso()}>
          Reintentar
        </button>
      </div>
    ) : (
      <p className="texto-suave">Cargando lección…</p>
    );
  }

  if (!leccion) {
    return (
      <div className="pagina-estrecha">
        <h1>No encontramos esa lección</h1>
        <p className="texto-suave">Puede que el enlace esté incompleto o que la lección ya no forme parte del curso.</p>
        <Link href="/curso" className="boton">
          Ver todas las lecciones
        </Link>
      </div>
    );
  }

  const indice = lecciones.findIndex((l) => l.id === leccion.id);
  const anterior = lecciones[indice - 1];
  const siguiente = lecciones[indice + 1];
  const bloqueada = !leccion.gratis && !tieneAcceso;
  const hecha = completadas.includes(leccion.id);
  const numeroModulo = datos.curso.modulos.findIndex((m) => m.id === leccion.modulo.id) + 1;
  const base = lecciones.filter((l) => !l.deCoach);
  const completadasBase = base.filter((l) => completadas.includes(l.id)).length;
  const modulo = leccion.modulo;
  const hechasModulo = modulo.lecciones.filter((l) => completadas.includes(l.id)).length;
  const siguienteBloqueada = !!siguiente && !siguiente.gratis && !tieneAcceso;
  const cursoTerminado = !leccion.deCoach && completadasBase === base.length;
  const precio = moneda(datos.comunidad.precio_mensual);
  const enlaceMembresia = (desde: string) => `/membresia?leccion=${desde}`;
  const textoUnirse = pagoPendiente ? "Ver mi ficha de pago" : `Unirme por ${precio} al mes`;

  // Pestañas del contenido: solo las que esta lección tiene.
  const preguntasRepaso = leccion.deCoach ? 0 : (evaluaciones?.repaso[leccion.id]?.length ?? 0);
  const pestanas: { id: Pestana; texto: string; conteo?: number }[] = [
    { id: "resumen", texto: "Resumen" },
    ...(leccion.transcripcion ? [{ id: "transcripcion" as const, texto: "Transcripción" }] : []),
    ...(preguntasRepaso ? [{ id: "repaso" as const, texto: "Repaso", conteo: preguntasRepaso }] : []),
  ];
  const elegida = eleccion?.leccion === leccion.id ? eleccion.pestana : "resumen";
  const pestana = pestanas.some((p) => p.id === elegida) ? elegida : "resumen";
  const elegir = (p: Pestana) => setEleccion({ leccion: leccion.id, pestana: p });
  // Flechas, Inicio y Fin mueven entre pestañas, como pide el patrón de pestañas accesibles.
  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = pestanas.findIndex((p) => p.id === pestana);
    const destino =
      e.key === "ArrowRight" ? (i + 1) % pestanas.length
      : e.key === "ArrowLeft" ? (i - 1 + pestanas.length) % pestanas.length
      : e.key === "Home" ? 0
      : e.key === "End" ? pestanas.length - 1
      : -1;
    if (destino < 0) return;
    e.preventDefault();
    elegir(pestanas[destino].id);
    document.getElementById(`pestana-${pestanas[destino].id}`)?.focus();
  };

  // Ruta del alumno en cada lección: el video completo, luego el repaso, y con
  // eso la lección se completa sola. Las lecciones se abren en orden. La coach
  // revisa todo libremente y lo ya completado no se vuelve a pedir.
  const esAlumno = usuario?.rol !== "coach";
  const guiado = esAlumno && !leccion.deCoach && !hecha;
  const enOrdenLeccion = (idLeccion: string) => {
    const i = base.findIndex((l) => l.id === idLeccion);
    return !esAlumno || i <= 0 || completadas.includes(idLeccion) || completadas.includes(base[i - 1].id);
  };
  const previa = base[base.findIndex((l) => l.id === leccion.id) - 1];
  const enOrden = !!leccion.deCoach || enOrdenLeccion(leccion.id);
  const videoListo = !guiado || !leccion.video || vistos.includes(leccion.id);
  const repasoListo = !guiado || preguntasRepaso === 0 || repasados.includes(leccion.id);
  const pendiente = !videoListo ? "Mira el video completo" : !repasoListo ? "Responde el repaso" : null;

  const completar = () => {
    if (hecha) return;
    setRecienMarcada(true);
    alternarCompletada(leccion.id);
  };

  const alTerminarVideo = () => {
    marcarVisto(leccion.id);
    if (!guiado) return;
    if (preguntasRepaso > 0 && !repasados.includes(leccion.id)) {
      // A continuación, las preguntas de esta lección.
      elegir("repaso");
      document.getElementById("pestana-repaso")?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      completar();
    }
  };

  const alRevisarRepaso = () => {
    marcarRepasado(leccion.id);
    if (guiado && videoListo) completar();
  };

  const preguntar = (pregunta: string) => {
    setLeccionContexto(leccion.id);
    setPreguntaPendiente(pregunta);
    router.push("/curso/asistente");
  };

  const marcar = () => {
    setRecienMarcada(!hecha);
    alternarCompletada(leccion.id);
  };

  return (
    <div className="rejilla-leccion" data-con-barra={!bloqueada}>
      <nav className="indice-lecciones" aria-label="Lecciones del curso">
        <Link href="/curso" className="volver">
          <IconoFlechaIzq width={16} height={16} /> Todo el curso
        </Link>
        {datos.curso.modulos.map((m) => {
          const hechasM = m.lecciones.filter((l) => completadas.includes(l.id)).length;
          const parte = m.lecciones.length ? hechasM / m.lecciones.length : 0;
          return (
            <div key={m.id} className="indice-modulo">
              <p className="indice-modulo-titulo">
                <span>{m.titulo}</span>
                <span className="indice-modulo-avance cifra">
                  {hechasM}/{m.lecciones.length} · {Math.round(parte * 100)}%
                </span>
              </p>
              <span className="indice-modulo-barra" aria-hidden="true">
                <span style={{ transform: `scaleX(${parte})` }} />
              </span>
              <ul>
                {m.lecciones.map((l) => {
                  const lHecha = completadas.includes(l.id);
                  const lBloqueada = !l.gratis && !tieneAcceso;
                  const lEnEspera = !lBloqueada && !l.deCoach && !enOrdenLeccion(l.id);
                  return (
                    <li key={l.id}>
                      <Link href={`/curso/${l.id}`} aria-current={l.id === leccion.id ? "page" : undefined}>
                        <span
                          className="indice-marca"
                          data-estado={lHecha ? "hecha" : lBloqueada || lEnEspera ? "bloqueada" : "abierta"}
                        >
                          {lHecha ? (
                            <IconoCheck width={12} height={12} />
                          ) : lBloqueada || lEnEspera ? (
                            <IconoCandado width={12} height={12} />
                          ) : null}
                        </span>
                        <span className="indice-titulo">
                          {l.titulo}
                          {(lHecha || lBloqueada || lEnEspera) && (
                            <span className="sr-only">
                              {lHecha ? " (completada)" : lBloqueada ? " (para miembros)" : " (se abre al terminar la anterior)"}
                            </span>
                          )}
                        </span>
                        <span className="indice-min cifra">{l.duracion_min} min</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        <Link href="/curso/examen" className="indice-examen">
          <IconoExamen width={16} height={16} /> Examen final
          {!cursoTerminado && (
            <>
              <IconoCandado width={12} height={12} />
              <span className="sr-only"> (se desbloquea al terminar las lecciones)</span>
            </>
          )}
        </Link>
      </nav>

      <article className="leccion">
        <h1>{leccion.titulo}</h1>
        <p className="leccion-meta">
          <span className="cita-id" title="Así aparece esta lección en las respuestas del asistente">
            {leccion.id}
          </span>
          <span>{leccion.deCoach ? "Lección de la coach" : `Módulo ${numeroModulo}: ${modulo.titulo}`}</span>
          <span className="leccion-meta-duracion">
            <span className="cifra">{leccion.duracion_min}</span> min
          </span>
        </p>

        {bloqueada ? (
          <div className="tarjeta bloqueo">
            <span className="bloqueo-icono">
              <IconoCandado width={22} height={22} />
            </span>
            <h2>Esta lección es para miembros</h2>
            <p className="texto-suave">{leccion.resumen}</p>
            <p>
              Con la membresía tienes el curso completo y el asistente te responde con todas las lecciones. Se paga en
              efectivo en OXXO, por transferencia SPEI o con Mercado Pago.
            </p>
            <div className="bloqueo-acciones">
              <Link href={enlaceMembresia(leccion.id)} className="boton">
                {textoUnirse}
              </Link>
              <button type="button" className="enlace" onClick={() => preguntar(`¿De qué trata «${leccion.titulo}»?`)}>
                Pregúntale al asistente de qué trata
              </button>
            </div>
          </div>
        ) : !enOrden ? (
          <div className="tarjeta bloqueo">
            <span className="bloqueo-icono">
              <IconoCandado width={22} height={22} />
            </span>
            <h2>Primero termina la lección anterior</h2>
            <p className="texto-suave">
              Las lecciones se abren en orden: mira el video y contesta el repaso de cada una para pasar a la siguiente.
            </p>
            {previa && (
              <div className="bloqueo-acciones">
                <Link href={`/curso/${previa.id}`} className="boton">
                  <IconoFlechaIzq width={16} height={16} /> Ir a «{previa.titulo}»
                </Link>
              </div>
            )}
          </div>
        ) : (
          <>
            <VideoLeccion leccion={leccion} sinAdelantar={guiado && !videoListo} alTerminar={alTerminarVideo} />

            {pestanas.length > 1 && (
              <div className="pestanas" role="tablist" aria-label="Contenido de la lección" onKeyDown={alTeclear}>
                {pestanas.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    id={`pestana-${p.id}`}
                    aria-controls={`panel-${p.id}`}
                    aria-selected={pestana === p.id}
                    tabIndex={pestana === p.id ? 0 : -1}
                    className="pestana"
                    onClick={() => elegir(p.id)}
                  >
                    {p.id === "repaso" && !videoListo && <IconoCandado width={14} height={14} />}
                    {p.texto}
                    {p.id === "repaso" && !videoListo && <span className="sr-only"> (se abre al terminar el video)</span>}
                    {p.conteo !== undefined && <span className="pestana-conteo cifra">{p.conteo}</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Los paneles quedan montados al cambiar de pestaña: el repaso no pierde lo que ya contestaste. */}
            <div
              role={pestanas.length > 1 ? "tabpanel" : undefined}
              id="panel-resumen"
              aria-labelledby={pestanas.length > 1 ? "pestana-resumen" : undefined}
              hidden={pestana !== "resumen"}
            >
              <Markdown texto={leccion.contenido} nivelTitulos={2} />
            </div>
            {leccion.transcripcion && (
              <div
                role="tabpanel"
                id="panel-transcripcion"
                aria-labelledby="pestana-transcripcion"
                hidden={pestana !== "transcripcion"}
                className="panel-transcripcion"
              >
                <Markdown texto={leccion.transcripcion} />
              </div>
            )}
            {preguntasRepaso > 0 && (
              <div role="tabpanel" id="panel-repaso" aria-labelledby="pestana-repaso" hidden={pestana !== "repaso"}>
                {videoListo ? (
                  <RepasoLeccion key={leccion.id} leccion={leccion} alRevisar={alRevisarRepaso} />
                ) : (
                  <div className="repaso-bloqueado">
                    <IconoCandado width={20} height={20} />
                    <p>
                      <strong>El repaso se abre al terminar el video.</strong>
                      <span className="texto-suave">
                        {" "}
                        Son {preguntasRepaso} preguntas y al contestarlas la lección queda completada.
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {hecha && (
              <div className="cierre-leccion" role="status">
                <div className="sello" data-animar={recienMarcada}>
                  <span className="sello-marca">
                    <IconoSello width={52} height={52} />
                  </span>
                  <div className="sello-textos">
                    <p className="sello-titulo">
                      {cursoTerminado
                        ? "Terminaste todas las lecciones"
                        : siguienteBloqueada && hechasModulo === modulo.lecciones.length
                          ? "Terminaste el módulo gratis"
                          : "Lección completada"}
                    </p>
                    {leccion.deCoach ? (
                      <p className="texto-suave">Lección de la coach</p>
                    ) : (
                      <p className="sello-avance texto-suave">
                        <span>
                          Módulo {numeroModulo}:{" "}
                          <span className="cifra">
                            {hechasModulo} de {modulo.lecciones.length}
                          </span>
                        </span>
                        <span>
                          Curso:{" "}
                          <span className="cifra">
                            {completadasBase} de {base.length}
                          </span>
                        </span>
                      </p>
                    )}
                    {siguienteBloqueada && !cursoTerminado && (
                      <p className="sello-nota">
                        Lo que sigue ({datos.curso.modulos
                          .slice(numeroModulo)
                          .filter((m) => m.id !== "MC")
                          .map((m) => m.titulo)
                          .join(" y ")}) es para miembros.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <nav className="leccion-navegacion" aria-label="Lección anterior y siguiente">
          {anterior ? (
            <Link href={`/curso/${anterior.id}`} className="leccion-vecina">
              <span className="texto-suave">
                <IconoFlechaIzq width={14} height={14} /> Anterior
              </span>
              {anterior.titulo}
            </Link>
          ) : (
            <span />
          )}
          {siguiente && guiado && enOrden && !bloqueada ? (
            <span className="leccion-vecina leccion-vecina-der leccion-vecina-espera">
              <span className="texto-suave">
                Siguiente <IconoCandado width={13} height={13} />
              </span>
              Termina esta lección para seguir
            </span>
          ) : siguiente && (
            <Link href={`/curso/${siguiente.id}`} className="leccion-vecina leccion-vecina-der">
              <span className="texto-suave">
                Siguiente
                {siguienteBloqueada && (
                  <>
                    <IconoCandado width={13} height={13} />
                    <span className="sr-only"> (para miembros)</span>
                  </>
                )}
                <IconoFlechaDer width={14} height={14} />
              </span>
              {siguiente.titulo}
            </Link>
          )}
        </nav>
      </article>

      <aside className="lateral-leccion" aria-label="Asistente del curso">
        <section className="tarjeta-asistente">
          <h2>
            <IconoAsistente width={18} height={18} /> Asistente del curso
          </h2>
          <p>¿Una duda mientras lees? Te responde con el curso y te dice de qué lección sale.</p>
          <div className="sugerencias">
            {(bloqueada ? [`¿De qué trata «${leccion.titulo}»?`] : leccion.preguntas_sugeridas.slice(0, 2)).map((q) => (
              <button key={q} type="button" className="sugerencia" onClick={() => preguntar(q)}>
                {q}
              </button>
            ))}
          </div>
          <PreguntaRapida leccion={leccion.id} origen="lateral" />
        </section>
      </aside>

      {/* Barra fija: marcar la lección y pasar a lo que sigue sin buscar el botón. */}
      {!bloqueada && enOrden && (
        <div className="barra-siguiente" role="region" aria-label="Avance de la lección">
          <div className="envoltura barra-siguiente-interior">
            <p className="barra-siguiente-texto">
              {pendiente ? (
                <>
                  <small>Para continuar</small>
                  <strong>{pendiente}</strong>
                </>
              ) : cursoTerminado ? (
                <>
                  <small>Último paso</small>
                  <strong>Examen final</strong>
                </>
              ) : siguiente ? (
                <>
                  <small>
                    Siguiente lección · <span className="cifra">{siguiente.duracion_min}</span> min
                    {siguienteBloqueada && " · para miembros"}
                  </small>
                  <strong>{siguiente.titulo}</strong>
                </>
              ) : (
                <>
                  <small>
                    Lección <span className="cifra">{indice + 1}</span> de <span className="cifra">{lecciones.length}</span>
                  </small>
                  <strong>{leccion.titulo}</strong>
                </>
              )}
            </p>
            <div className="barra-siguiente-acciones">
              <button
                type="button"
                className="boton boton-secundario barra-marcar"
                aria-pressed={hecha}
                onClick={marcar}
                disabled={!!pendiente}
                title={hecha ? "Toca para desmarcarla" : undefined}
              >
                <IconoCheck width={16} height={16} />
                {hecha ? (
                  "Completada"
                ) : (
                  <>
                    <span className="barra-texto-largo">Marcar como completada</span>
                    <span className="barra-texto-corto">Completar</span>
                  </>
                )}
              </button>
              {guiado ? (
                <button type="button" className="boton" disabled title={pendiente ?? "Marca la lección como completada"}>
                  Siguiente lección <IconoFlechaDer width={16} height={16} />
                </button>
              ) : cursoTerminado ? (
                <Link href="/curso/examen" className="boton">
                  Presentar el examen <IconoFlechaDer width={16} height={16} />
                </Link>
              ) : siguienteBloqueada ? (
                <Link href={enlaceMembresia(siguiente.id)} className="boton">
                  {textoUnirse}
                </Link>
              ) : (
                siguiente && (
                  <Link href={`/curso/${siguiente.id}`} className="boton">
                    Siguiente lección <IconoFlechaDer width={16} height={16} />
                  </Link>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
