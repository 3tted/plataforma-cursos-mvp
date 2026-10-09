"use client";

import { useState } from "react";
import { api } from "@/lib/cliente";
import type { ResultadoRepaso } from "@/lib/tipos";
import AsistenteEnLinea from "./AsistenteEnLinea";
import { useApp } from "./Contexto";
import { IconoAsistente, IconoReintentar, IconoRepaso } from "./Iconos";
import PreguntaOpciones from "./PreguntaOpciones";
import { useEvaluaciones } from "./useEvaluaciones";

// Repaso al final de la lección: preguntas que no cuentan para la calificación.
// Muestra la respuesta correcta con su explicación y, si el alumno falla, el
// asistente del curso le explica ahí mismo, debajo de la pregunta. La página lo monta con
// key={leccion.id} para que empiece de cero en cada lección. `alRevisar` avisa
// cuando el alumno ya lo contestó (cuenta para completar la lección).
export default function RepasoLeccion({
  leccion,
  alRevisar,
}: {
  leccion: { id: string; titulo: string };
  alRevisar?: () => void;
}) {
  const evaluaciones = useEvaluaciones();
  const { usuario } = useApp();
  const [respuestas, setRespuestas] = useState<(number | null)[]>([]);
  const [resultado, setResultado] = useState<ResultadoRepaso | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Preguntas del repaso con el asistente abierto debajo.
  const [consultas, setConsultas] = useState<string[]>([]);

  const preguntas = evaluaciones?.repaso[leccion.id];
  if (!preguntas?.length || !usuario) return null;

  const completas = preguntas.every((_, i) => respuestas[i] != null);

  const revisar = async () => {
    setEnviando(true);
    setError(null);
    try {
      setResultado(
        await api<ResultadoRepaso>("/api/repaso", {
          method: "POST",
          json: { autor: usuario.nombre, rol: usuario.rol, leccion: leccion.id, respuestas },
        }),
      );
      alRevisar?.();
    } catch (e) {
      setError(e instanceof TypeError ? "No pudimos revisar tus respuestas. Revisa tu conexión." : (e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const reiniciar = () => {
    setRespuestas([]);
    setResultado(null);
    setConsultas([]);
  };

  const abrir = (id: string) => setConsultas((c) => (c.includes(id) ? c : [...c, id]));
  const cerrar = (id: string) => setConsultas((c) => c.filter((x) => x !== id));

  return (
    <section className="tarjeta repaso" aria-labelledby="repaso-titulo">
      <div className="repaso-cabecera">
        <h2 id="repaso-titulo">
          <IconoRepaso width={20} height={20} /> Repaso rápido
        </h2>
        <p className="texto-suave">
          {preguntas.length} preguntas para comprobar que te quedó claro. No cuentan para tu calificación.
        </p>
      </div>

      <ol className="repaso-preguntas">
        {preguntas.map((p, i) => {
          const revision = resultado?.detalle[i];
          return (
            <li key={p.id}>
              <PreguntaOpciones
                numero={i + 1}
                pregunta={p}
                elegida={respuestas[i] ?? null}
                alElegir={(opcion) => setRespuestas((r) => Object.assign([...r], { [i]: opcion }))}
                revision={revision ? { acierto: revision.acierto, correcta: revision.correcta } : null}
                deshabilitada={enviando}
              >
                {revision && (
                  <div className="repaso-explicacion" data-acierto={revision.acierto}>
                    <p>
                      <strong>{revision.acierto ? "Correcto." : `La respuesta es «${p.opciones[revision.correcta]}».`}</strong>{" "}
                      {revision.explicacion} <span className="cita-id">{leccion.id}</span>
                    </p>
                    {!revision.acierto &&
                      (consultas.includes(p.id) ? (
                        <AsistenteEnLinea
                          pregunta={`En el repaso fallé esta pregunta: «${p.enunciado}». ¿Me explicas por qué la respuesta es «${p.opciones[revision.correcta]}»?`}
                          resumen={`¿Por qué la respuesta es «${p.opciones[revision.correcta]}»?`}
                          leccion={leccion.id}
                          alCerrar={() => cerrar(p.id)}
                        />
                      ) : (
                        <button type="button" className="accion" onClick={() => abrir(p.id)}>
                          <IconoAsistente width={15} height={15} /> Pregúntale al asistente
                        </button>
                      ))}
                  </div>
                )}
              </PreguntaOpciones>
            </li>
          );
        })}
      </ol>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="repaso-pie" role="status">
        {resultado ? (
          <>
            <p className="repaso-total">
              <span className="cifra">
                {resultado.aciertos} de {resultado.total}
              </span>{" "}
              correctas
              {resultado.aciertos === resultado.total ? ": lo tienes claro." : "."}
            </p>
            <button type="button" className="boton boton-secundario boton-chico" onClick={reiniciar}>
              <IconoReintentar width={15} height={15} /> Intentar de nuevo
            </button>
          </>
        ) : (
          <button type="button" className="boton boton-secundario" onClick={revisar} disabled={!completas || enviando}>
            {enviando ? "Revisando…" : "Revisar mis respuestas"}
          </button>
        )}
      </div>
    </section>
  );
}
