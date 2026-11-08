"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/cliente";
import { totalPreguntas } from "@/lib/diagnosticos";
import { useDiagnostico } from "./useDiagnostico";
import { IconoFlechaDer } from "./Iconos";

// Invitación a la página pública del diagnóstico de la empresa (/radar/<empresa>)
// en su comunidad y en su página. Solo aparece si la empresa tiene un curso
// publicado con un diagnóstico (y, en una comunidad, si es de esa comunidad).
export default function InvitacionRadar({ empresa, comunidad }: { empresa: string; comunidad?: string }) {
  const [radar, setRadar] = useState<{ diagnostico: string; comunidad: { id: string } } | null>(null);

  useEffect(() => {
    let vigente = true;
    setRadar(null);
    api<{ diagnostico: string; comunidad: { id: string } }>(`/api/radar/${encodeURIComponent(empresa)}`)
      .then((r) => vigente && setRadar(r))
      .catch(() => {
        // Sin diagnóstico público: no se muestra nada.
      });
    return () => {
      vigente = false;
    };
  }, [empresa]);

  const d = useDiagnostico(radar?.diagnostico);
  if (!radar || !d || (comunidad && radar.comunidad.id !== comunidad)) return null;
  const preguntas = totalPreguntas(d);
  const minutos = Math.max(2, Math.round(preguntas / 3));
  const delCoach = d.bandasEn === "porcentaje";

  return (
    <aside className="invitacion-radar" aria-label={d.titulo}>
      <div>
        <p className="invitacion-radar-titulo">Antes de empezar, haz tu {d.titulo}</p>
        <p className="texto-suave">
          {delCoach
            ? `${preguntas} preguntas, unos ${minutos} minutos y sin crear cuenta: descubre dónde estás y por dónde empezar.`
            : `${preguntas} afirmaciones, 5 minutos y sin crear cuenta: descubre en qué dimensión de tu liderazgo está tu principal brecha.`}
        </p>
      </div>
      <Link href={`/radar/${encodeURIComponent(empresa)}`} className="boton boton-secundario">
        {delCoach ? "Hacer el diagnóstico" : "Hacer mi Radar"} <IconoFlechaDer width={16} height={16} />
      </Link>
    </aside>
  );
}
