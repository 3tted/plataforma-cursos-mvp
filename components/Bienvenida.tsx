"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { Rol } from "@/lib/tipos";
import Arcos from "./Arcos";
import { useApp } from "./Contexto";
import { IconoAlumno, IconoCoach } from "./Iconos";

// Entrada sin contraseña: en el MVP solo necesitamos un nombre para firmar
// publicaciones y saber si la persona entra como alumno o como coach.
// Sin sesión se muestra la pantalla de entrada completa; con sesión, el mismo
// formulario aparece en una ventana para cambiar de usuario o de rol.
export default function Bienvenida() {
  const { listo, pidiendoUsuario, setPidiendoUsuario, usuario, guardarUsuario } = useApp();
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<Rol>("alumno");
  const [error, setError] = useState<string | null>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const campoNombre = useRef<HTMLInputElement>(null);
  const pantallaCompleta = listo && !usuario;
  const visible = pantallaCompleta || pidiendoUsuario;

  useEffect(() => {
    if (visible) {
      setNombre(usuario?.nombre ?? "");
      setRol(usuario?.rol ?? "alumno");
      setError(null);
    }
  }, [visible, usuario]);

  // Mientras se muestra, lo de atrás no recibe foco ni clics.
  useEffect(() => {
    if (!visible) return;
    const fondo = document.querySelectorAll<HTMLElement>("[data-app-fondo]");
    fondo.forEach((el) => el.setAttribute("inert", ""));
    // Con mouse, el cursor va directo al nombre; en el celular el teclado
    // taparía la elección de rol, así que el foco se queda en la opción elegida.
    const conMouse = window.matchMedia("(pointer: fine)").matches;
    (conMouse ? campoNombre.current : formulario.current?.querySelector<HTMLInputElement>("input[name=rol]:checked"))?.focus();
    return () => fondo.forEach((el) => el.removeAttribute("inert"));
  }, [visible]);

  if (!visible) return null;

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const limpio = nombre.trim();
    if (!limpio) {
      setError("Escribe tu nombre: es con el que se firman tus publicaciones.");
      campoNombre.current?.focus();
      return;
    }
    guardarUsuario({ nombre: limpio.slice(0, 60), rol });
  };

  const alTeclear = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Escape" && usuario) {
      e.preventDefault();
      setPidiendoUsuario(false);
      return;
    }
    if (pantallaCompleta || e.key !== "Tab" || !formulario.current) return;
    const enfocables = formulario.current.querySelectorAll<HTMLElement>("input:checked, input:not([type=radio]), button");
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  };

  const campos = (
    <>
      <fieldset className="opciones-entrada">
        <legend className="opciones-rol-titulo">¿Cómo quieres entrar?</legend>
        <label className="opcion-entrada" data-activa={rol === "alumno"}>
          <input
            className="sr-only"
            type="radio"
            name="rol"
            value="alumno"
            checked={rol === "alumno"}
            onChange={() => setRol("alumno")}
          />
          <IconoAlumno width={24} height={24} className="opcion-entrada-icono" />
          <span>
            <span className="opcion-titulo">Alumno</span>
            <span className="opcion-detalle">Toma el curso, pregunta y publica.</span>
          </span>
        </label>
        <label className="opcion-entrada" data-activa={rol === "coach"}>
          <input
            className="sr-only"
            type="radio"
            name="rol"
            value="coach"
            checked={rol === "coach"}
            onChange={() => setRol("coach")}
          />
          <IconoCoach width={24} height={24} className="opcion-entrada-icono" />
          <span>
            <span className="opcion-titulo">Coach</span>
            <span className="opcion-detalle">Sube los videos de las lecciones y publica anuncios.</span>
          </span>
        </label>
      </fieldset>

      <label className="campo">
        <span>Tu nombre</span>
        <input
          id="bienvenida-nombre"
          ref={campoNombre}
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value);
            setError(null);
          }}
          maxLength={60}
          // Sin sugerencias del navegador: en el prototipo se prueban muchos nombres y no conviene que se recuerden.
          autoComplete="off"
          enterKeyHint="go"
          aria-invalid={!!error}
          aria-describedby={error ? "bienvenida-error" : "bienvenida-nota"}
        />
      </label>
      {error && (
        <p className="error" id="bienvenida-error" role="alert">
          {error}
        </p>
      )}
    </>
  );

  // ---------------------------------------------------------------- pantalla de entrada
  if (pantallaCompleta) {
    return (
      <div className="entrada">
        <div className="entrada-marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="entrada-logo" src="/merkatics-logo.png" alt="Merkatics Growth Operating System" width={2311} height={544} />
          <svg className="entrada-curva" viewBox="0 0 800 800" preserveAspectRatio="xMaxYMax slice" aria-hidden="true" focusable="false">
            <circle cx="1080" cy="1180" r="1000" fill="var(--progreso)" />
            <circle cx="1130" cy="1250" r="985" fill="var(--rubor)" />
          </svg>
        </div>
        <div className="entrada-panel">
          <form className="entrada-formulario" onSubmit={enviar} onKeyDown={alTeclear} ref={formulario} noValidate>
            <h1 id="entrada-titulo">Cursos en línea</h1>
            <p className="texto-suave">
              Toma los cursos de tu coach, resuelve tus dudas con un asistente que responde con las lecciones y participa
              en su comunidad.
            </p>
            {campos}
            <button type="submit" className="boton boton-bloque">
              Entrar
            </button>
            <p className="nota" id="bienvenida-nota">
              Es un prototipo: no hay contraseñas y tu nombre solo se usa para firmar lo que publiques.
            </p>
          </form>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- ventana para cambiar de usuario
  return (
    <div className="modal-fondo" role="dialog" aria-modal="true" aria-labelledby="bienvenida-titulo">
      <form className="modal" onSubmit={enviar} onKeyDown={alTeclear} ref={formulario} noValidate>
        <Arcos className="arcos-modal" />
        <h2 id="bienvenida-titulo">Cambiar de usuario</h2>
        {campos}
        <p className="nota" id="bienvenida-nota">
          Es un prototipo: no hay contraseñas y tu nombre solo se usa para firmar lo que publiques.
        </p>
        <div className="modal-acciones">
          <button type="button" className="boton boton-fantasma" onClick={() => setPidiendoUsuario(false)}>
            Cancelar
          </button>
          <button type="submit" className="boton">
            Entrar
          </button>
        </div>
      </form>
    </div>
  );
}
