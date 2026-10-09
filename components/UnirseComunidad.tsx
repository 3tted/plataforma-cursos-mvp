"use client";

import Link from "next/link";
import { useState } from "react";
import { moneda } from "@/lib/cliente";
import Arcos from "./Arcos";
import Avatar from "./Avatar";
import { useApp } from "./Contexto";
import { IconoAsistente, IconoComunidad, IconoCurso, IconoFlechaIzq } from "./Iconos";

// Paso 1 de la inscripción: el alumno ve qué hay en la comunidad y se une
// (gratis). Después elige a qué cursos inscribirse.
export default function UnirseComunidad({ motivo }: { motivo?: string }) {
  const { datos, cursosComunidad: cursos, unirmeAComunidad } = useApp();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const comunidad = datos?.comunidad;

  const unirme = async () => {
    setEnviando(true);
    setError(null);
    try {
      await unirmeAComunidad();
    } catch (e) {
      setError(e instanceof TypeError ? "No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo." : (e as Error).message);
      setEnviando(false);
    }
  };

  return (
    <div className="unirse">
      <Link href="/comunidades" className="volver">
        <IconoFlechaIzq width={16} height={16} /> Todas las comunidades
      </Link>
      <header className="portada">
        <Arcos />
        <h1>{comunidad?.nombre ?? "Finanzas Claras"}</h1>
        <p className="portada-texto">{comunidad?.descripcion}</p>
      </header>

      <section className="tarjeta unirse-tarjeta" aria-labelledby="unirse-titulo">
        {motivo && <p className="unirse-motivo">{motivo}</p>}
        <h2 id="unirse-titulo">Únete a la comunidad</h2>
        {comunidad && (
          <p className="unirse-coach">
            <Avatar nombre={comunidad.coach} tamaño={36} coach />
            <span>
              <strong>{comunidad.coach}</strong>
              <span className="texto-suave">{comunidad.coach_titulo}</span>
            </span>
          </p>
        )}

        <ul className="unirse-incluye">
          <li>
            <IconoCurso width={20} height={20} />
            <span>
              <strong>
                {cursos.length} {cursos.length === 1 ? "curso" : "cursos"}
              </strong>
              {cursos.length > 0 && <span className="texto-suave">{cursos.map((c) => c.titulo).join(" · ")}</span>}
            </span>
          </li>
          <li>
            <IconoComunidad width={20} height={20} />
            <span>
              <strong>La comunidad</strong>
              <span className="texto-suave">Pregunta, comparte tus avances y aprende con otros alumnos y tu coach.</span>
            </span>
          </li>
          <li>
            <IconoAsistente width={20} height={20} />
            <span>
              <strong>Asistente del curso</strong>
              <span className="texto-suave">Te responde con las lecciones y te dice de cuál sale la respuesta.</span>
            </span>
          </li>
        </ul>

        <button type="button" className="boton" onClick={unirme} disabled={enviando}>
          {enviando ? "Uniéndote…" : "Unirme a la comunidad"}
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="nota">
          Unirte es gratis. Después eliges a qué cursos inscribirte: el módulo 1 de cada uno es gratis y el resto es con la
          membresía de {moneda(comunidad?.precio_mensual ?? 490)} al mes.
        </p>
      </section>
    </div>
  );
}
