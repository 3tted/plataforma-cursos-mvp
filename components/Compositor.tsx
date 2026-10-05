"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/cliente";
import { CATEGORIAS, type Categoria, type Publicacion } from "@/lib/tipos";
import Avatar from "./Avatar";
import { useApp } from "./Contexto";

export default function Compositor({
  alPublicar,
  primeraVez = false,
}: {
  alPublicar: (p: Publicacion) => void;
  /** Alumno sin publicaciones propias todavía: se propone presentarse primero. */
  primeraVez?: boolean;
}) {
  const { usuario, borrador, setBorrador, setPidiendoUsuario } = useApp();
  const [abierto, setAbierto] = useState(false);
  const [categoria, setCategoria] = useState<Categoria>("Dudas");
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [fijar, setFijar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const botonAbrir = useRef<HTMLButtonElement>(null);
  const estuvoAbierto = useRef(false);
  const esCoach = usuario?.rol === "coach";

  // Un borrador llega desde el asistente ("Llevar a la comunidad") o del panel.
  useEffect(() => {
    if (!borrador) return;
    setCategoria(borrador.categoria);
    setTitulo(borrador.titulo);
    setCuerpo(borrador.cuerpo);
    setAbierto(true);
    setBorrador(null);
  }, [borrador, setBorrador]);

  // Al cerrar (publicar o cancelar), el foco vuelve a donde estaba.
  useEffect(() => {
    if (abierto) estuvoAbierto.current = true;
    else if (estuvoAbierto.current) botonAbrir.current?.focus();
  }, [abierto]);

  const categorias = CATEGORIAS.filter((c) => c !== "Anuncios" || esCoach);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!usuario) return setPidiendoUsuario(true);
    setEnviando(true);
    setError(null);
    try {
      const nueva = await api<Publicacion>("/api/publicaciones", {
        method: "POST",
        json: {
          autor: usuario.nombre,
          rol: usuario.rol,
          categoria,
          titulo,
          cuerpo,
          fijada: esCoach && categoria === "Anuncios" && fijar,
        },
      });
      alPublicar(nueva);
      setTitulo("");
      setCuerpo("");
      setFijar(false);
      setAbierto(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const abrir = () => {
    if (!titulo && !cuerpo) setCategoria(primeraVez ? "Presentaciones" : esCoach ? "Anuncios" : "Dudas");
    setAbierto(true);
  };

  if (!abierto) {
    return (
      <button type="button" className="tarjeta compositor-cerrado" onClick={abrir} ref={botonAbrir}>
        <Avatar nombre={usuario?.nombre ?? "?"} tamaño={36} />
        <span>
          {primeraVez
            ? "Preséntate con la comunidad: ¿a qué se dedica tu negocio?"
            : esCoach
              ? "Escribe un anuncio o responde a tu comunidad…"
              : "Comparte una duda, un logro o una idea con la comunidad…"}
        </span>
      </button>
    );
  }

  const presentacion = categoria === "Presentaciones";

  return (
    <form className="tarjeta compositor" onSubmit={enviar}>
      <div className="compositor-fila">
        <label className="campo campo-compacto">
          <span>Categoría</span>
          <select
            id="compositor-categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as Categoria)}
          >
            {categorias.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="campo campo-crece">
          <span>Título</span>
          <input
            id="compositor-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={140}
            placeholder={presentacion ? "Por ejemplo: Hola desde Puebla, tengo una repostería" : "¿De qué quieres hablar?"}
            required
            autoFocus
          />
        </label>
      </div>
      <label className="campo">
        <span>Mensaje</span>
        <textarea
          id="compositor-cuerpo"
          value={cuerpo}
          onChange={(e) => setCuerpo(e.target.value)}
          maxLength={4000}
          rows={5}
          placeholder={
            presentacion ? "Cuéntanos a qué te dedicas y qué te gustaría resolver con el curso." : "Cuéntale a la comunidad…"
          }
          required
        />
      </label>
      {esCoach && categoria === "Anuncios" && (
        <label className="casilla">
          <input type="checkbox" checked={fijar} onChange={(e) => setFijar(e.target.checked)} />
          Fijarlo arriba de la comunidad
        </label>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="fila-acciones">
        <button type="button" className="boton boton-fantasma" onClick={() => setAbierto(false)}>
          Cancelar
        </button>
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? "Publicando…" : "Publicar"}
        </button>
      </div>
    </form>
  );
}
