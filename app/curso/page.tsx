"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Arcos from "@/components/Arcos";
import Avatar from "@/components/Avatar";
import { useApp } from "@/components/Contexto";
import {
  IconoAprobado,
  IconoBillete,
  IconoCandado,
  IconoCheck,
  IconoExamen,
  IconoFlechaIzq,
  IconoPlay,
  IconoVideo,
} from "@/components/Iconos";
import BotonInscribirse from "@/components/BotonInscribirse";
import SelectorCurso from "@/components/SelectorCurso";
import { useEvaluaciones } from "@/components/useEvaluaciones";
import { useTitulo } from "@/components/useTitulo";
import { api, moneda, parteGratis } from "@/lib/cliente";
import { fotoDePortada } from "@/lib/portadas";
import AvisoSinPublicar from "@/components/AvisoSinPublicar";
import type { Expediente } from "@/lib/tipos";

// Portada del curso: de qué trata, lo que aprenderás, el temario por módulos
// (se abren y cierran), quién lo imparte y qué pasa al terminar.
export default function PaginaCurso() {
  const {
    datos,
    lecciones,
    completadas,
    tieneAcceso,
    errorDatos,
    recargarCurso,
    pagoPendiente,
    usuario,
    cursoId,
    cambiarCurso,
    inscripcionLista,
    enComunidad,
    inscritoEn,
  } = useApp();
  const evaluaciones = useEvaluaciones();
  const [expediente, setExpediente] = useState<Expediente | null>(null);
  // Módulos que la persona abrió o cerró; los demás siguen la regla de abajo.
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  useTitulo(datos?.curso.titulo ?? "Curso");

  useEffect(() => {
    setExpediente(null);
    setAbiertos({});
    if (usuario?.rol !== "alumno") return;
    api<Expediente>(`/api/expediente?autor=${encodeURIComponent(usuario.nombre)}&curso=${encodeURIComponent(cursoId)}`)
      .then(setExpediente)
      .catch(() => undefined);
  }, [usuario, cursoId]);

  // Quien todavía no está en la comunidad del curso va a la comunidad: ahí ve
  // de qué trata, sus cursos y el botón para unirse.
  const router = useRouter();
  const fuera = !!datos && inscripcionLista && !enComunidad;
  useEffect(() => {
    if (fuera) router.replace("/comunidad");
  }, [fuera, router]);

  if (errorDatos && !datos) {
    return (
      <div className="error chat-aviso" role="alert">
        <span>No pudimos cargar el curso. Revisa tu conexión e inténtalo de nuevo.</span>
        <button type="button" className="boton boton-chico boton-secundario" onClick={() => void recargarCurso()}>
          Reintentar
        </button>
      </div>
    );
  }
  const volver = (
    <>
      <Link href="/comunidad" className="volver">
        <IconoFlechaIzq width={16} height={16} /> Volver a la comunidad
      </Link>
      <SelectorCurso activo={cursoId} alElegir={cambiarCurso} conAvance={usuario?.rol === "alumno"} />
    </>
  );
  if (!datos || !inscripcionLista || fuera) {
    return (
      <div className="pagina-curso">
        {volver}
        <p className="texto-suave">Cargando curso…</p>
      </div>
    );
  }
  const inscrito = inscritoEn(cursoId);

  const { curso, comunidad } = datos;
  const base = lecciones.filter((l) => !l.deCoach);
  const minutos = base.reduce((s, l) => s + l.duracion_min, 0);
  const hechas = base.filter((l) => completadas.includes(l.id)).length;
  const siguiente = lecciones.find((l) => !completadas.includes(l.id) && (l.gratis || tieneAcceso));
  const terminado = base.length > 0 && hechas === base.length;
  const modulosCurso = curso.modulos.filter((m) => m.id !== "MC");
  const examen = expediente?.examen;
  const preguntasExamen = evaluaciones?.examenFinal.preguntas.length;
  // Abierto al entrar: el módulo de la lección que sigue (o el primero).
  const moduloActual = siguiente?.modulo.id ?? curso.modulos[0]?.id;
  const estaAbierto = (id: string) => abiertos[id] ?? id === moduloActual;
  // La coach revisa el curso: no tiene avance ni examen que presentar.
  const esCoach = usuario?.rol === "coach";
  const conVideo = base.filter((l) => l.video).length;

  return (
    <div className="pagina-curso">
      {volver}
      <AvisoSinPublicar />
      <header className="curso-portada">
        <Arcos />
        <div className="curso-portada-textos">
          {fotoDePortada(curso.id) && (
            // eslint-disable-next-line @next/next/no-img-element -- foto estática ya ligera
            <img
              src={fotoDePortada(curso.id)!.src}
              alt={`Portada del curso «${curso.titulo}»`}
              className="curso-portada-foto"
              style={{ objectPosition: fotoDePortada(curso.id)!.foco }}
            />
          )}
          <h1>{curso.titulo}</h1>
          <p className="curso-subtitulo">{curso.subtitulo}</p>
          <ul className="curso-datos" aria-label="Datos del curso">
            <li>Con {comunidad.coach}</li>
            <li>
              <span className="cifra">{modulosCurso.length}</span> módulos
            </li>
            <li>
              <span className="cifra">{base.length}</span> lecciones
            </li>
            <li>
              <span className="cifra">{minutos}</span> min
            </li>
          </ul>
        </div>
        <div className="curso-progreso">
          {esCoach ? (
            <>
              <p className="curso-progreso-cifra">
                <span className="cifra">{conVideo}</span>
                <span className="curso-progreso-total">
                  de <span className="cifra">{base.length}</span> lecciones con video
                </span>
              </p>
              <p className="curso-siguiente">Así ven el curso tus alumnos. Tú puedes abrir cualquier lección.</p>
              {base[0] && (
                <Link href={`/curso/${base[0].id}`} className="boton">
                  Ver la primera lección
                </Link>
              )}
            </>
          ) : !inscrito ? (
            <>
              <p className="curso-progreso-cifra">
                <span className="cifra">{base.length}</span>
                <span className="curso-progreso-total">lecciones · {minutos} min</span>
              </p>
              <p className="curso-siguiente">Todavía no estás inscrito. Inscribirte es gratis y el módulo 1 también.</p>
              <BotonInscribirse curso={cursoId} />
            </>
          ) : (
            <>
              <p className="curso-progreso-cifra">
                <span className="cifra">{hechas}</span>
                <span className="curso-progreso-total">
                  de <span className="cifra">{base.length}</span> lecciones completadas
                </span>
              </p>
              <div className="progreso" aria-hidden="true">
                <span style={{ transform: `scaleX(${base.length ? hechas / base.length : 0})` }} />
              </div>
              {siguiente ? (
                <>
                  <p className="curso-siguiente">
                    {hechas === 0 ? "Primera lección" : "Sigue"}: <strong>{siguiente.titulo}</strong>
                  </p>
                  <Link href={`/curso/${siguiente.id}`} className="boton">
                    {hechas === 0 ? "Empezar el curso" : "Continuar"}
                  </Link>
                </>
              ) : terminado ? (
                <>
                  <p className="curso-siguiente">
                    {examen?.aprobado ? "Aprobaste el curso." : "Terminaste las lecciones. Te falta el examen final."}
                  </p>
                  <Link href={examen?.aprobado ? "/perfil" : "/curso/examen"} className="boton">
                    {examen?.aprobado ? "Ver mi expediente" : "Presentar el examen"}
                  </Link>
                </>
              ) : null}
            </>
          )}
        </div>
      </header>

      {!tieneAcceso && (
        <div className="aviso">
          <p>
            <strong>{parteGratis(datos.curso)}</strong> La membresía se paga con OXXO, SPEI o Mercado Pago.
          </p>
          <Link href="/membresia" className="boton boton-chico boton-secundario">
            {pagoPendiente ? "Ver mi ficha de pago" : `Unirme por ${moneda(comunidad.precio_mensual)} al mes`}
          </Link>
        </div>
      )}

      <div className="curso-columnas">
        <div className="curso-principal">
          {curso.aprenderas && curso.aprenderas.length > 0 && (
            <section className="tarjeta curso-bloque" aria-labelledby="aprenderas-titulo">
              <h2 id="aprenderas-titulo">Lo que aprenderás</h2>
              <ul className="aprenderas">
                {curso.aprenderas.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="curso-bloque" aria-labelledby="temario-titulo">
            <h2 id="temario-titulo">Temario</h2>
            <div className="modulos">
              {curso.modulos.map((modulo, i) => {
                const hechasModulo = modulo.lecciones.filter((l) => completadas.includes(l.id)).length;
                const minutosModulo = modulo.lecciones.reduce((s, l) => s + l.duracion_min, 0);
                const gratis = modulo.lecciones.every((l) => l.gratis);
                return (
                  <details
                    key={modulo.id}
                    className="tarjeta modulo"
                    open={estaAbierto(modulo.id)}
                    onToggle={(e) => {
                      const abierto = e.currentTarget.open;
                      if (abierto !== estaAbierto(modulo.id)) setAbiertos((a) => ({ ...a, [modulo.id]: abierto }));
                    }}
                  >
                    <summary className="modulo-cabecera">
                      <span className="modulo-titulo">
                        <span className="modulo-numero">{modulo.id === "MC" ? "Extra" : `Módulo ${i + 1}`}</span>
                        {modulo.titulo}
                      </span>
                      <span className="modulo-resumen texto-suave">
                        <span className="cifra">{modulo.lecciones.length}</span> lecciones ·{" "}
                        <span className="cifra">{minutosModulo}</span> min
                        {modulo.id !== "MC" && (gratis ? " · Gratis" : !tieneAcceso ? " · Para miembros" : "")}
                      </span>
                      <span className="modulo-avance texto-suave">
                        {!esCoach && (
                          <>
                            <span className="cifra">
                              {hechasModulo}/{modulo.lecciones.length}
                            </span>
                            <span className="sr-only"> lecciones completadas</span>
                          </>
                        )}
                      </span>
                    </summary>
                    <ul className="lista-lecciones">
                      {modulo.lecciones.map((l) => {
                        const bloqueada = !l.gratis && !tieneAcceso;
                        const hecha = completadas.includes(l.id);
                        // Para el alumno, cada lección se abre al terminar la anterior.
                        const indice = base.findIndex((b) => b.id === l.id);
                        const enEspera =
                          usuario?.rol !== "coach" &&
                          !l.deCoach &&
                          !hecha &&
                          !bloqueada &&
                          indice > 0 &&
                          !completadas.includes(base[indice - 1].id);
                        const estado = hecha ? "hecha" : bloqueada ? "pago" : enEspera ? "bloqueada" : "abierta";
                        return (
                          <li key={l.id}>
                            <Link href={`/curso/${l.id}`} className="fila-leccion" data-bloqueada={bloqueada}>
                              <span className="estado-leccion" data-estado={estado}>
                                {hecha ? <IconoCheck /> : bloqueada ? <IconoBillete /> : enEspera ? <IconoCandado /> : <IconoPlay />}
                              </span>
                              <span className="fila-leccion-textos">
                                <span className="fila-leccion-titulo">{l.titulo}</span>
                                {/* El candado también marca las lecciones de pago: la etiqueta dice que esta solo espera su turno. */}
                                {enEspera ? (
                                  <span className="pastilla fila-leccion-espera">Después de la anterior</span>
                                ) : (
                                  <span className="sr-only">
                                    {hecha ? "Completada." : bloqueada ? "Para miembros." : "Disponible."}
                                  </span>
                                )}
                                <span className="texto-suave">{l.resumen}</span>
                              </span>
                              <span className="fila-leccion-meta">
                                {l.video && (
                                  <span className="pastilla" title="Esta lección tiene video">
                                    <IconoVideo width={13} height={13} /> Video
                                  </span>
                                )}
                                {l.deCoach && <span className="pastilla pastilla-marca">De la coach</span>}
                                <span className="texto-suave cifra">{l.duracion_min} min</span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="curso-lateral" aria-label="Sobre el curso">
          <section className="tarjeta curso-bloque" aria-labelledby="imparte-titulo">
            <h2 id="imparte-titulo">Quién lo imparte</h2>
            <div className="curso-coach">
              <Avatar nombre={comunidad.coach} tamaño={52} coach />
              <span>
                <span className="curso-coach-nombre">{comunidad.coach}</span>
                <span className="texto-suave">{comunidad.coach_titulo}</span>
              </span>
            </div>
          </section>

          <section className="tarjeta curso-bloque curso-al-terminar" aria-labelledby="terminar-titulo">
            <h2 id="terminar-titulo">
              <span className="curso-al-terminar-icono" aria-hidden="true">
                {examen?.aprobado ? <IconoAprobado width={20} height={20} /> : <IconoExamen width={20} height={20} />}
              </span>
              Al terminar
            </h2>
            <p>
              Presentas un <strong>examen final</strong>
              {preguntasExamen ? ` de ${preguntasExamen} preguntas` : ""}. Lo apruebas con{" "}
              <span className="cifra">{evaluaciones?.aprobarCon ?? 70}%</span>, tienes{" "}
              <span className="cifra">{evaluaciones?.intentosExamen ?? 3}</span> intentos y queda en tu expediente.
            </p>
            <p className="texto-suave curso-al-terminar-estado">
              {esCoach
                ? "Puedes revisarlo como lo verán tus alumnos; tus respuestas no se guardan."
                : examen?.aprobado
                  ? `Aprobado con ${examen.mejorPuntaje}%.`
                  : terminado
                    ? "Ya puedes presentarlo."
                    : `Se desbloquea al terminar las ${base.length} lecciones. Llevas ${hechas}.`}
            </p>
            {examen?.aprobado ? (
              <Link href="/perfil" className="boton boton-secundario boton-chico">
                Ver mi expediente
              </Link>
            ) : terminado || usuario?.rol === "coach" ? (
              <Link href="/curso/examen" className="boton boton-chico">
                {usuario?.rol === "coach" ? "Ver el examen" : "Presentar el examen"}
              </Link>
            ) : (
              <span className="pastilla">
                <IconoCandado width={13} height={13} /> Bloqueado
              </span>
            )}
            {curso.requisitos && (
              <p className="curso-requisitos texto-suave">
                <strong>Requisitos:</strong> {curso.requisitos}
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
