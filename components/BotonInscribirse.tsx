"use client";

import { useState } from "react";
import { useApp } from "./Contexto";

// Paso 2 de la inscripción: inscribirse a un curso de la comunidad (gratis).
// Si la persona todavía no está en la comunidad, primero la une.
export default function BotonInscribirse({
  curso,
  className = "boton",
  texto = "Inscribirme al curso",
}: {
  curso: string;
  className?: string;
  texto?: string;
}) {
  const { enComunidad, unirmeAComunidad, inscribirmeACurso, cambiarCurso } = useApp();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inscribirme = async () => {
    setEnviando(true);
    setError(null);
    try {
      if (!enComunidad) await unirmeAComunidad();
      await inscribirmeACurso(curso);
      cambiarCurso(curso);
    } catch (e) {
      setError(e instanceof TypeError ? "No pudimos conectarnos. Inténtalo de nuevo." : (e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button type="button" className={className} onClick={inscribirme} disabled={enviando}>
        {enviando ? "Inscribiéndote…" : texto}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
