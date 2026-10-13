"use client";

import Link from "next/link";
import { useState } from "react";
import { moneda } from "@/lib/cliente";
import type { Publicacion } from "@/lib/tipos";
import Avatar from "./Avatar";
import { useApp } from "./Contexto";
import { IconoBillete, IconoCheck, IconoComunidad, IconoEditar, IconoPlay, IconoPublicacion } from "./Iconos";
import { posterDeVideo } from "@/lib/poster";
import PortadaTema from "./PortadaTema";

type Vista = { tipo: "foto" } | { tipo: "video" } | { tipo: "publicaciones" } | { tipo: "curso"; id: string };

// Presentación de la comunidad, arriba de sus publicaciones (como la página
// "Acerca de" de Skool): una galería con el video de bienvenida, lo que se
// publica y sus cursos; los datos de la comunidad y qué obtienes. Quien no es
// miembro la ve abierta y con el botón para unirse.
export default function PresentacionComunidad({
  miembros,
  publicaciones,
  esDuena,
}: {
  miembros: number | null;
  publicaciones: Publicacion[] | null;
  esDuena: boolean;
}) {
  const { datos, cursosComunidad, comunidadId, enComunidad, unirmeAComunidad, temaDe, usuario } = useApp();
  const comunidad = datos?.comunidad;
  const tema = temaDe(comunidadId);

  // El video de bienvenida: el de la primera lección gratis que tenga video.
  const video = datos?.curso.modulos.flatMap((m) => m.lecciones).find((l) => l.gratis && l.video)?.video ?? null;
  const recientes = (publicaciones ?? []).slice(0, 3);
  // La foto de portada que subió la coach abre la galería.
  const foto = datos?.comunidad.foto;
  const vistas: Vista[] = [
    ...(foto ? [{ tipo: "foto" } as const] : []),
    ...(video ? [{ tipo: "video" } as const] : []),
    ...(recientes.length ? [{ tipo: "publicaciones" } as const] : []),
    ...cursosComunidad.map((c) => ({ tipo: "curso", id: c.id }) as const),
  ];
  const [elegida, setElegida] = useState(0);
  const vista = vistas[Math.min(elegida, vistas.length - 1)];

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unirme = async () => {
    setEnviando(true);
    setError(null);
    try {
      await unirmeAComunidad();
    } catch (e) {
      setError(e instanceof TypeError ? "No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo." : (e as Error).message);
      setEnviando(false);
    }
  };

  if (!comunidad) return null;
  const precio = moneda(comunidad.precio_mensual);
  const totalLecciones = cursosComunidad.reduce((s, c) => s + c.lecciones.length, 0);

  const obtienes = [
    cursosComunidad.length > 0 &&
      `${cursosComunidad.length} ${cursosComunidad.length === 1 ? "curso" : "cursos"} en video (${totalLecciones} lecciones): ${cursosComunidad.map((c) => c.titulo).join(", ")}`,
    "Repaso al final de cada lección y examen para terminar cada curso",
    "Asistente de IA que te responde con las lecciones y te dice de cuál sale la respuesta",
    `La comunidad: dudas, logros y anuncios de ${comunidad.coach.split(" ")[0]}`,
  ].filter((x): x is string => Boolean(x));

  const sobre = (
    <div className="presentacion-sobre">
      {(comunidad.acerca || comunidad.descripcion)
        .split(/\n+/)
        .map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      <p className="presentacion-subtitulo">Qué obtienes</p>
      <ul className="presentacion-obtienes">
        {obtienes.map((o) => (
          <li key={o}>
            <IconoCheck width={18} height={18} />
            <span>{o}</span>
          </li>
        ))}
        <li>
          <IconoBillete width={18} height={18} />
          <span>
            Unirte a la comunidad es gratis. Cada curso tiene su módulo 1 gratis; el resto se desbloquea con la membresía
            de {precio} al mes.
          </span>
        </li>
      </ul>
    </div>
  );

  return (
    <section className="presentacion tarjeta" aria-labelledby="titulo-comunidad">
      <div className="presentacion-cabecera">
        <h1 id="titulo-comunidad">{comunidad.nombre}</h1>
        {esDuena && (
          <div className="presentacion-duena">
            <Link
              href={`/coach/comunidad/${encodeURIComponent(comunidadId)}`}
              className="boton boton-chico boton-fantasma-borde"
            >
              <IconoEditar width={15} height={15} /> Editar
            </Link>
            <Link href={`/coach/comunidades?comunidad=${encodeURIComponent(comunidadId)}`} className="boton boton-chico">
              + Agregar un curso
            </Link>
          </div>
        )}
      </div>
      <p className="presentacion-descripcion texto-suave">{comunidad.descripcion}</p>

      {vista && (
        <div className="presentacion-galeria">
          <div className="presentacion-visor">
            {vista.tipo === "foto" && foto && (
              <PortadaTema tema={tema} clave={comunidadId} foto={foto} alt={`Portada de «${comunidad.nombre}»`} className="presentacion-foto" />
            )}
            {vista.tipo === "video" && video && (
              <video
                key={video.url}
                src={video.url}
                poster={posterDeVideo("Video de bienvenida", comunidad.nombre)}
                controls
                preload="metadata"
                playsInline
                aria-label="Video de bienvenida"
              />
            )}
            {vista.tipo === "publicaciones" && (
              <div className="presentacion-publicaciones" data-tema={tema}>
                {recientes.map((p) => (
                  <article key={p.id} className="presentacion-post">
                    <p className="presentacion-post-autor">
                      <Avatar nombre={p.autor} tamaño={24} coach={p.rol === "coach"} />
                      <strong>{p.autor}</strong>
                      <span className="texto-suave">· {p.categoria}</span>
                    </p>
                    <p className="presentacion-post-titulo">{p.titulo}</p>
                    <p className="presentacion-post-cuerpo texto-suave">{p.cuerpo}</p>
                  </article>
                ))}
              </div>
            )}
            {vista.tipo === "curso" &&
              (() => {
                const c = cursosComunidad.find((x) => x.id === vista.id);
                if (!c) return null;
                return (
                  <div className="presentacion-curso">
                    <PortadaTema tema={tema} clave={c.id} alt={`Portada del curso «${c.titulo}»`} />
                    <div className="presentacion-curso-texto">
                      <p className="presentacion-curso-etiqueta">Curso</p>
                      <p className="presentacion-curso-titulo">{c.titulo}</p>
                      <p>{c.subtitulo}</p>
                      <p className="texto-suave">
                        <span className="cifra">{c.lecciones.length}</span> lecciones · <span className="cifra">{c.minutos}</span> min
                      </p>
                    </div>
                  </div>
                );
              })()}
          </div>

          {vistas.length > 1 && (
            <div className="presentacion-miniaturas" role="group" aria-label="Galería de la comunidad">
              {vistas.map((v, i) => {
                const curso = v.tipo === "curso" ? cursosComunidad.find((x) => x.id === v.id) : null;
                const nombre =
                  v.tipo === "foto" ? "Portada" : v.tipo === "video" ? "Video de bienvenida" : v.tipo === "publicaciones" ? "Publicaciones recientes" : (curso?.titulo ?? "Curso");
                return (
                  <button
                    key={i}
                    type="button"
                    className="presentacion-miniatura"
                    aria-pressed={vista === v}
                    aria-label={nombre}
                    title={nombre}
                    onClick={() => setElegida(i)}
                  >
                    <PortadaTema
                      tema={tema}
                      clave={v.tipo === "curso" ? v.id : `${comunidadId}-${v.tipo}`}
                      foto={v.tipo === "foto" ? foto : undefined}
                    />
                    <span className="presentacion-miniatura-icono" aria-hidden="true">
                      {v.tipo === "video" ? (
                        <IconoPlay width={20} height={20} />
                      ) : v.tipo === "publicaciones" ? (
                        <IconoPublicacion width={20} height={20} />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ul className="presentacion-datos">
        <li>
          <IconoBillete width={20} height={20} /> Membresía {precio}/mes
        </li>
        <li>
          <IconoComunidad width={20} height={20} /> <span className="cifra">{miembros ?? "…"}</span>{" "}
          {miembros === 1 ? "miembro" : "miembros"}
        </li>
        <li>
          <Avatar nombre={comunidad.coach} tamaño={24} coach /> Por {comunidad.coach}
        </li>
      </ul>

      {enComunidad ? (
        <details className="presentacion-mas">
          <summary>Acerca de la comunidad</summary>
          {sobre}
        </details>
      ) : (
        <>
          {sobre}
          <div className="presentacion-unirse">
            <button type="button" className="boton" onClick={unirme} disabled={enviando || !usuario}>
              {enviando ? "Uniéndote…" : "Unirme gratis a la comunidad"}
            </button>
            <p className="nota">Al unirte puedes inscribirte a sus cursos y tomar gratis el módulo 1 de cada uno.</p>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
