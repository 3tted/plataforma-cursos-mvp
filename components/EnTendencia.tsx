"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/cliente";
import type { Tendencias } from "@/lib/tipos";
import Avatar from "./Avatar";
import { useApp } from "./Contexto";
import { IconoFlechaDer } from "./Iconos";
import PortadaTema from "./PortadaTema";
import TarjetaComunidad from "./TarjetaComunidad";

// Lo que está en tendencia en el inicio: un curso destacado (el de más
// alumnos que la persona todavía no toma), una comunidad destacada (la de más
// miembros a la que no pertenece) y, abajo, las demás comunidades.
/** Con pocos alumnos o miembros, el número hace ver vacío lo destacado: no se muestra. */
const MINIMO_PARA_MOSTRAR = 10;

export default function EnTendencia({ titulo = "En tendencia" }: { titulo?: string }) {
  const { cursos, inscritoEn, enLaComunidad, cambiarCurso, cambiarComunidad, comunidades: COMUNIDADES, temaDe } = useApp();
  const [tendencias, setTendencias] = useState<Tendencias | null>(null);

  useEffect(() => {
    api<Tendencias>("/api/tendencias")
      .then(setTendencias)
      .catch(() => setTendencias({ cursos: [], comunidades: [] }));
  }, []);

  const ordenCursos = tendencias?.cursos.length ? tendencias.cursos : cursos.map((c) => ({ id: c.id, alumnos: 0 }));
  const ordenComunidades = tendencias?.comunidades.length
    ? tendencias.comunidades
    : COMUNIDADES.filter((c) => c.estado === "activa").map((c) => ({ id: c.id, miembros: 0 }));

  const comunidadTop = ordenComunidades.find((c) => !enLaComunidad(c.id));
  const comunidad = COMUNIDADES.find((c) => c.id === comunidadTop?.id);
  // Si hay empate, el curso destacado sale de otra comunidad: así las dos tarjetas no repiten.
  const candidatos = ordenCursos.filter((c) => !inscritoEn(c.id));
  const comunidadDe = (id: string) => cursos.find((c) => c.id === id)?.comunidad;
  const cursoTop =
    candidatos.find((c) => c.alumnos === candidatos[0].alumnos && comunidadDe(c.id) !== comunidad?.id) ?? candidatos[0];
  const curso = cursos.find((c) => c.id === cursoTop?.id);
  const deCurso = COMUNIDADES.find((c) => c.id === curso?.comunidad);
  const demas = COMUNIDADES.filter((c) => c.id !== comunidad?.id && !(c.estado === "activa" && enLaComunidad(c.id)));

  if (!tendencias && cursos.length === 0) return null;

  return (
    <section className="tendencia" aria-labelledby="tendencia-titulo">
      <h2 id="tendencia-titulo">{titulo}</h2>

      {(curso || comunidad) && (
        <div className="tendencia-destacados">
          {curso && (
            <article className="destacado">
              <PortadaTema
                tema={temaDe(curso.comunidad)}
                clave={curso.id}
                className="destacado-portada"
                alt={`Portada del curso «${curso.titulo}»`}
              />
              <div className="destacado-cuerpo">
                <span className="pastilla pastilla-marca">Curso en tendencia</span>
                <h3>{curso.titulo}</h3>
                <p className="texto-suave">{curso.subtitulo}</p>
                {deCurso && (
                  <p className="ficha-coach">
                    <Avatar nombre={deCurso.coach} tamaño={24} /> {deCurso.coach} · {deCurso.nombre}
                  </p>
                )}
                <p className="destacado-datos texto-suave">
                  <span className="cifra">{curso.lecciones.length}</span> lecciones ·{" "}
                  <span className="cifra">{curso.minutos}</span> min
                  {cursoTop && cursoTop.alumnos >= MINIMO_PARA_MOSTRAR && (
                    <>
                      {" "}
                      · <span className="cifra">{cursoTop.alumnos}</span> {cursoTop.alumnos === 1 ? "alumno" : "alumnos"}
                    </>
                  )}
                </p>
                <Link href="/curso" className="boton boton-chico" onClick={() => cambiarCurso(curso.id)}>
                  Ver el curso <IconoFlechaDer width={15} height={15} />
                </Link>
              </div>
            </article>
          )}

          {comunidad && (
            <article className="destacado">
              <PortadaTema
                tema={comunidad.tema}
                clave={comunidad.id}
                className="destacado-portada"
                alt={`Portada de la comunidad «${comunidad.nombre}»`}
              />
              <div className="destacado-cuerpo">
                <span className="pastilla pastilla-marca">Comunidad en tendencia</span>
                <h3>{comunidad.nombre}</h3>
                <p className="texto-suave">{comunidad.descripcion}</p>
                <p className="ficha-coach">
                  <Avatar nombre={comunidad.coach} tamaño={24} /> {comunidad.coach}
                </p>
                <p className="destacado-datos texto-suave">
                  {(() => {
                    const suyos = cursos.filter((c) => c.comunidad === comunidad.id).length;
                    return (
                      <>
                        <span className="cifra">{suyos}</span> {suyos === 1 ? "curso" : "cursos"}
                      </>
                    );
                  })()}
                  {comunidadTop && comunidadTop.miembros >= MINIMO_PARA_MOSTRAR && (
                    <>
                      {" "}
                      · <span className="cifra">{comunidadTop.miembros}</span>{" "}
                      {comunidadTop.miembros === 1 ? "miembro" : "miembros"}
                    </>
                  )}
                </p>
                <Link href="/comunidad" className="boton boton-chico" onClick={() => cambiarComunidad(comunidad.id)}>
                  Ver la comunidad <IconoFlechaDer width={15} height={15} />
                </Link>
              </div>
            </article>
          )}
        </div>
      )}

      {demas.length > 0 && (
        <div className="tendencia-demas">
          <div className="inicio-bloque-cabecera">
            <h3>Más comunidades</h3>
            <Link href="/comunidades" className="enlace inicio-ver-todo">
              Ver todas <IconoFlechaDer width={15} height={15} />
            </Link>
          </div>
          <ul className="proximas-lista">
            {demas.slice(0, 3).map((c) => (
              <TarjetaComunidad key={c.id} comunidad={c} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
