"use client";

import { useEffect, useState } from "react";

// La coach decide si la presentación con IA de una lección lleva voz. Se
// genera con voz; al terminar ("recién") se le pide que la revise y elija.
export default function EleccionVoz({
  leccion,
  conVoz,
  recien = false,
  alCambiar,
}: {
  leccion: string;
  conVoz: boolean;
  /** Acaba de generarse: se le pide a la coach que la revise y decida. */
  recien?: boolean;
  alCambiar: () => void | Promise<void>;
}) {
  // Se refleja al momento; si el servidor falla, regresa a lo que había.
  const [valor, setValor] = useState(conVoz);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setValor(conVoz), [conVoz]);

  const elegir = async (nuevo: boolean) => {
    if (nuevo === valor) return;
    setValor(nuevo);
    setError(null);
    const res = await fetch(`/api/presentaciones/${leccion}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conVoz: nuevo }),
    }).catch(() => null);
    if (!res?.ok) {
      setValor(!nuevo);
      return setError("No se pudo guardar. Inténtalo de nuevo.");
    }
    await alCambiar();
  };

  return (
    <div className="eleccion-voz" data-recien={recien}>
      {recien && (
        <p className="eleccion-voz-recien">
          <strong>La presentación está lista.</strong> Mírala y decide si se queda con voz o sin voz.
        </p>
      )}
      <div className="eleccion-voz-fila">
        <span className="eleccion-voz-etiqueta">Voz</span>
        <div className="eleccion-voz-opciones" role="group" aria-label="Voz de la presentación">
          <button type="button" aria-pressed={valor} onClick={() => void elegir(true)}>
            Con voz
          </button>
          <button type="button" aria-pressed={!valor} onClick={() => void elegir(false)}>
            Sin voz
          </button>
        </div>
      </div>
      <p className="nota">
        {valor
          ? "Tus alumnos la escuchan con la voz de su celular o computadora."
          : "Tus alumnos la ven sin voz: avanza sola al ritmo de lectura, con subtítulos."}
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
