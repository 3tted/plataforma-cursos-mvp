"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useApp } from "@/components/Contexto";
import { IconoAsistenteGeneral, IconoBillete, IconoComunidad, IconoPanel } from "@/components/Iconos";
import { useTitulo } from "@/components/useTitulo";
import { api } from "@/lib/cliente";
import { RANGOS_ALUMNOS, type CuentaPublica } from "@/lib/tipos";

const VENTAJAS = [
  {
    Icono: IconoComunidad,
    titulo: "Tus comunidades y tus cursos, con tu marca",
    texto: "Tus alumnos entran a tus comunidades, toman tus cursos y ven tu logo y tu color.",
  },
  {
    Icono: IconoAsistenteGeneral,
    titulo: "Un asistente que responde con tus lecciones",
    texto: "Resuelve las dudas al momento y dice de qué lección sale la respuesta. También arma cursos a partir de tu material.",
  },
  {
    Icono: IconoBillete,
    titulo: "Cobros en pesos, sin depender de tarjeta",
    texto: "Membresía mensual con OXXO, SPEI o Mercado Pago. En esta demostración los pagos son simulados.",
  },
  {
    Icono: IconoPanel,
    titulo: "Ves quién avanza y qué cuesta más",
    texto: "El avance de cada alumno, quién requiere apoyo y lo que más le preguntan al asistente.",
  },
];

const ROLES = [
  { rol: "Dueño", texto: "Registra la empresa y la maneja. Nadie lo puede quitar y puede pasarle la empresa a otra persona." },
  { rol: "Administradores", texto: "Manejan la empresa con el dueño: invitan, cambian roles, moderan y cambian la marca." },
  { rol: "Coaches", texto: "Crean y dan los cursos. Ven a los alumnos, su avance y los pagos, y moderan." },
  { rol: "Alumnos", texto: "Se unen a tus comunidades y se inscriben a tus cursos. Con la misma cuenta toman cursos de otras empresas." },
];

// Registrar una empresa en Merkatics: quien la registra queda como su dueño y
// después invita a su equipo (administradores y coaches). En el MVP se crea al
// momento; en la versión real Merkatics la revisaría antes de activarla.
export default function PaginaRegistraTuEmpresa() {
  const router = useRouter();
  const { usuario, guardarUsuario, pedirEntrada, avisar } = useApp();
  const [empresa, setEmpresa] = useState("");
  const [giro, setGiro] = useState("");
  const [alumnos, setAlumnos] = useState("");
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useTitulo("Registra tu empresa");

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!alumnos) return setError("Elige cuántos alumnos tienes hoy.");
    setEnviando(true);
    try {
      const r = await api<{ cuenta: CuentaPublica; empresa: { id: string; nombre: string } }>("/api/empresas", {
        method: "POST",
        json: { empresa, giro, alumnos, ...(usuario ? {} : { nombre, correo, contrasena }) },
      });
      guardarUsuario(r.cuenta);
      avisar(`${r.empresa.nombre} quedó registrada y eres su dueño. Empiezan tus 7 días gratis.`);
      router.push("/coach/plan?nueva=1");
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  };

  const yaEsDeUnEquipo = usuario?.rol === "coach";

  return (
    <div className="pagina-coaches">
      <section className="coaches-propuesta" aria-labelledby="registro-titulo">
        <p className="coaches-etiqueta">Para coaches, consultores y escuelas</p>
        <h1 id="registro-titulo">Abre tu empresa en Merkatics</h1>
        <p className="coaches-texto">
          Tu empresa reúne a tu equipo, tus comunidades y tus cursos, con tu marca y un asistente que responde con tu
          contenido.
        </p>
        <ul className="coaches-ventajas">
          {VENTAJAS.map(({ Icono, titulo, texto }) => (
            <li key={titulo}>
              <span className="coaches-ventaja-icono" aria-hidden="true">
                <Icono width={20} height={20} />
              </span>
              <span>
                <strong>{titulo}</strong>
                <span className="texto-suave">{texto}</span>
              </span>
            </li>
          ))}
        </ul>

        <h2 className="coaches-subtitulo">Cómo funciona</h2>
        <ol className="coaches-pasos">
          <li>Registras tu empresa y quedas como su dueño. Tienes 7 días gratis con todo abierto.</li>
          <li>Configuras tu marca, invitas a tu equipo y creas tus comunidades y cursos (a mano o con IA).</li>
          <li>Eliges cómo pagar: tarjeta, OXXO, SPEI o Mercado Pago. Al terminar la prueba se cobra el primer mes.</li>
        </ol>
        <p className="coaches-precio">
          <strong>7 días gratis</strong>, después <strong>1 USD al mes</strong> (precio provisional). Cancelas cuando
          quieras; si cancelas durante la prueba, no se te cobra nada.
        </p>

        <h2 className="coaches-subtitulo">Quién hace qué</h2>
        <dl className="coaches-roles">
          {ROLES.map((r) => (
            <div key={r.rol}>
              <dt>{r.rol}</dt>
              <dd className="texto-suave">{r.texto}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="tarjeta coaches-forma" aria-labelledby="forma-titulo">
        {yaEsDeUnEquipo ? (
          <div className="coaches-enviada">
            <h2 id="forma-titulo">Ya eres parte de una empresa</h2>
            <p>
              Tu cuenta (<strong>{usuario.nombre}</strong>) ya es del equipo de una empresa. Para registrar otra, sal y usa
              otra cuenta.
            </p>
            <Link href="/coach/empresa" className="boton boton-secundario">
              Ir a mi empresa
            </Link>
          </div>
        ) : (
          <form onSubmit={enviar} noValidate>
            <h2 id="forma-titulo">Registra tu empresa</h2>
            <fieldset className="coaches-grupo">
              <legend>Tu empresa</legend>
              <label className="campo">
                <span>Nombre de la empresa</span>
                <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} maxLength={60} autoComplete="organization" />
              </label>
              <label className="campo">
                <span>¿A qué se dedica? (opcional)</span>
                <input
                  value={giro}
                  onChange={(e) => setGiro(e.target.value)}
                  maxLength={120}
                  placeholder="Por ejemplo: cursos de finanzas para negocios pequeños"
                />
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

            {usuario ? (
              <p className="aviso-entrada">
                Se registra con tu cuenta (<strong>{usuario.nombre}</strong>): quedas como dueño. Lo que hiciste como
                alumno se queda igual.
              </p>
            ) : (
              <fieldset className="coaches-grupo">
                <legend>Tu cuenta (serás el dueño)</legend>
                <label className="campo">
                  <span>Tu nombre</span>
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} autoComplete="name" />
                </label>
                <label className="campo">
                  <span>Correo</span>
                  <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="email" inputMode="email" />
                </label>
                <label className="campo">
                  <span>Contraseña</span>
                  <input
                    type="password"
                    value={contrasena}
                    onChange={(e) => setContrasena(e.target.value)}
                    autoComplete="new-password"
                    aria-describedby="registro-contrasena-nota"
                  />
                  <span className="nota" id="registro-contrasena-nota">
                    Al menos 8 caracteres.
                  </span>
                </label>
                <p className="nota">
                  ¿Ya tienes una cuenta?{" "}
                  <button type="button" className="enlace-boton" onClick={() => pedirEntrada()}>
                    Entra con ella
                  </button>{" "}
                  y registra tu empresa aquí mismo.
                </p>
              </fieldset>
            )}

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="boton boton-bloque" disabled={enviando}>
              {enviando ? "Registrando…" : "Empezar mis 7 días gratis"}
            </button>
            <p className="nota">
              Modo demostración: tu empresa queda lista al momento y los pagos son simulados (no se cobra nada). Después
              de registrarte eliges tu forma de pago.
            </p>
            <p className="nota">¿Te invitaron al equipo de una empresa? Abre el enlace que te compartieron.</p>
          </form>
        )}
      </section>
    </div>
  );
}
