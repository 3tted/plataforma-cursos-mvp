"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/Contexto";
import {
  IconoAsistente,
  IconoCandado,
  IconoCheck,
  IconoFlechaDer,
  IconoFlechaIzq,
  IconoSello,
} from "@/components/Iconos";
import Markdown from "@/components/Markdown";
import PreguntaRapida from "@/components/PreguntaRapida";
import { useTitulo } from "@/components/useTitulo";
import VideoLeccion from "@/components/VideoLeccion";
import { moneda } from "@/lib/cliente";

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
    setBorrador,
    pagoPendiente,
  } = useApp();
  // El sello se anima solo cuando la alumna marca la lección, no al volver a abrirla.
  const [recienMarcada, setRecienMarcada] = useState(false);
  const leccion = lecciones.find((l) => l.id === id);
  useTitulo(leccion?.titulo ?? (datos ? "Lección" : null));

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

  const preguntar = (pregunta: string) => {
    setLeccionContexto(leccion.id);
    setPreguntaPendiente(pregunta);
    router.push("/asistente");
  };

  const marcar = () => {
    setRecienMarcada(!hecha);
    alternarCompletada(leccion.id);
  };

  const compartirLogro = () => {
    setBorrador({
      categoria: "Logros",
      titulo: `Terminé «${datos.curso.titulo}»`,
      cuerpo: "Lo que más me sirvió del curso fue…",
    });
    router.push("/comunidad");
  };

  return (
    <div className="rejilla-leccion">
      <nav className="indice-lecciones" aria-label="Lecciones del curso">
        <Link href="/curso" className="volver">
          <IconoFlechaIzq width={16} height={16} /> Todo el curso
        </Link>
        {datos.curso.modulos.map((m) => (
          <div key={m.id} className="indice-modulo">
            <p className="indice-modulo-titulo">{m.titulo}</p>
            <ul>
              {m.lecciones.map((l) => {
                const lHecha = completadas.includes(l.id);
                const lBloqueada = !l.gratis && !tieneAcceso;
                return (
                  <li key={l.id}>
                    <Link href={`/curso/${l.id}`} aria-current={l.id === leccion.id ? "page" : undefined}>
                      <span className="indice-marca" data-estado={lHecha ? "hecha" : lBloqueada ? "bloqueada" : "abierta"}>
                        {lHecha ? (
                          <IconoCheck width={12} height={12} />
                        ) : lBloqueada ? (
                          <IconoCandado width={12} height={12} />
                        ) : null}
                      </span>
                      <span>
                        {l.titulo}
                        {(lHecha || lBloqueada) && (
                          <span className="sr-only">{lHecha ? " (completada)" : " (para miembros)"}</span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
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
        ) : (
          <>
            <VideoLeccion leccion={leccion} />

            <Markdown texto={leccion.contenido} nivelTitulos={2} />

            {leccion.transcripcion && (
              <details className="transcripcion">
                <summary>Transcripción del video</summary>
                <Markdown texto={leccion.transcripcion} />
              </details>
            )}

            <section className="tarjeta preguntar-leccion" aria-labelledby="preguntar-titulo">
              <h2 id="preguntar-titulo">
                <IconoAsistente /> ¿Te quedó una duda?
              </h2>
              <p className="texto-suave">El asistente responde con el contenido de esta lección y del resto del curso.</p>
              {leccion.preguntas_sugeridas.length > 0 && (
                <div className="sugerencias">
                  {leccion.preguntas_sugeridas.map((q) => (
                    <button key={q} type="button" className="sugerencia" onClick={() => preguntar(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
              <PreguntaRapida leccion={leccion.id} />
            </section>

            <div className="cierre-leccion" role="status">
              {!hecha ? (
                <div className="cierre-pendiente">
                  <button type="button" className="boton" onClick={marcar}>
                    <IconoCheck width={16} height={16} /> Marcar como completada
                  </button>
                  <span className="texto-suave">
                    Llevas{" "}
                    <span className="cifra">
                      {completadasBase} de {base.length}
                    </span>{" "}
                    lecciones del curso
                  </span>
                </div>
              ) : (
                <div className="sello" data-animar={recienMarcada}>
                  <span className="sello-marca">
                    <IconoSello width={52} height={52} />
                  </span>
                  <div className="sello-textos">
                    <p className="sello-titulo">
                      {cursoTerminado
                        ? "Terminaste el curso"
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
                  <div className="sello-acciones">
                    {cursoTerminado ? (
                      <button type="button" className="boton" onClick={compartirLogro}>
                        Compartir mi logro en la comunidad
                      </button>
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
                    <button type="button" className="enlace enlace-discreto" onClick={marcar}>
                      Desmarcar
                    </button>
                  </div>
                </div>
              )}
            </div>
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
          {siguiente && (
            <Link href={`/curso/${siguiente.id}`} className="leccion-vecina leccion-vecina-der">
              <span className="texto-suave">
                Siguiente
                {!siguiente.gratis && !tieneAcceso && (
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
    </div>
  );
}
