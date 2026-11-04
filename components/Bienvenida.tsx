"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { api } from "@/lib/cliente";
import { RANGOS_ALUMNOS, type CuentaPublica } from "@/lib/tipos";
import { useApp } from "./Contexto";
import { IconoAlumno, IconoEmpresa, IconoFlechaDer, IconoFlechaIzq, IconoGoogle, IconoInvitar } from "./Iconos";

type Modo = "entrar" | "crear";
/** Qué quiere hacer quien crea su cuenta. */
type Tipo = "alumno" | "empresa" | "invitacion";

const TIPOS: { id: Tipo; titulo: string; detalle: string; Icono: typeof IconoAlumno }[] = [
  {
    id: "alumno",
    titulo: "Quiero aprender",
    detalle: "Únete a comunidades y toma cursos de cualquier empresa.",
    Icono: IconoAlumno,
  },
  {
    id: "empresa",
    titulo: "Quiero abrir mi empresa",
    detalle: "Vende tus cursos con tu comunidad y tu marca. Pruébalo 7 días gratis.",
    Icono: IconoEmpresa,
  },
  {
    id: "invitacion",
    titulo: "Me invitaron a una empresa",
    detalle: "Entra como coach o administrador con el enlace que te mandaron.",
    Icono: IconoInvitar,
  },
];

/** A dónde vuelve quien entra con Google: la página en la que estaba. */
const aqui = () => window.location.pathname + window.location.search;

/** El código de una invitación, a partir de su enlace (…/invitacion/<código>) o del código solo. */
function codigoDeInvitacion(texto: string): string | null {
  const limpio = texto.trim();
  const codigo = limpio.includes("/invitacion/") ? limpio.split("/invitacion/")[1].split(/[?#/\s]/)[0] : limpio;
  return /^[A-Za-z0-9_-]{6,40}$/.test(codigo) ? codigo : null;
}

// Pantalla de entrada: con correo y contraseña, con Google (si el servidor lo
// tiene configurado) o con una cuenta de demostración. Al crear la cuenta se
// elige qué se quiere hacer: aprender (alumno), abrir una empresa (dueño) o
// entrar a una empresa con su invitación (coach o administrador). Cada quien
// termina en su vista: el inicio del alumno, el área de coach o su invitación.
export default function Bienvenida() {
  const router = useRouter();
  const { listo, pidiendoUsuario, setPidiendoUsuario, usuario, guardarUsuario, rolSugerido, opcionesEntrada, avisoEntrada, avisar } =
    useApp();
  const [modo, setModo] = useState<Modo>("entrar");
  const [tipo, setTipo] = useState<Tipo | null>(null);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [giro, setGiro] = useState("");
  const [alumnos, setAlumnos] = useState("");
  const [invitacion, setInvitacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);
  const primerCampo = useRef<HTMLInputElement>(null);
  const visible = listo && pidiendoUsuario && !usuario;

  useEffect(() => {
    if (!visible) return;
    // Desde un botón para coaches se abre directo "Crear cuenta", con las opciones.
    setModo(rolSugerido === "coach" ? "crear" : "entrar");
    setTipo(null);
    setError(null);
    setContrasena("");
  }, [visible, rolSugerido]);

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
  }, [visible, modo, tipo]);

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
    setError(null);
    if (modo === "entrar") {
      if (!correo.trim() || !contrasena) return setError("Escribe tu correo y tu contraseña.");
      return entrarCon({ correo, contrasena });
    }
    if (tipo === "invitacion") {
      const codigo = codigoDeInvitacion(invitacion);
      if (!codigo) return setError("Pega el enlace completo que te mandaron (o solo su código).");
      setPidiendoUsuario(false);
      router.push(`/invitacion/${codigo}`);
      return;
    }
    if (nombre.trim().length < 2) return setError("Escribe tu nombre: es con el que se firman tus publicaciones.");
    if (tipo === "empresa" && !alumnos) return setError("Elige cuántos alumnos tienes hoy.");
    setEnviando(true);
    try {
      if (tipo === "empresa") {
        const r = await api<{ cuenta: CuentaPublica; empresa: { nombre: string } }>("/api/empresas", {
          method: "POST",
          json: { empresa, giro, alumnos, nombre, correo, contrasena },
        });
        alEntrar(r.cuenta);
        avisar(`${r.empresa.nombre} quedó registrada y eres su dueño. Empiezan tus 7 días gratis.`);
        router.push("/coach/plan?nueva=1");
      } else {
        alEntrar((await api<{ cuenta: CuentaPublica }>("/api/cuentas", { method: "POST", json: { nombre, correo, contrasena } })).cuenta);
      }
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

  const cambiarModo = (m: Modo, t: Tipo | null = null) => {
    setModo(m);
    setTipo(t);
    setError(null);
  };

  const google = opcionesEntrada?.google;
  const demo = opcionesEntrada?.demo;
  const eligiendo = modo === "crear" && tipo === null;
  const conCuenta = modo === "crear" && (tipo === "alumno" || tipo === "empresa");
  const titulo =
    modo === "entrar"
      ? "Entra a Merkatics"
      : tipo === "empresa"
        ? "Abre tu empresa"
        : tipo === "invitacion"
          ? "Entra con tu invitación"
          : tipo === "alumno"
            ? "Crea tu cuenta"
            : "¿Qué quieres hacer?";

  const campoCuenta = (
    <>
      <label className="campo">
        <span>Tu nombre</span>
        <input
          ref={tipo === "alumno" ? primerCampo : undefined}
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
    </>
  );

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
          <h1 id="entrada-titulo">{titulo}</h1>

          <div className="entrada-pestanas" role="group" aria-label="Entrar o crear cuenta">
            <button type="button" aria-pressed={modo === "entrar"} onClick={() => cambiarModo("entrar")}>
              Ya tengo cuenta
            </button>
            <button type="button" aria-pressed={modo === "crear"} onClick={() => cambiarModo("crear")}>
              Crear cuenta
            </button>
          </div>

          {avisoEntrada && <p className="aviso-entrada">{avisoEntrada}</p>}

          {/* Crear cuenta, paso 1: qué quiere hacer */}
          {eligiendo && (
            <ul className="entrada-tipos" aria-label="Qué quieres hacer">
              {TIPOS.map(({ id, titulo: t, detalle, Icono }) => (
                <li key={id}>
                  <button type="button" className="entrada-tipo" onClick={() => cambiarModo("crear", id)}>
                    <Icono width={24} height={24} className="entrada-tipo-icono" />
                    <span>
                      <span className="entrada-tipo-titulo">{t}</span>
                      <span className="entrada-tipo-detalle">{detalle}</span>
                    </span>
                    <IconoFlechaDer width={16} height={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {modo === "crear" && tipo && (
            <button type="button" className="enlace-boton entrada-otra" onClick={() => cambiarModo("crear")}>
              <IconoFlechaIzq width={14} height={14} /> Elegir otra opción
            </button>
          )}

          {/* Abrir una empresa: primero sus datos */}
          {modo === "crear" && tipo === "empresa" && (
            <fieldset className="coaches-grupo">
              <legend>Tu empresa</legend>
              <label className="campo">
                <span>Nombre de la empresa</span>
                <input ref={primerCampo} value={empresa} onChange={(e) => setEmpresa(e.target.value)} maxLength={60} autoComplete="organization" />
              </label>
              <label className="campo">
                <span>¿A qué se dedica? (opcional)</span>
                <input value={giro} onChange={(e) => setGiro(e.target.value)} maxLength={120} />
              </label>
              <fieldset className="coaches-alumnos">
                <legend>¿Cuántos alumnos tienes hoy?</legend>
                <div className="coaches-alumnos-opciones">
                  {RANGOS_ALUMNOS.map((r) => (
                    <button key={r} type="button" aria-pressed={alumnos === r} onClick={() => setAlumnos(r)}>
                      {r}
                    </button>
                  ))}
                </div>
              </fieldset>
            </fieldset>
          )}

          {/* Me invitaron: el enlace o el código */}
          {modo === "crear" && tipo === "invitacion" && (
            <label className="campo">
              <span>Enlace o código de tu invitación</span>
              <input
                ref={primerCampo}
                value={invitacion}
                onChange={(e) => setInvitacion(e.target.value)}
                placeholder="https://…/invitacion/…"
                spellCheck={false}
                autoComplete="off"
                aria-describedby="entrada-invitacion-nota"
              />
              <span className="nota" id="entrada-invitacion-nota">
                Te lo manda el dueño o un administrador de la empresa. Ahí verás con qué rol entras y creas tu cuenta.
              </span>
            </label>
          )}

          {(modo === "entrar" || conCuenta) && (
            <>
              {conCuenta && tipo === "empresa" && <p className="entrada-subtitulo">Tu cuenta (serás el dueño)</p>}
              {conCuenta && campoCuenta}
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
            </>
          )}

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          {!eligiendo && (
            <button type="submit" className="boton boton-bloque" disabled={enviando}>
              {enviando
                ? "Un momento…"
                : modo === "entrar"
                  ? "Entrar"
                  : tipo === "empresa"
                    ? "Abrir mi empresa"
                    : tipo === "invitacion"
                      ? "Ver mi invitación"
                      : "Crear mi cuenta"}
            </button>
          )}

          {/* Google crea cuentas de alumno (o entra a la que ya existe). */}
          {google && (modo === "entrar" || tipo === "alumno") && (
            <>
              <p className="entrada-separador">
                <span>o</span>
              </p>
              <a className="boton boton-secundario boton-bloque boton-google" href={`/api/auth/google?volver=${encodeURIComponent(aqui())}`}>
                <IconoGoogle width={18} height={18} /> Continuar con Google
              </a>
            </>
          )}

          {modo === "crear" && tipo === "empresa" && (
            <p className="nota">Modo demostración: tu empresa queda lista al momento. En la versión real, Merkatics la revisaría antes.</p>
          )}
          {modo === "entrar" && (
            <>
              <p className="nota">
                ¿Quieres enseñar?{" "}
                <button type="button" className="enlace-boton" onClick={() => cambiarModo("crear", "empresa")}>
                  Abre tu empresa
                </button>
                .
              </p>
              <p className="nota">
                ¿Olvidaste tu contraseña? Escríbele al equipo de Merkatics: te da una contraseña temporal para entrar y
                cambiarla.
              </p>
            </>
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
