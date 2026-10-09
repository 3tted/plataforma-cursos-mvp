"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Avatar from "@/components/Avatar";
import { useApp } from "@/components/Contexto";
import { IconoBuscar, IconoFlechaDer } from "@/components/Iconos";
import PortadaTema from "@/components/PortadaTema";
import TarjetaComunidad from "@/components/TarjetaComunidad";
import { useTitulo } from "@/components/useTitulo";
import { api } from "@/lib/cliente";
import { COMUNIDADES } from "@/lib/comunidades";
import type { ResumenComunidad } from "@/lib/tipos";

// Directorio: la alumna elige a qué comunidad entrar. Cada comunidad trae su
// curso, así que aquí también se ve el avance del curso.
export default function PaginaComunidades() {
  const { datos, lecciones, completadas } = useApp();
  const [miembros, setMiembros] = useState<number | null>(null);
  const [tema, setTema] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  useTitulo("Comunidades");

  useEffect(() => {
    api<ResumenComunidad>("/api/comunidad")
      .then((r) => setMiembros(r.miembros))
      .catch(() => setMiembros(null));
  }, []);

  const activa = COMUNIDADES.find((c) => c.estado === "activa")!;
  const proximas = COMUNIDADES.filter((c) => c.estado === "proximamente");
  const temas = ["Todos", ...new Set(proximas.map((c) => c.tema))];

  const base = lecciones.filter((l) => !l.deCoach);
  const hechas = base.filter((l) => completadas.includes(l.id)).length;
  const minutos = base.reduce((s, l) => s + l.duracion_min, 0);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase("es");
    return proximas.filter(
      (c) =>
        (tema === "Todos" || c.tema === tema) &&
        (!q || `${c.nombre} ${c.curso} ${c.coach} ${c.tema}`.toLocaleLowerCase("es").includes(q)),
    );
  }, [proximas, tema, busqueda]);

  return (
    <div className="directorio">
      <header className="cabecera-pagina">
        <h1>Comunidades</h1>
        <p className="texto-suave">Elige la comunidad a la que quieres entrar. Cada una tiene su coach, su curso y su asistente.</p>
      </header>

      <Link href="/comunidad" className="ficha-comunidad ficha-activa">
        <PortadaTema tema={activa.tema} clave={activa.id} className="ficha-portada" encajar />
        <span className="ficha-cuerpo">
          <span className="pastilla pastilla-marca">Abierta</span>
          <span className="ficha-nombre">{activa.nombre}</span>
          <span className="ficha-coach">
            <Avatar nombre={activa.coach} tamaño={28} /> con {activa.coach}
          </span>
          <span className="ficha-descripcion">{activa.descripcion}</span>
          <span className="ficha-curso">
            Curso: <strong>{datos?.curso.titulo ?? activa.curso}</strong>
          </span>
          <span className="dir-datos">
            <span>
              <strong className="cifra">{miembros ?? "…"}</strong> miembros activos
            </span>
            <span>
              <strong className="cifra">{base.length || "…"}</strong> lecciones
            </span>
            <span>
              <strong className="cifra">{minutos || "…"}</strong> min
            </span>
          </span>
          {hechas > 0 && (
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
            Entrar a la comunidad <IconoFlechaDer width={16} height={16} />
          </span>
        </span>
      </Link>

      <section aria-labelledby="proximas-titulo" className="proximas">
        <div className="proximas-cabecera">
          <div>
            <h2 id="proximas-titulo">Próximamente</h2>
            <p className="texto-suave">Comunidades de ejemplo: así se verá el directorio cuando haya más coaches.</p>
          </div>
          <label className="buscador-comunidades">
            <IconoBuscar width={18} height={18} aria-hidden="true" />
            <span className="sr-only">Buscar una comunidad</span>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por tema, curso o coach"
              autoComplete="off"
            />
          </label>
        </div>

        <div className="filtros" role="group" aria-label="Filtrar por tema">
          {temas.map((t) => (
            <button key={t} type="button" className="filtro" aria-pressed={tema === t} onClick={() => setTema(t)}>
              {t}
            </button>
          ))}
        </div>

        <p className="resultado-busqueda texto-suave" role="status">
          {visibles.length === 0
            ? "No encontramos comunidades con esa búsqueda."
            : `${visibles.length} ${visibles.length === 1 ? "comunidad" : "comunidades"}`}
        </p>

        <ul className="proximas-lista">
          {visibles.map((c) => (
            <TarjetaComunidad key={c.id} comunidad={c} />
          ))}
        </ul>
      </section>
    </div>
  );
}
