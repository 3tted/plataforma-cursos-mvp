"use client";

import Link from "next/link";
import { useApp } from "./Contexto";
import { IconoCalendario, IconoWhatsapp } from "./Iconos";

// Invitación a agendar una sesión con la coach: un botón de WhatsApp (con el
// mensaje ya escrito) y otro a su liga de agenda, según lo que ella puso al
// editar su comunidad. Sin ninguno, el alumno ve cómo pedirla en la
// comunidad y la coach, dónde configurarlo.
export default function AgendarSesion({
  titulo,
  texto,
  mensaje,
}: {
  titulo: string;
  texto?: string;
  /** Lo que se manda por WhatsApp. */
  mensaje: string;
}) {
  const { datos, coachAqui } = useApp();
  const agenda = datos?.comunidad.agenda;
  const whatsapp = agenda?.whatsapp ? `https://wa.me/${agenda.whatsapp}?text=${encodeURIComponent(mensaje)}` : null;

  return (
    <aside className="agendar" aria-label={titulo}>
      <h3>{titulo}</h3>
      {texto && <p>{texto}</p>}
      {whatsapp || agenda?.enlace ? (
        <div className="agendar-botones">
          {whatsapp && (
            <a className="boton" href={whatsapp} target="_blank" rel="noopener">
              <IconoWhatsapp width={18} height={18} /> Agendar por WhatsApp
            </a>
          )}
          {agenda?.enlace && (
            <a className={whatsapp ? "boton boton-secundario" : "boton"} href={agenda.enlace} target="_blank" rel="noopener">
              <IconoCalendario width={18} height={18} /> Elegir fecha en la agenda
            </a>
          )}
        </div>
      ) : coachAqui ? (
        <p className="agendar-aviso">
          Tus alumnos todavía no ven botones para agendar.{" "}
          {datos?.comunidad.id && (
            <Link href={`/coach/comunidad/${datos.comunidad.id}`}>Pon tu WhatsApp o la liga de tu agenda en tu comunidad</Link>
          )}
          .
        </p>
      ) : (
        <p className="texto-suave">
          Para pedirla, escríbele a {datos?.comunidad.coach ?? "tu coach"} en la{" "}
          <Link href="/comunidad">comunidad</Link>.
        </p>
      )}
    </aside>
  );
}
