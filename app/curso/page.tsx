"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Arcos from "@/components/Arcos";
import { useApp } from "@/components/Contexto";
import {
  IconoAprobado,
  IconoCandado,
  IconoCheck,
  IconoExamen,
  IconoFlechaIzq,
  IconoPlay,
  IconoVideo,
} from "@/components/Iconos";
import { useTitulo } from "@/components/useTitulo";
import { api, moneda } from "@/lib/cliente";
import type { Expediente } from "@/lib/tipos";

export default function PaginaCurso() {
  const { datos, lecciones, completadas, tieneAcceso, errorDatos, recargarCurso, pagoPendiente, usuario } = useApp();
  const [expediente, setExpediente] = useState<Expediente | null>(null);
  useTitulo("Curso");

  useEffect(() => {
    if (usuario?.rol !== "alumno") return;
    api<Expediente>(`/api/expediente?autor=${encodeURIComponent(usuario.nombre)}`)
      .then(setExpediente)
      .catch(() => undefined);
  }, [usuario]);

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
  if (!datos) return <p className="texto-suave">Cargando curso…</p>;

  const { curso, comunidad } = datos;
  const base = lecciones.filter((l) => !l.deCoach);
  const minutos = base.reduce((s, l) => s + l.duracion_min, 0);
  const hechas = base.filter((l) => completadas.includes(l.id)).length;
  const siguiente = lecciones.find((l) => !completadas.includes(l.id) && (l.gratis || tieneAcceso));
  const terminado = base.length > 0 && hechas === base.length;

  return (
    <div className="pagina-curso">
      <Link href="/comunidad" className="volver">
        <IconoFlechaIzq width={16} height={16} /> Volver a la comunidad
      </Link>
      <header className="curso-portada">
        <Arcos />
        <div className="curso-portada-textos">
          <h1>{curso.titulo}</h1>
          <p className="curso-subtitulo">{curso.subtitulo}</p>
          <ul className="curso-datos" aria-label="Datos del curso">
            <li>Con {comunidad.coach}</li>
            <li>
              <span className="cifra">{curso.modulos.filter((m) => m.id !== "MC").length}</span> módulos
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
          <p className="curso-progreso-cifra">
            <span className="cifra">{hechas}</span>
            <span className="curso-progreso-total">
              de <span className="cifra">{base.length}</span> lecciones completadas
            </span>
          </p>
          <div className="progreso" aria-hidden="true">
            <span style={{ transform: `scaleX(${base.length ? hechas / base.length : 0})` }} />
          </div>
          {siguiente && (
            <>
              <p className="curso-siguiente">
                {hechas === 0 ? "Primera lección" : "Sigue"}: <strong>{siguiente.titulo}</strong>
              </p>
              <Link href={`/curso/${siguiente.id}`} className="boton">
                {hechas === 0 ? "Empezar el curso" : "Continuar"}
              </Link>
            </>
          )}
        </div>
      </header>

      {!tieneAcceso && (
        <div className="aviso">
          <p>
            <strong>El módulo 1 es gratis.</strong> El resto del curso es para miembros; se paga con OXXO, SPEI o
            Mercado Pago.
          </p>
          <Link href="/membresia" className="boton boton-chico boton-secundario">
            {pagoPendiente ? "Ver mi ficha de pago" : `Unirme por ${moneda(comunidad.precio_mensual)} al mes`}
          </Link>
        </div>
      )}

      <ol className="modulos">
        {curso.modulos.map((modulo, i) => {
          const hechasModulo = modulo.lecciones.filter((l) => completadas.includes(l.id)).length;
          return (
            <li key={modulo.id} className="tarjeta modulo">
              <div className="modulo-cabecera">
                <h2 className="modulo-titulo">
                  <span className="modulo-numero">{modulo.id === "MC" ? "Extra" : `Módulo ${i + 1}`}</span>
                  {modulo.titulo}
                </h2>
                <span className="modulo-avance texto-suave">
                  <span className="cifra">
                    {hechasModulo}/{modulo.lecciones.length}
                  </span>
                  <span className="sr-only"> lecciones completadas</span>
                </span>
              </div>
              <ul className="lista-lecciones">
                {modulo.lecciones.map((l) => {
                  const bloqueada = !l.gratis && !tieneAcceso;
                  const hecha = completadas.includes(l.id);
                  const estado = hecha ? "hecha" : bloqueada ? "bloqueada" : "abierta";
                  return (
                    <li key={l.id}>
                      <Link href={`/curso/${l.id}`} className="fila-leccion" data-bloqueada={bloqueada}>
                        <span className="estado-leccion" data-estado={estado}>
                          {hecha ? <IconoCheck /> : bloqueada ? <IconoCandado /> : <IconoPlay />}
                        </span>
                        <span className="fila-leccion-textos">
                          <span className="fila-leccion-titulo">{l.titulo}</span>
                          <span className="sr-only">
                            {hecha ? "Completada." : bloqueada ? "Para miembros." : "Disponible."}
                          </span>
                          <span className="texto-suave">{l.resumen}</span>
                        </span>
                        <span className="fila-leccion-meta">
                          {l.video && (
                            <span className="pastilla" title="Esta lección tiene video">
                              <IconoVideo width={13} height={13} /> Video
                            </span>
                          )}
                          {l.gratis && !l.deCoach && <span className="pastilla">Gratis</span>}
                          {l.deCoach && <span className="pastilla pastilla-marca">De la coach</span>}
                          <span className="texto-suave cifra">{l.duracion_min} min</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      <section className="tarjeta examen-tarjeta" aria-labelledby="examen-titulo">
        <span className="examen-tarjeta-icono" aria-hidden="true">
          {expediente?.examen.aprobado ? <IconoAprobado width={26} height={26} /> : <IconoExamen width={26} height={26} />}
        </span>
        <div className="examen-tarjeta-textos">
          <h2 id="examen-titulo">Examen final</h2>
          <p className="texto-suave">
            {expediente?.examen.aprobado
              ? `Aprobado con ${expediente.examen.mejorPuntaje}%. Ya está en tu expediente.`
              : terminado
                ? "Ya puedes presentarlo: preguntas de todo el curso y apruebas con 70%."
                : `Se desbloquea al terminar las ${base.length} lecciones. Llevas ${hechas}.`}
          </p>
        </div>
        {expediente?.examen.aprobado ? (
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
      </section>
    </div>
  );
}
