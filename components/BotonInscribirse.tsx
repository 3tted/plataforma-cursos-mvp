"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { guardarSesion, leerSesion } from "@/lib/cliente";
import { useApp } from "./Contexto";

// Inscribirse a un curso (gratis). Si la persona todavía no está en su
// comunidad, primero la une. Con `empezar`, además abre la primera lección:
// un solo paso para empezar ("Empezar gratis"). Sin sesión, primero pide
// entrar o crear la cuenta y, en cuanto entra, sigue solo.
const PENDIENTE = "fc.empezarPendiente";

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
  const { usuario, pedirEntrada, enLaComunidad, esCoachDe, unirmeAComunidad, inscribirmeACurso, cambiarCurso, cursos, comunidades, avisar } =
    useApp();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const elegido = cursos.find((c) => c.id === curso);

  // Lo pidió sin sesión: se anota en la sesión del navegador, porque al entrar
  // la página se vuelve a armar; el botón de ese curso lo retoma al aparecer.

  const inscribirme = async () => {
    if (!usuario) {
      guardarSesion(PENDIENTE, { curso, empezar });
      pedirEntrada("alumno");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      // Se une a la comunidad del curso (que puede no ser la que se está viendo, por ejemplo desde el inicio).
      const comunidadId = elegido?.comunidad;
      // Una coach de la empresa del curso ya tiene acceso: solo se abre.
      const suyo = !!comunidadId && esCoachDe(comunidadId);
      const seUne = !suyo && !!comunidadId && !enLaComunidad(comunidadId);
      if (seUne) await unirmeAComunidad(comunidadId);
      if (!suyo) await inscribirmeACurso(curso);
      cambiarCurso(curso);
      // El botón desaparece al inscribirse: el aviso dice qué pasó.
      const titulo = elegido ? `«${elegido.titulo}»` : "el curso";
      const comunidad = comunidades.find((c) => c.id === comunidadId)?.nombre ?? "la comunidad";
      const hecho = suyo ? null : seUne ? `Te uniste a ${comunidad} y te inscribiste a ${titulo}.` : `Te inscribiste a ${titulo}.`;
      const primera = elegido?.lecciones[0];
      if (empezar && primera) {
        if (hecho) avisar(`${hecho} Empieza por la lección 1.`);
        router.push(`/curso/${primera}`);
      } else if (hecho) {
        avisar(hecho);
      }
    } catch (e) {
      setError(e instanceof TypeError ? "No pudimos conectarnos. Inténtalo de nuevo." : (e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  useEffect(() => {
    if (!usuario || leerSesion<{ curso: string }>(PENDIENTE)?.curso !== curso) return;
    // Se borra antes de seguir: si el curso tiene varios botones en la página, solo uno lo hace.
    guardarSesion(PENDIENTE, null);
    void inscribirme();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al entrar
  }, [usuario, curso]);

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
