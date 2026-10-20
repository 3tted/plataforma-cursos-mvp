"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "./Contexto";

// Inscribirse a un curso (gratis). Si la persona todavía no está en su
// comunidad, primero la une. Con `empezar`, además abre la primera lección:
// un solo paso para empezar ("Empezar gratis").
export default function BotonInscribirse({
  curso,
  className = "boton",
  texto,
  empezar = false,
}: {
  curso: string;
  className?: string;
  texto?: string;
  empezar?: boolean;
}) {
  const router = useRouter();
  const { enLaComunidad, unirmeAComunidad, inscribirmeACurso, cambiarCurso, cursos, comunidades, avisar } = useApp();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const elegido = cursos.find((c) => c.id === curso);

  const inscribirme = async () => {
    setEnviando(true);
    setError(null);
    try {
      // Se une a la comunidad del curso (que puede no ser la que se está viendo, por ejemplo desde el inicio).
      const comunidadId = elegido?.comunidad;
      const seUne = !!comunidadId && !enLaComunidad(comunidadId);
      if (seUne) await unirmeAComunidad(comunidadId);
      await inscribirmeACurso(curso);
      cambiarCurso(curso);
      // El botón desaparece al inscribirse: el aviso dice qué pasó.
      const titulo = elegido ? `«${elegido.titulo}»` : "el curso";
      const comunidad = comunidades.find((c) => c.id === comunidadId)?.nombre ?? "la comunidad";
      const hecho = seUne ? `Te uniste a ${comunidad} y te inscribiste a ${titulo}.` : `Te inscribiste a ${titulo}.`;
      const primera = elegido?.lecciones[0];
      if (empezar && primera) {
        avisar(`${hecho} Empieza por la lección 1.`);
        router.push(`/curso/${primera}`);
      } else {
        avisar(hecho);
      }
    } catch (e) {
      setError(e instanceof TypeError ? "No pudimos conectarnos. Inténtalo de nuevo." : (e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button type="button" className={className} onClick={inscribirme} disabled={enviando}>
        {enviando ? (empezar ? "Abriendo tu curso…" : "Inscribiéndote…") : (texto ?? (empezar ? "Empezar gratis" : "Inscribirme"))}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
