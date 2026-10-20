"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, hace } from "@/lib/cliente";
import type { Publicacion } from "@/lib/tipos";
import Avatar from "./Avatar";
import { useApp } from "./Contexto";
import { IconoComentario, IconoFlechaDer } from "./Iconos";

// Lo último que se publicó en la comunidad, para el inicio de alumno y coach.
export default function PublicacionesRecientes({ titulo, cuantas = 3 }: { titulo: string; cuantas?: number }) {
  const { comunidadId } = useApp();
  const [publicaciones, setPublicaciones] = useState<Publicacion[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api<Publicacion[]>(`/api/publicaciones?comunidad=${encodeURIComponent(comunidadId)}`)
      .then((p) => setPublicaciones([...p].sort((x, y) => y.creadaEn.localeCompare(x.creadaEn)).slice(0, cuantas)))
      .catch(() => setError(true));
  }, [cuantas, comunidadId]);

  return (
    <section className="tarjeta inicio-bloque" aria-labelledby="recientes-titulo">
      <div className="inicio-bloque-cabecera">
        <h2 id="recientes-titulo">{titulo}</h2>
        <Link href={`/c/${comunidadId}`} className="enlace inicio-ver-todo">
          Ir a la comunidad <IconoFlechaDer width={15} height={15} />
        </Link>
      </div>
      {error && <p className="vacio">No pudimos cargar las publicaciones. Recarga la página para intentarlo de nuevo.</p>}
      {!error && !publicaciones && <p className="texto-suave">Cargando…</p>}
      {publicaciones?.length === 0 && <p className="vacio">Todavía no hay publicaciones en la comunidad.</p>}
      <ul className="inicio-lista">
        {publicaciones?.map((p) => (
          <li key={p.id}>
            <Link href={`/c/${comunidadId}`} className="inicio-publicacion">
              <Avatar nombre={p.autor} tamaño={34} coach={p.rol === "coach"} />
              <span className="inicio-publicacion-texto">
                <span className="inicio-publicacion-titulo">{p.titulo}</span>
                <span className="texto-suave inicio-meta">
                  {p.autor} · {p.categoria} · {hace(p.creadaEn)}
                </span>
              </span>
              <span className="inicio-publicacion-comentarios texto-suave" aria-label={`${p.comentarios.length} comentarios`}>
                <IconoComentario width={15} height={15} /> <span className="cifra">{p.comentarios.length}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
