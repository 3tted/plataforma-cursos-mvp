"use client";

import type { PracticaLeccion } from "@/lib/tipos";

// Práctica de la lección en el editor de la coach: se activa solo en las
// lecciones que la necesitan. Activa, el alumno ve un recuadro para escribir
// sus notas o respuestas y, si se permite, subir un archivo.
export default function EditorPractica({
  practica,
  alCambiar,
}: {
  practica: PracticaLeccion | undefined;
  alCambiar: (practica: PracticaLeccion | undefined) => void;
}) {
  const activa = !!practica;
  return (
    <div className="editor-practica" data-activa={activa}>
      <label className="editor-gratis">
        <input
          type="checkbox"
          checked={activa}
          onChange={(e) =>
            alCambiar(e.target.checked ? { instrucciones: "", archivo: false, obligatoria: false } : undefined)
          }
        />
        <span>
          <strong>Pedir una práctica en esta lección</strong>
          <span className="texto-suave"> · el alumno entrega notas o respuestas por escrito</span>
        </span>
      </label>
      {practica && (
        <>
          <label className="campo">
            <span>¿Qué debe entregar el alumno?</span>
            <textarea
              rows={3}
              value={practica.instrucciones}
              maxLength={2000}
              placeholder="Por ejemplo: responde por escrito las cinco preguntas con ejemplos de tu negocio."
              onChange={(e) => alCambiar({ ...practica, instrucciones: e.target.value })}
            />
          </label>
          <label className="editor-gratis">
            <input
              type="checkbox"
              checked={practica.archivo}
              onChange={(e) => alCambiar({ ...practica, archivo: e.target.checked })}
            />
            Que también pueda subir un archivo (PDF, Word, Excel, PowerPoint o foto, hasta 4 MB)
          </label>
          <label className="editor-gratis">
            <input
              type="checkbox"
              checked={practica.obligatoria}
              onChange={(e) => alCambiar({ ...practica, obligatoria: e.target.checked })}
            />
            Obligatoria: sin entregarla no se completa la lección
          </label>
        </>
      )}
    </div>
  );
}
