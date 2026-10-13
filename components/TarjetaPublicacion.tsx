"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, hace } from "@/lib/cliente";
import type { Publicacion } from "@/lib/tipos";
import Avatar from "./Avatar";
import { useApp } from "./Contexto";
import { IconoBorrar, IconoComentario, IconoFijado, IconoUtil } from "./Iconos";

// Cuántos comentarios se ven sin abrir la conversación completa.
const VISTA_PREVIA = 2;

export default function TarjetaPublicacion({
  publicacion: p,
  alCambiar,
  alBorrar,
}: {
  publicacion: Publicacion;
  alCambiar: (p: Publicacion) => void;
  /** La coach modera: al borrar la publicación, la página la quita de la lista. */
  alBorrar?: (id: number) => void;
}) {
  const { usuario, setPidiendoUsuario } = useApp();
  const [todos, setTodos] = useState(false);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meSirve = !!usuario && p.reacciones.includes(usuario.nombre);
  // En el celular, un anuncio fijado largo se muestra recortado para que no
  // ocupe toda la pantalla en cada visita; se despliega con un toque.
  const [expandida, setExpandida] = useState(false);
  const [recortada, setRecortada] = useState(false);
  const cuerpoRef = useRef<HTMLParagraphElement>(null);
  const campoComentario = useRef<HTMLInputElement>(null);
  const esCoach = usuario?.rol === "coach";
  // Qué se está por borrar: la publicación ("p") o un comentario (su id).
  const [porBorrar, setPorBorrar] = useState<"p" | number | null>(null);

  useEffect(() => {
    if (!p.fijada) return;
    const medir = () => {
      const el = cuerpoRef.current;
      if (el && !expandida) setRecortada(el.scrollHeight > el.clientHeight + 2);
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [p.fijada, expandida]);

  const reaccionar = async () => {
    if (!usuario) return setPidiendoUsuario(true);
    try {
      alCambiar(
        await api<Publicacion>(`/api/publicaciones/${p.id}/reaccion`, {
          method: "POST",
          json: { autor: usuario.nombre },
        }),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const comentar = async (e: FormEvent) => {
    e.preventDefault();
    if (!usuario) return setPidiendoUsuario(true);
    setEnviando(true);
    setError(null);
    try {
      alCambiar(
        await api<Publicacion>(`/api/publicaciones/${p.id}/comentarios`, {
          method: "POST",
          json: { autor: usuario.nombre, rol: usuario.rol, cuerpo: comentario },
        }),
      );
      setComentario("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const borrar = async () => {
    setError(null);
    try {
      if (porBorrar === "p") {
        await api(`/api/publicaciones/${p.id}`, { method: "DELETE", headers: { "X-Rol": "coach" } });
        alBorrar?.(p.id);
      } else if (porBorrar !== null) {
        alCambiar(
          await api<Publicacion>(`/api/publicaciones/${p.id}/comentarios/${porBorrar}`, {
            method: "DELETE",
            headers: { "X-Rol": "coach" },
          }),
        );
      }
      setPorBorrar(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const confirmacion = (texto: string) => (
    <span className="confirmacion" role="group" aria-label={texto}>
      {texto}
      <button type="button" className="boton boton-chico" onClick={borrar}>
        Sí, borrar
      </button>
      <button type="button" className="boton boton-chico boton-fantasma" onClick={() => setPorBorrar(null)}>
        Cancelar
      </button>
    </span>
  );

  const total = p.comentarios.length;
  const visibles = todos ? p.comentarios : p.comentarios.slice(-VISTA_PREVIA);
  const ocultos = total - visibles.length;

  return (
    <article className="publicacion" data-fijada={p.fijada} data-expandida={expandida}>
      {p.fijada && (
        <p className="publicacion-cinta">
          <IconoFijado width={14} height={14} weight="fill" /> Anuncio fijado
        </p>
      )}

      <div className="publicacion-contenido">
        <header className="publicacion-cabecera">
          <Avatar nombre={p.autor} tamaño={42} coach={p.rol === "coach"} />
          <div className="publicacion-meta">
            <span className="publicacion-autor">
              {p.autor}
              {p.rol === "coach" && <span className="insignia">Coach</span>}
            </span>
            <span className="publicacion-detalle">
              <time dateTime={p.creadaEn}>{hace(p.creadaEn)}</time> en{" "}
              <span className={`categoria categoria-${p.categoria.toLowerCase()}`}>{p.categoria}</span>
            </span>
          </div>
          {esCoach && alBorrar && porBorrar !== "p" && (
            <button
              type="button"
              className="boton-icono boton-icono-chico publicacion-borrar"
              onClick={() => setPorBorrar("p")}
              aria-label={`Borrar la publicación «${p.titulo}»`}
              title="Borrar publicación"
            >
              <IconoBorrar width={15} height={15} />
            </button>
          )}
        </header>
        {porBorrar === "p" && confirmacion("¿Borrar esta publicación y sus comentarios?")}

        <h2 className="publicacion-titulo">{p.titulo}</h2>
        <p className="publicacion-cuerpo" ref={cuerpoRef} id={`cuerpo-${p.id}`}>
          {p.cuerpo}
        </p>
        {p.fijada && (recortada || expandida) && (
          <button
            type="button"
            className="enlace leer-mas"
            aria-expanded={expandida}
            aria-controls={`cuerpo-${p.id}`}
            onClick={() => setExpandida((v) => !v)}
          >
            {expandida ? "Ver menos" : "Leer el anuncio completo"}
          </button>
        )}

        <footer className="publicacion-acciones">
          <button type="button" className="accion" aria-pressed={meSirve} onClick={reaccionar}>
            <IconoUtil width={17} height={17} weight={meSirve ? "fill" : "regular"} />
            Me sirve{p.reacciones.length > 0 && <span className="conteo">{p.reacciones.length}</span>}
          </button>
          {/* Lleva al campo de abajo; con otro nombre para que no se oiga "Comentar" dos veces */}
          <button
            type="button"
            className="accion"
            onClick={() => campoComentario.current?.focus()}
            aria-label={
              total === 0
                ? "Escribir un comentario"
                : `${total} comentario${total === 1 ? "" : "s"}; escribir uno`
            }
          >
            <IconoComentario width={17} height={17} aria-hidden="true" />
            {total === 0 ? "Comentar" : `${total} comentario${total === 1 ? "" : "s"}`}
          </button>
        </footer>
      </div>

      <div className="publicacion-conversacion">
        {ocultos > 0 && (
          <button type="button" className="enlace enlace-discreto ver-comentarios" onClick={() => setTodos(true)}>
            Ver {ocultos === 1 ? "el comentario anterior" : `los ${ocultos} comentarios anteriores`}
          </button>
        )}
        {visibles.map((c) => (
          <div key={c.id} className="comentario">
            <Avatar nombre={c.autor} tamaño={32} coach={c.rol === "coach"} />
            <div className="comentario-burbuja">
              <span className="comentario-autor">
                {c.autor}
                {c.rol === "coach" && <span className="insignia">Coach</span>}
                <time dateTime={c.creadoEn}>{hace(c.creadoEn)}</time>
                {esCoach && porBorrar !== c.id && (
                  <button
                    type="button"
                    className="enlace enlace-discreto comentario-borrar"
                    onClick={() => setPorBorrar(c.id)}
                    aria-label={`Borrar el comentario de ${c.autor}`}
                  >
                    Borrar
                  </button>
                )}
              </span>
              <p>{c.cuerpo}</p>
              {porBorrar === c.id && confirmacion("¿Borrar este comentario?")}
            </div>
          </div>
        ))}
        <form className="comentar" onSubmit={comentar}>
          <Avatar nombre={usuario?.nombre ?? "?"} tamaño={32} coach={usuario?.rol === "coach"} />
          <input
            id={`comentario-${p.id}`}
            ref={campoComentario}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder={total === 0 ? "Sé la primera persona en comentar" : "Escribe un comentario"}
            maxLength={2000}
            aria-label={`Escribe un comentario en «${p.titulo}»`}
            required
          />
          <button type="submit" className="boton boton-chico" disabled={enviando || !comentario.trim()}>
            {enviando ? "Publicando…" : "Publicar comentario"}
          </button>
        </form>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}
