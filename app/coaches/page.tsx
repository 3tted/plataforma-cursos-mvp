"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useApp } from "@/components/Contexto";
import { IconoAsistenteGeneral, IconoBillete, IconoComunidad, IconoPanel } from "@/components/Iconos";
import { useTitulo } from "@/components/useTitulo";
import { api } from "@/lib/cliente";
import { RANGOS_ALUMNOS } from "@/lib/tipos";

const VENTAJAS = [
  {
    Icono: IconoComunidad,
    titulo: "Tu comunidad y tus cursos, con tu marca",
    texto: "Tus alumnos entran a tu comunidad, toman tus cursos y ven tu logo y tu color.",
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

// Para coaches: qué les ofrece la plataforma y el formulario para pedir
// acceso (ser coach es por invitación). En el MVP la solicitud solo se guarda:
// el equipo de Merkatics la ve en Mi empresa y comparte la invitación a mano.
export default function PaginaCoaches() {
  const { usuario } = useApp();
  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [contacto, setContacto] = useState(usuario?.correo ?? "");
  const [empresa, setEmpresa] = useState("");
  const [tema, setTema] = useState("");
  const [alumnos, setAlumnos] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);
  useTitulo("Para coaches");

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!alumnos) return setError("Elige cuántos alumnos tienes hoy.");
    setEnviando(true);
    try {
      await api("/api/solicitudes", { method: "POST", json: { nombre, contacto, empresa, tema, alumnos, mensaje } });
      setEnviada(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="pagina-coaches">
      <section className="coaches-propuesta" aria-labelledby="coaches-titulo">
        <p className="coaches-etiqueta">Para coaches y consultores</p>
        <h1 id="coaches-titulo">Vende tus cursos con tu propia comunidad</h1>
        <p className="coaches-texto">
          Merkatics reúne en un solo lugar tu comunidad, tus cursos y un asistente que responde con tu contenido. Pide
          acceso y te compartimos tu invitación.
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
          <li>Pides acceso con este formulario.</li>
          <li>El equipo de Merkatics lo revisa y te comparte tu enlace de invitación.</li>
          <li>Con el enlace creas tu cuenta, tu comunidad y tu primer curso (a mano o con IA).</li>
        </ol>
      </section>

      <section className="tarjeta coaches-forma" aria-labelledby="solicitud-titulo">
        {enviada ? (
          <div className="coaches-enviada" role="status">
            <h2 id="solicitud-titulo">Recibimos tu solicitud</h2>
            <p>
              El equipo de Merkatics la revisa y te comparte tu enlace de invitación por el medio que nos dejaste:{" "}
              <strong>{contacto}</strong>.
            </p>
            <p className="nota">Modo demostración: la solicitud se guardó en la plataforma; no se envió ningún correo ni mensaje.</p>
            <Link href="/comunidades" className="boton boton-secundario">
              Mientras, mira las comunidades
            </Link>
          </div>
        ) : (
          <form onSubmit={enviar} noValidate>
            <h2 id="solicitud-titulo">Pide acceso</h2>
            <label className="campo">
              <span>Tu nombre</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} autoComplete="name" />
            </label>
            <label className="campo">
              <span>Correo o WhatsApp</span>
              <input value={contacto} onChange={(e) => setContacto(e.target.value)} maxLength={120} autoComplete="email" />
            </label>
            <label className="campo">
              <span>Tu negocio o marca (opcional)</span>
              <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} maxLength={80} autoComplete="organization" />
            </label>
            <label className="campo">
              <span>¿Qué enseñas?</span>
              <input
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                maxLength={120}
                placeholder="Por ejemplo: finanzas para negocios pequeños"
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
            <label className="campo">
              <span>¿Algo más que quieras contarnos? (opcional)</span>
              <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} maxLength={600} rows={3} />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="boton boton-bloque" disabled={enviando}>
              {enviando ? "Enviando…" : "Pedir acceso"}
            </button>
            <p className="nota">
              Modo demostración: tu solicitud se guarda en la plataforma y la ve el equipo de Merkatics; no se envía
              ningún correo ni mensaje.
            </p>
            <p className="nota">¿Ya tienes una invitación? Abre el enlace que te compartieron.</p>
          </form>
        )}
      </section>
    </div>
  );
}
