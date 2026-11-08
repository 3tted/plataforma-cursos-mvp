"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/Contexto";
import { DiagnosticoPublico } from "@/components/DiagnosticoRadar";
import { useTitulo } from "@/components/useTitulo";
import { api } from "@/lib/cliente";
import { totalPreguntas } from "@/lib/diagnosticos";
import { useDiagnostico } from "@/components/useDiagnostico";
import type { AgendaComunidad, MarcaEmpresa } from "@/lib/tipos";

interface DatosRadar {
  empresa: { id: string; nombre: string };
  marca?: MarcaEmpresa;
  comunidad: { id: string; nombre: string; coach: string; agenda?: AgendaComunidad };
  diagnostico: string;
}

// La página pública del diagnóstico de una empresa (/radar/<empresa>), para
// compartir en redes o por WhatsApp: se responde sin cuenta, se ve el
// resultado completo y, para guardarlo y agendar, se dejan nombre y contacto.
export default function PaginaRadar() {
  const { empresa: id } = useParams<{ empresa: string }>();
  const { fijarMarcaPagina } = useApp();
  const [radar, setRadar] = useState<DatosRadar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const d = useDiagnostico(radar?.diagnostico);
  useTitulo(d?.titulo ?? "Diagnóstico");

  useEffect(() => {
    let vigente = true;
    api<DatosRadar>(`/api/radar/${encodeURIComponent(id)}`)
      .then((r) => {
        if (!vigente) return;
        setRadar(r);
        fijarMarcaPagina(r.marca ?? null);
      })
      .catch((e) => vigente && setError((e as Error).message));
    return () => {
      vigente = false;
      fijarMarcaPagina(null);
    };
  }, [id, fijarMarcaPagina]);

  if (error) {
    return (
      <div className="pagina-estrecha">
        <h1>No encontramos este diagnóstico</h1>
        <p className="texto-suave">Revisa la dirección que te compartieron.</p>
        <Link href="/" className="boton boton-secundario">
          Ir al inicio
        </Link>
      </div>
    );
  }
  if (!radar || !d) return <p className="texto-suave">Cargando…</p>;

  const preguntas = totalPreguntas(d);
  const delCoach = d.bandasEn === "porcentaje";
  return (
    <div className="pagina-radar">
      <header className="pagina-radar-cabecera">
        <p className="pagina-radar-antetitulo">
          {radar.empresa.nombre} · {radar.comunidad.coach}
        </p>
        <h1>{d.titulo}</h1>
        <p className="pagina-radar-bajada">
          {delCoach
            ? "Responde con honestidad y al terminar ves tu resultado y por dónde te conviene empezar."
            : "Descubre en qué dimensión de tu liderazgo está tu principal brecha: claridad, mentalidad, comunicación o visión. Al terminar ves tu gráfica y por dónde empezar."}
        </p>
        <ul className="pagina-radar-datos">
          <li>
            <span className="cifra">{preguntas}</span> {delCoach ? "preguntas" : "afirmaciones"}
          </li>
          <li>
            <span className="cifra">{delCoach ? Math.max(2, Math.round(preguntas / 3)) : 5}</span> minutos
          </li>
          <li>Sin crear cuenta</li>
        </ul>
      </header>
      <DiagnosticoPublico
        id={d.id}
        publico={{
          empresa: radar.empresa.id,
          coach: radar.comunidad.coach,
          comunidad: radar.comunidad.id,
          agenda: radar.comunidad.agenda,
        }}
      />
    </div>
  );
}
