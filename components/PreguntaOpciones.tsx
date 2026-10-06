"use client";

import type { ReactNode } from "react";
import type { PreguntaPublica } from "@/lib/tipos";
import { IconoAcierto, IconoError } from "./Iconos";

// Pregunta de opción múltiple del repaso y del examen final. Con `revision`
// marca la respuesta correcta y la equivocada (en el examen no se revisa).
export default function PreguntaOpciones({
  numero,
  pregunta,
  elegida,
  alElegir,
  revision,
  deshabilitada = false,
  children,
}: {
  numero: number;
  pregunta: PreguntaPublica;
  elegida: number | null;
  alElegir: (opcion: number) => void;
  revision?: { acierto: boolean; correcta: number } | null;
  deshabilitada?: boolean;
  children?: ReactNode;
}) {
  return (
    <fieldset className="pregunta-opciones" data-revision={revision ? (revision.acierto ? "bien" : "mal") : undefined}>
      <legend>
        <span className="pregunta-numero cifra">{numero}</span>
        <span>{pregunta.enunciado}</span>
      </legend>
      <div className="opciones">
        {pregunta.opciones.map((opcion, i) => {
          const marca = revision
            ? i === revision.correcta
              ? "correcta"
              : i === elegida
                ? "incorrecta"
                : undefined
            : undefined;
          return (
            <label key={i} className="opcion" data-marca={marca} data-elegida={elegida === i}>
              <input
                type="radio"
                name={`pregunta-${pregunta.id}`}
                checked={elegida === i}
                onChange={() => alElegir(i)}
                disabled={deshabilitada || Boolean(revision)}
              />
              <span className="opcion-texto">{opcion}</span>
              {marca === "correcta" && <IconoAcierto width={18} height={18} className="opcion-icono" />}
              {marca === "incorrecta" && <IconoError width={18} height={18} className="opcion-icono" />}
              {marca && <span className="sr-only">{marca === "correcta" ? " (respuesta correcta)" : " (tu respuesta, incorrecta)"}</span>}
            </label>
          );
        })}
      </div>
      {children}
    </fieldset>
  );
}
