"use client";

import { useApp } from "./Contexto";

// Pestañas para elegir uno de los cursos de la comunidad. El curso de la
// página lo usa con el curso activo; el panel de la coach, con su propia
// elección para ver la matriz de cada curso.
export default function SelectorCurso({
  activo,
  alElegir,
  conAvance = false,
  etiqueta = "Cursos de la comunidad",
  todos = false,
  aunqueSeaUno = false,
}: {
  activo: string;
  alElegir: (id: string) => void;
  /** Muestra cuántas lecciones lleva la persona en cada curso. */
  conAvance?: boolean;
  etiqueta?: string;
  /** Todos los cursos de la plataforma (panel de la coach), no solo los de esta comunidad. */
  todos?: boolean;
  /** Se muestra aunque haya un solo curso (en el panel, para que se vea cuál es). */
  aunqueSeaUno?: boolean;
}) {
  const { cursos: todosLosCursos, cursosComunidad, completadas, inscritoEn } = useApp();
  const cursos = todos ? todosLosCursos : cursosComunidad;
  if (cursos.length < (aunqueSeaUno ? 1 : 2)) return null;

  return (
    <div className="selector-curso" role="group" aria-label={etiqueta}>
      {cursos.map((c) => {
        const hechas = c.lecciones.filter((id) => completadas.includes(id)).length;
        return (
          <button
            key={c.id}
            type="button"
            className="selector-curso-opcion"
            aria-pressed={c.id === activo}
            onClick={() => alElegir(c.id)}
          >
            <span className="selector-curso-titulo">{c.titulo}</span>
            <span className="selector-curso-meta">
              {conAvance && !inscritoEn(c.id) ? (
                "Sin inscribir"
              ) : conAvance ? (
                <>
                  <span className="cifra">
                    {hechas} de {c.lecciones.length}
                  </span>{" "}
                  lecciones
                </>
              ) : (
                <>
                  <span className="cifra">{c.lecciones.length}</span> lecciones ·{" "}
                  <span className="cifra">{c.minutos}</span> min
                </>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
