"use client";

import Link from "next/link";
import BotonInscribirse from "./BotonInscribirse";
import { useApp } from "./Contexto";
import { IconoFlechaDer } from "./Iconos";
import PortadaTema from "./PortadaTema";
import { notaGratis } from "@/lib/cliente";

// Los cursos de la comunidad que se está viendo, cada uno con su avance y su
// botón (inscribirse, empezar o continuar). En la columna de al lado del feed
// van en lista; en celular, en una fila que se desliza de lado arriba del feed.
export default function CursosComunidad({ fila = false }: { fila?: boolean }) {
  const { cursosComunidad, cursoId, cambiarCurso, completadas, inscritoEn, inscripcionLista, temaDe, coachAqui } = useApp();
  // Avance de alumno: para quien no es coach de esta comunidad (incluye visitantes, que no llevan avance).
  const esAlumno = !coachAqui;
  if (cursosComunidad.length === 0) return null;

  return (
    <section className={fila ? "cursos-comunidad cursos-comunidad-fila" : "cursos-comunidad"} aria-label="Cursos de la comunidad">
      <h2 className="cursos-comunidad-titulo">
        Cursos <span className="cifra texto-suave">{cursosComunidad.length}</span>
      </h2>
      <ul data-pocos={cursosComunidad.length <= 3}>
        {cursosComunidad.map((c) => {
          const inscrito = inscripcionLista && inscritoEn(c.id);
          const hechas = c.lecciones.filter((id) => completadas.includes(id)).length;
          const siguiente = c.lecciones.find((id) => !completadas.includes(id));
          const total = c.lecciones.length;
          return (
            <li key={c.id} className="curso-comunidad" aria-current={c.id === cursoId ? "true" : undefined}>
              {/* Solo quien está inscrito entra al temario; los demás empiezan con el botón. */}
              {inscrito ? (
                <Link href="/curso" className="curso-comunidad-portada" onClick={() => cambiarCurso(c.id)} tabIndex={-1} aria-hidden="true">
                  <PortadaTema tema={temaDe(c.comunidad)} clave={c.id} alt={`Portada del curso «${c.titulo}»`} titulo={c.titulo} />
                </Link>
              ) : (
                <span className="curso-comunidad-portada" aria-hidden="true">
                  <PortadaTema tema={temaDe(c.comunidad)} clave={c.id} alt="" />
                </span>
              )}
              <div className="curso-comunidad-cuerpo">
                {inscrito ? (
                  <Link href="/curso" className="curso-comunidad-nombre" onClick={() => cambiarCurso(c.id)}>
                    {c.titulo}
                  </Link>
                ) : (
                  <span className="curso-comunidad-nombre">{c.titulo}</span>
                )}
                {!c.publicado && <span className="pastilla pastilla-pendiente curso-comunidad-estado">Sin publicar</span>}
                <p className="curso-comunidad-meta texto-suave">
                  <span className="cifra">{total}</span> {total === 1 ? "lección" : "lecciones"} · <span className="cifra">{c.minutos}</span>{" "}
                  min
                </p>

                {esAlumno && inscrito && (
                  <>
                    <div
                      className="progreso"
                      role="progressbar"
                      aria-label={`Avance en ${c.titulo}`}
                      aria-valuemin={0}
                      aria-valuemax={total}
                      aria-valuenow={hechas}
                    >
                      <span style={{ transform: `scaleX(${total ? hechas / total : 0})` }} />
                    </div>
                    <p className="curso-comunidad-meta texto-suave">
                      <span className="cifra">
                        {hechas} de {total}
                      </span>{" "}
                      completadas
                    </p>
                  </>
                )}

                {!esAlumno ? (
                  <Link href="/curso" className="enlace curso-comunidad-accion" onClick={() => cambiarCurso(c.id)}>
                    Ver el curso <IconoFlechaDer width={15} height={15} />
                  </Link>
                ) : !inscripcionLista ? null : !inscrito ? (
                  <>
                    <BotonInscribirse curso={c.id} className="boton boton-chico curso-comunidad-boton" empezar />
                    <p className="curso-comunidad-gratis">{notaGratis(c.gratis)}</p>
                  </>
                ) : siguiente ? (
                  <Link href={`/curso/${siguiente}`} className="boton boton-chico curso-comunidad-boton" onClick={() => cambiarCurso(c.id)}>
                    {hechas === 0 ? "Empezar" : "Continuar"}
                  </Link>
                ) : (
                  <Link href="/curso" className="enlace curso-comunidad-accion" onClick={() => cambiarCurso(c.id)}>
                    Terminado · repasar <IconoFlechaDer width={15} height={15} />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
