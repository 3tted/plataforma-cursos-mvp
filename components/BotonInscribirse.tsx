"use client";

import { useState } from "react";
import { useApp } from "./Contexto";

// Paso 2 de la inscripción: inscribirse a un curso de la comunidad (gratis).
// Si la persona todavía no está en la comunidad, primero la une.
export default function BotonInscribirse({
  curso,
  className = "boton",
  texto = "Inscribirme",
}: {
  curso: string;
  className?: string;
  texto?: string;
}) {
  const { enComunidad, unirmeAComunidad, inscribirmeACurso, cambiarCurso, cursos, comunidades, avisar } = useApp();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inscribirme = async () => {
    setEnviando(true);
    setError(null);
    try {
      const seUne = !enComunidad;
      if (seUne) await unirmeAComunidad();
      await inscribirmeACurso(curso);
      cambiarCurso(curso);
      // El botón desaparece al inscribirse: el aviso dice qué pasó.
      const elegido = cursos.find((c) => c.id === curso);
      const titulo = elegido ? `«${elegido.titulo}»` : "el curso";
      const comunidad = comunidades.find((c) => c.id === elegido?.comunidad)?.nombre ?? "la comunidad";
      avisar(seUne ? `Te uniste a ${comunidad} y te inscribiste a ${titulo}.` : `Te inscribiste a ${titulo}.`);
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
