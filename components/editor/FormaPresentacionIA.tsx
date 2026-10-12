"use client";

import { useState, type FormEvent } from "react";
import type { OpcionesPresentacion } from "@/lib/tipos";
import { IconoAsistenteGeneral } from "../Iconos";

const DURACIONES = [
  { valor: "", texto: "Automática" },
  { valor: "1", texto: "~1 min" },
  { valor: "3", texto: "~3 min" },
  { valor: "5", texto: "~5 min" },
  { valor: "otra", texto: "Otra" },
];

const TONOS: { valor: NonNullable<OpcionesPresentacion["tono"]>; texto: string }[] = [
  { valor: "cercano", texto: "Cercano" },
  { valor: "formal", texto: "Formal" },
  { valor: "motivador", texto: "Motivador" },
];

// Lo que la coach le pide a la IA antes de generar la presentación de una
// lección: duración, número de diapositivas, tono e indicaciones. Se llena con
// lo que pidió la vez anterior.
export default function FormaPresentacionIA({
  inicial,
  generando,
  alGenerar,
  alCancelar,
}: {
  inicial?: OpcionesPresentacion;
  generando: boolean;
  alGenerar: (opciones: OpcionesPresentacion) => void;
  alCancelar: () => void;
}) {
  const fija = inicial?.minutos && ["1", "3", "5"].includes(String(inicial.minutos));
  const [duracion, setDuracion] = useState(inicial?.minutos ? (fija ? String(inicial.minutos) : "otra") : "");
  const [minutos, setMinutos] = useState(inicial?.minutos && !fija ? String(inicial.minutos) : "2");
  const [diapositivas, setDiapositivas] = useState(inicial?.diapositivas ? String(inicial.diapositivas) : "");
  const [tono, setTono] = useState<NonNullable<OpcionesPresentacion["tono"]>>(inicial?.tono ?? "cercano");
  const [indicaciones, setIndicaciones] = useState(inicial?.indicaciones ?? "");

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const m = duracion === "otra" ? Math.round(Number(minutos)) : Number(duracion);
    alGenerar({
      ...(m >= 1 ? { minutos: Math.min(15, m) } : {}),
      ...(diapositivas ? { diapositivas: Number(diapositivas) } : {}),
      tono,
      ...(indicaciones.trim() ? { indicaciones: indicaciones.trim() } : {}),
    });
  };

  return (
    <form className="forma-presentacion" onSubmit={enviar}>
      <p className="forma-presentacion-titulo">
        <IconoAsistenteGeneral width={18} height={18} /> ¿Cómo quieres la presentación?
      </p>

      <fieldset className="forma-presentacion-grupo">
        <legend>Duración</legend>
        <div className="forma-presentacion-chips">
          {DURACIONES.map((d) => (
            <button key={d.valor} type="button" aria-pressed={duracion === d.valor} onClick={() => setDuracion(d.valor)}>
              {d.texto}
            </button>
          ))}
          {duracion === "otra" && (
            <label className="forma-presentacion-minutos">
              <input
                type="number"
                min={1}
                max={15}
                value={minutos}
                onChange={(e) => setMinutos(e.target.value)}
                aria-label="Minutos"
              />
              min
            </label>
          )}
        </div>
      </fieldset>

      <div className="forma-fila">
        <label className="campo">
          <span>Diapositivas</span>
          <select value={diapositivas} onChange={(e) => setDiapositivas(e.target.value)}>
            <option value="">Automático</option>
            {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="forma-presentacion-grupo">
          <legend>Tono</legend>
          <div className="forma-presentacion-chips">
            {TONOS.map((t) => (
              <button key={t.valor} type="button" aria-pressed={tono === t.valor} onClick={() => setTono(t.valor)}>
                {t.texto}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <label className="campo">
        <span>Indicaciones para la IA (opcional)</span>
        <textarea
          rows={3}
          maxLength={500}
          value={indicaciones}
          onChange={(e) => setIndicaciones(e.target.value)}
          placeholder="Por ejemplo: enfócate en el ejemplo de Ana, explícalo para quien apenas empieza y termina con una tarea para hoy."
        />
      </label>

      <p className="nota">
        La IA usa solo lo que dice la lección: si pides más tiempo, explica con más calma, pero no inventa datos. Después
        puedes editar cada diapositiva.
      </p>

      <div className="forma-acciones">
        <button type="submit" className="boton boton-chico" disabled={generando}>
          <IconoAsistenteGeneral width={16} height={16} /> {generando ? "Generando…" : "Generar presentación"}
        </button>
        <button type="button" className="boton boton-chico boton-fantasma" onClick={alCancelar} disabled={generando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
