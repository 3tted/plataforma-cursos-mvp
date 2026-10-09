"use client";

import type { PreguntaCurso } from "@/lib/tipos";
import { IconoBorrar } from "../Iconos";

// Editor de preguntas de opción múltiple: el repaso de una lección o el
// examen final. Cada pregunta tiene de 2 a 6 opciones y una correcta.
export default function EditorPreguntas({
  preguntas,
  alCambiar,
  lecciones,
  vacio,
  maximo = 30,
}: {
  preguntas: PreguntaCurso[];
  alCambiar: (preguntas: PreguntaCurso[]) => void;
  /** En el examen: de qué lección sale cada pregunta (para decirle al alumno qué repasar). */
  lecciones?: { id: string; titulo: string }[];
  vacio: string;
  maximo?: number;
}) {
  const cambiar = (i: number, cambio: Partial<PreguntaCurso>) =>
    alCambiar(preguntas.map((p, j) => (j === i ? { ...p, ...cambio } : p)));

  const agregar = () =>
    alCambiar([
      ...preguntas,
      { id: `nueva-${Math.random().toString(36).slice(2, 8)}`, enunciado: "", opciones: ["", ""], correcta: 0 },
    ]);

  return (
    <div className="editor-preguntas">
      {preguntas.length === 0 && <p className="texto-suave">{vacio}</p>}
      <ol>
        {preguntas.map((p, i) => (
          <li key={p.id} className="editor-pregunta">
            <div className="editor-pregunta-cabecera">
              <span className="editor-numero cifra">{i + 1}</span>
              <label className="campo">
                <span className="sr-only">Pregunta {i + 1}</span>
                <input
                  value={p.enunciado}
                  onChange={(e) => cambiar(i, { enunciado: e.target.value })}
                  maxLength={400}
                  placeholder="Escribe la pregunta"
                />
              </label>
              <button
                type="button"
                className="boton-icono boton-icono-chico"
                onClick={() => alCambiar(preguntas.filter((_, j) => j !== i))}
                aria-label={`Quitar la pregunta ${i + 1}`}
              >
                <IconoBorrar width={16} height={16} />
              </button>
            </div>

            <fieldset className="editor-opciones">
              <legend className="sr-only">Opciones de la pregunta {i + 1}; marca la correcta</legend>
              {p.opciones.map((o, k) => (
                <div key={k} className="editor-opcion" data-correcta={p.correcta === k}>
                  <input
                    type="radio"
                    name={`correcta-${p.id}`}
                    checked={p.correcta === k}
                    onChange={() => cambiar(i, { correcta: k })}
                    aria-label={`La opción ${k + 1} es la correcta`}
                  />
                  <input
                    className="editor-opcion-texto"
                    value={o}
                    onChange={(e) => cambiar(i, { opciones: p.opciones.map((x, m) => (m === k ? e.target.value : x)) })}
                    maxLength={200}
                    placeholder={`Opción ${k + 1}`}
                    aria-label={`Opción ${k + 1}`}
                  />
                  {p.opciones.length > 2 && (
                    <button
                      type="button"
                      className="boton-icono boton-icono-chico"
                      onClick={() =>
                        cambiar(i, {
                          opciones: p.opciones.filter((_, m) => m !== k),
                          correcta: p.correcta === k ? 0 : p.correcta > k ? p.correcta - 1 : p.correcta,
                        })
                      }
                      aria-label={`Quitar la opción ${k + 1}`}
                    >
                      <IconoBorrar width={14} height={14} />
                    </button>
                  )}
                </div>
              ))}
              {p.opciones.length < 6 && (
                <button type="button" className="enlace editor-agregar-opcion" onClick={() => cambiar(i, { opciones: [...p.opciones, ""] })}>
                  + Agregar opción
                </button>
              )}
              <p className="nota">Marca el círculo de la respuesta correcta.</p>
            </fieldset>

            <div className="forma-fila">
              <label className="campo">
                <span>Explicación (se muestra al revisar)</span>
                <input
                  value={p.explicacion ?? ""}
                  onChange={(e) => cambiar(i, { explicacion: e.target.value })}
                  maxLength={600}
                  placeholder="Por qué esa es la correcta"
                />
              </label>
              {lecciones && (
                <label className="campo">
                  <span>Sale de la lección</span>
                  <select value={p.leccion ?? ""} onChange={(e) => cambiar(i, { leccion: e.target.value || undefined })}>
                    <option value="">Sin lección</option>
                    {lecciones.map((l, k) => (
                      <option key={l.id} value={l.id}>
                        {k + 1}. {l.titulo || "Lección sin título"}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </li>
        ))}
      </ol>
      {preguntas.length < maximo && (
        <button type="button" className="boton boton-chico boton-fantasma" onClick={agregar}>
          + Agregar pregunta
        </button>
      )}
    </div>
  );
}
