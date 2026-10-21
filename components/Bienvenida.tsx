"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { api } from "@/lib/cliente";
import type { CuentaPublica } from "@/lib/tipos";
import { useApp } from "./Contexto";
import { IconoFlechaIzq, IconoGoogle } from "./Iconos";

type Modo = "entrar" | "crear";

/** A dónde vuelve quien entra con Google: la página en la que estaba. */
const aqui = () => window.location.pathname + window.location.search;

// Pantalla de entrada: con correo y contraseña, con Google (si el servidor lo
// tiene configurado) o con una cuenta de demostración. Crear una cuenta aquí
// es de alumno; para ser coach se necesita una invitación (su enlace abre
// /invitacion/<código>).
export default function Bienvenida() {
  const { listo, pidiendoUsuario, setPidiendoUsuario, usuario, guardarUsuario, rolSugerido, opcionesEntrada, avisoEntrada } =
    useApp();
  const [modo, setModo] = useState<Modo>("entrar");
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);
  const primerCampo = useRef<HTMLInputElement>(null);
  const visible = listo && pidiendoUsuario && !usuario;

  useEffect(() => {
    if (!visible) return;
    setModo("entrar");
    setError(null);
    setContrasena("");
  }, [visible]);

  // Mientras se muestra, lo de atrás no recibe foco ni clics ni se desplaza.
  useEffect(() => {
    if (!visible) return;
    const fondo = document.querySelectorAll<HTMLElement>("[data-app-fondo]");
    fondo.forEach((el) => el.setAttribute("inert", ""));
    const html = document.documentElement;
    const antes = { html: html.style.overflow, body: document.body.style.overflow };
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    // Con mouse, el cursor va directo al primer campo; en el celular, no (el teclado taparía la pantalla).
    if (window.matchMedia("(pointer: fine)").matches) primerCampo.current?.focus();
    return () => {
      fondo.forEach((el) => el.removeAttribute("inert"));
      html.style.overflow = antes.html;
      document.body.style.overflow = antes.body;
    };
  }, [visible, modo]);

  if (!visible) return null;

  const alEntrar = (cuenta: CuentaPublica) => {
    guardarUsuario(cuenta);
    // Al entrar, la página empieza desde arriba (la de visitantes pudo quedar bajada).
    window.scrollTo(0, 0);
    requestAnimationFrame(() => window.scrollTo(0, 0));
  };

  const entrarCon = async (datos: { correo: string; contrasena: string }) => {
    setEnviando(true);
    setError(null);
    try {
      alEntrar((await api<{ cuenta: CuentaPublica }>("/api/sesion", { method: "POST", json: datos })).cuenta);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (modo === "entrar") {
      if (!correo.trim() || !contrasena) return setError("Escribe tu correo y tu contraseña.");
      return entrarCon({ correo, contrasena });
    }
    if (nombre.trim().length < 2) return setError("Escribe tu nombre: es con el que se firman tus publicaciones.");
    setEnviando(true);
    setError(null);
    try {
      alEntrar(
        (await api<{ cuenta: CuentaPublica }>("/api/cuentas", { method: "POST", json: { nombre, correo, contrasena } }))
          .cuenta,
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const alTeclear = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setPidiendoUsuario(false);
    }
  };

  const cambiarModo = (m: Modo) => {
    setModo(m);
    setError(null);
  };

  const google = opcionesEntrada?.google;
  const demo = opcionesEntrada?.demo;

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
          <button type="button" className="volver entrada-volver" onClick={() => setPidiendoUsuario(false)}>
            <IconoFlechaIzq width={16} height={16} /> Volver
          </button>
          <h1 id="entrada-titulo">{modo === "entrar" ? "Entra a Merkatics" : "Crea tu cuenta"}</h1>

          <div className="entrada-pestanas" role="group" aria-label="Entrar o crear cuenta">
            <button type="button" aria-pressed={modo === "entrar"} onClick={() => cambiarModo("entrar")}>
              Ya tengo cuenta
            </button>
            <button type="button" aria-pressed={modo === "crear"} onClick={() => cambiarModo("crear")}>
              Crear cuenta
            </button>
          </div>

          {avisoEntrada && <p className="aviso-entrada">{avisoEntrada}</p>}
          {rolSugerido === "coach" && (
            <p className="aviso-entrada">
              Para ser coach necesitas una invitación: la manda la dueña de tu empresa o el equipo de Merkatics. Si ya la
              tienes, abre su enlace; si no,{" "}
              <Link href="/coaches" onClick={() => setPidiendoUsuario(false)}>
                pide acceso aquí
              </Link>
              .
            </p>
          )}

          {modo === "crear" && (
            <label className="campo">
              <span>Tu nombre</span>
              <input
                ref={primerCampo}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={60}
                autoComplete="name"
                aria-describedby="entrada-nombre-nota"
              />
              <span className="nota" id="entrada-nombre-nota">
                Con él se firman tus publicaciones; no se puede repetir.
              </span>
            </label>
          )}
          <label className="campo">
            <span>Correo</span>
            <input
              ref={modo === "entrar" ? primerCampo : undefined}
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              autoComplete="email"
              inputMode="email"
              maxLength={120}
            />
          </label>
          <label className="campo">
            <span>Contraseña</span>
            <input
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              minLength={modo === "crear" ? 8 : undefined}
              aria-describedby={modo === "crear" ? "entrada-contrasena-nota" : undefined}
            />
            {modo === "crear" && (
              <span className="nota" id="entrada-contrasena-nota">
                Al menos 8 caracteres.
              </span>
            )}
          </label>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="boton boton-bloque" disabled={enviando}>
            {enviando ? "Un momento…" : modo === "entrar" ? "Entrar" : "Crear mi cuenta"}
          </button>

          {google && (
            <>
              <p className="entrada-separador">
                <span>o</span>
              </p>
              <a className="boton boton-secundario boton-bloque boton-google" href={`/api/auth/google?volver=${encodeURIComponent(aqui())}`}>
                <IconoGoogle width={18} height={18} /> Continuar con Google
              </a>
            </>
          )}

          {modo === "crear" ? (
            <p className="nota">
              Las cuentas nuevas son de alumno. Si tu empresa te invitó como coach, abre el enlace de tu invitación.
            </p>
          ) : (
            <p className="nota">¿Olvidaste tu contraseña? Escríbele al equipo de Merkatics: te da una contraseña temporal para entrar y cambiarla.</p>
          )}

          {demo && modo === "entrar" && (
            <section className="entrada-demo" aria-labelledby="entrada-demo-titulo">
              <h2 id="entrada-demo-titulo">Cuentas de demostración</h2>
              <p className="nota">
                Para presentar la plataforma. Son ficticias y todas usan la contraseña <code>{demo.contrasena}</code>.
              </p>
              <ul>
                {demo.cuentas.map((c) => (
                  <li key={c.correo}>
                    <button
                      type="button"
                      className="entrada-demo-cuenta"
                      disabled={enviando}
                      onClick={() => {
                        setCorreo(c.correo);
                        setContrasena(demo.contrasena);
                        void entrarCon({ correo: c.correo, contrasena: demo.contrasena });
                      }}
                    >
                      <span className="entrada-demo-nombre">{c.nombre}</span>
                      <span className="entrada-demo-detalle">
                        {c.detalle} · {c.correo}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </form>
      </div>
    </div>
  );
}
