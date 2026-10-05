"use client";

import Link from "next/link";
import Arcos from "@/components/Arcos";
import Avatar from "@/components/Avatar";
import { useApp } from "@/components/Contexto";
import { IconoFlechaDer } from "@/components/Iconos";
import { useTitulo } from "@/components/useTitulo";
import { COMUNIDADES } from "@/lib/comunidades";

// Catálogo: la alumna elige qué curso tomar.
export default function PaginaCursos() {
  const { datos, lecciones, completadas } = useApp();
  useTitulo("Cursos");

  const activa = COMUNIDADES.find((c) => c.estado === "activa")!;
  const proximas = COMUNIDADES.filter((c) => c.estado === "proximamente");
  const base = lecciones.filter((l) => !l.deCoach);
  const hechas = base.filter((l) => completadas.includes(l.id)).length;
  const minutos = base.reduce((s, l) => s + l.duracion_min, 0);
  const modulos = datos?.curso.modulos.filter((m) => m.id !== "MC").length ?? 0;

  return (
    <div className="directorio">
      <header className="cabecera-pagina">
        <h1>Cursos</h1>
        <p className="texto-suave">Elige el curso que quieres tomar. El primer módulo de cada curso es gratis.</p>
      </header>

      <Link href="/curso" className="ficha-comunidad ficha-activa">
        <span className="ficha-portada">
          <Arcos />
          <span className="ficha-sello" aria-hidden="true">
            FC
          </span>
        </span>
        <span className="ficha-cuerpo">
          <span className="pastilla pastilla-marca">De {activa.nombre}</span>
          <span className="ficha-nombre">{datos?.curso.titulo ?? activa.curso}</span>
          <span className="ficha-coach">
            <Avatar nombre={activa.coach} tamaño={28} /> con {activa.coach}
          </span>
          <span className="ficha-descripcion">{datos?.curso.subtitulo}</span>
          <span className="dir-datos">
            <span>
              <strong className="cifra">{modulos || "…"}</strong> módulos
            </span>
            <span>
              <strong className="cifra">{base.length || "…"}</strong> lecciones
            </span>
            <span>
              <strong className="cifra">{minutos || "…"}</strong> min
            </span>
          </span>
          {base.length > 0 && (
            <span className="ficha-avance">
              <span className="progreso" aria-hidden="true">
                <span style={{ transform: `scaleX(${hechas / base.length})` }} />
              </span>
              <span className="texto-suave">
                <span className="cifra">{hechas}</span> de <span className="cifra">{base.length}</span> lecciones completadas
              </span>
            </span>
          )}
          <span className="boton ficha-boton">
            {hechas === 0 ? "Ver el curso" : "Continuar el curso"} <IconoFlechaDer width={16} height={16} />
          </span>
        </span>
      </Link>

      <section aria-labelledby="proximos-titulo" className="proximas">
        <h2 id="proximos-titulo">Próximamente</h2>
        <ul className="proximas-lista">
          {proximas.map((c) => (
            <li key={c.id} className="ficha-comunidad ficha-proxima">
              <span className="ficha-cuerpo">
                <span className="pastilla">De {c.nombre}</span>
                <span className="ficha-nombre">{c.curso}</span>
                <span className="ficha-coach">
                  <Avatar nombre={c.coach} tamaño={28} /> con {c.coach}
                </span>
                <span className="nota">Curso de ejemplo: todavía no abre.</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
