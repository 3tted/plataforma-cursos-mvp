"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/cliente";
import { IconoAsistenteGeneral, IconoFlechaDer } from "../Iconos";

interface Resumen {
  id: string;
  titulo: string;
  preguntas: number;
  areas: number;
  problemas: number;
  primerPaso: boolean;
  conCambios: boolean;
}

// En el editor del curso: el diagnóstico con el que empieza (opcional). El
// coach lo crea aquí y lo arma en su propia página (a mano, con IA o con la
// guía); completo, queda como la primera lección del curso.
export default function SeccionDiagnostico({ curso, sinGuardar }: { curso: string; sinGuardar: boolean }) {
  const router = useRouter();
  const [datos, setDatos] = useState<{ diagnostico: Resumen | null; ia: boolean } | null>(null);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ diagnostico: Resumen | null; ia: boolean }>(`/api/coach/diagnosticos?curso=${encodeURIComponent(curso)}`)
      .then(setDatos)
      .catch(() => setDatos({ diagnostico: null, ia: false }));
  }, [curso]);

  const crear = async () => {
    setError(null);
    setCreando(true);
    try {
      const r = await api<{ id: string }>("/api/coach/diagnosticos", { method: "POST", json: { curso } });
      router.push(`/coach/diagnostico/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
      setCreando(false);
    }
  };

  if (!datos) return null;
  const d = datos.diagnostico;
  return (
    <section className="tarjeta editor-seccion seccion-diagnostico" aria-labelledby="diagnostico-editor-titulo">
      <h2 id="diagnostico-editor-titulo">Diagnóstico de inicio</h2>
      {!d ? (
        <>
          <p className="texto-suave">
            Opcional. Un cuestionario corto con el que tu alumno empieza el curso: cada respuesta suma puntos y al final
            ve su resultado y por dónde le conviene empezar. Tú ves el resultado de cada alumno.
          </p>
          <ul className="seccion-diagnostico-formas">
            <li>Lo escribes tú, con una guía paso a paso si la necesitas.</li>
            <li>{datos.ia ? "O la IA te lo arma a partir de lo que quieres medir, y tú lo ajustas." : "Con preguntas de escala del 1 al 5 o de opciones con puntos."}</li>
          </ul>
          {sinGuardar && <p className="nota">Guarda tus cambios del curso antes de crear el diagnóstico.</p>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="boton" onClick={() => void crear()} disabled={creando || sinGuardar}>
            {datos.ia && <IconoAsistenteGeneral width={17} height={17} />} {creando ? "Creando…" : "Crear el diagnóstico"}
          </button>
        </>
      ) : (
        <div className="seccion-diagnostico-resumen">
          <div>
            <p className="seccion-diagnostico-nombre">{d.titulo || "Diagnóstico sin título"}</p>
            <p className="texto-suave">
              {d.preguntas} {d.preguntas === 1 ? "pregunta" : "preguntas"}
              {d.areas > 1 ? ` · ${d.areas} áreas` : " · un solo puntaje"}
              {" · "}
              {d.problemas > 0
                ? "le faltan detalles"
                : d.primerPaso
                  ? "es la primera lección del curso"
                  : "completo, sin usarse en el curso"}
              {d.conCambios ? " · tienes cambios sin terminar" : ""}
            </p>
          </div>
          <Link href={`/coach/diagnostico/${d.id}`} className="boton boton-secundario">
            Editar el diagnóstico <IconoFlechaDer width={15} height={15} />
          </Link>
        </div>
      )}
    </section>
  );
}
