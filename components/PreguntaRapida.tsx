"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useApp } from "./Contexto";
import { IconoEnviar } from "./Iconos";

// Caja para hacerle una pregunta al asistente desde cualquier página.
export default function PreguntaRapida({
  leccion = null,
  origen = "general",
}: {
  leccion?: string | null;
  /** Distingue los ids cuando hay dos cajas en la misma página (celular y escritorio). */
  origen?: string;
}) {
  const router = useRouter();
  const { setPreguntaPendiente, setLeccionContexto } = useApp();
  const [pregunta, setPregunta] = useState("");

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!pregunta.trim()) return;
    setLeccionContexto(leccion);
    setPreguntaPendiente(pregunta.trim());
    router.push("/asistente");
  };

  return (
    <form className="pregunta-rapida" onSubmit={enviar}>
      <input
        id={leccion ? `pregunta-rapida-${leccion}-${origen}` : `pregunta-rapida-${origen}`}
        value={pregunta}
        onChange={(e) => setPregunta(e.target.value)}
        placeholder="Escribe tu duda…"
        maxLength={1000}
        aria-label="Pregunta para el asistente"
      />
      <button type="submit" className="boton-icono" aria-label="Preguntar" disabled={!pregunta.trim()}>
        <IconoEnviar />
      </button>
    </form>
  );
}
