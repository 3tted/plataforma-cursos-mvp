"use client";

import { useMemo, useState } from "react";
import { IconoBuscar } from "@/components/Iconos";
import TarjetaComunidad from "@/components/TarjetaComunidad";
import { useTitulo } from "@/components/useTitulo";
import { useApp } from "@/components/Contexto";

// Directorio: todas las comunidades, agrupadas por tema. Las reales (Finanzas
// Claras, con dos cursos, y Vende por WhatsApp, con uno) se abren; las demás
// son de ejemplo para ver cómo crece el directorio.
export default function PaginaComunidades() {
  const { comunidades: COMUNIDADES } = useApp();
  const [tema, setTema] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  useTitulo("Comunidades");

  // Los temas en el orden en que aparecen; dentro de cada uno, primero las reales.
  const temas = useMemo(() => [...new Set(COMUNIDADES.map((c) => c.tema))], [COMUNIDADES]);
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase("es");
    return COMUNIDADES.filter(
      (c) =>
        (tema === "Todos" || c.tema === tema) &&
        (!q || `${c.nombre} ${c.curso} ${c.coach} ${c.tema}`.toLocaleLowerCase("es").includes(q)),
    );
  }, [tema, busqueda, COMUNIDADES]);
  const grupos = temas
    .map((t) => ({
      tema: t,
      comunidades: visibles
        .filter((c) => c.tema === t)
        .sort((a, b) => Number(b.estado === "activa") - Number(a.estado === "activa")),
    }))
    .filter((g) => g.comunidades.length > 0);

  return (
    <div className="directorio">
      <header className="cabecera-pagina">
        <h1>Comunidades</h1>
        <p className="texto-suave">Cada comunidad tiene su coach, sus cursos y su asistente.</p>
      </header>

      <div className="proximas-cabecera">
        <div className="filtros" role="group" aria-label="Filtrar por tema">
          {["Todos", ...temas].map((t) => (
            <button key={t} type="button" className="filtro" aria-pressed={tema === t} onClick={(e) => {
                setTema(t);
                e.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
              }}>
              {t}
            </button>
          ))}
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

      <p className="resultado-busqueda texto-suave" role="status">
        {visibles.length === 0
          ? "No encontramos comunidades con esa búsqueda."
          : `${visibles.length} ${visibles.length === 1 ? "comunidad" : "comunidades"}`}
      </p>

      {/* Cada tema ocupa tantas columnas como comunidades tiene (hasta 3) y las pone lado a lado:
          así un tema con dos comunidades no empuja a los demás ni deja huecos. Con un tema
          elegido, ocupa todo el ancho. */}
      <div className="directorio-grupos">
        {grupos.map((g) => (
          <section
            key={g.tema}
            className="directorio-grupo"
            data-cartas={tema === "Todos" ? Math.min(g.comunidades.length, 3) : 3}
            {...(tema === "Todos" ? { "aria-labelledby": `tema-${g.tema}` } : { "aria-label": g.tema })}
          >
            {/* Con un tema elegido, el filtro ya lo dice y cada tarjeta lleva su etiqueta: sin título repetido. */}
            {tema === "Todos" && <h2 id={`tema-${g.tema}`}>{g.tema}</h2>}
            <ul className="directorio-grupo-lista">
              {g.comunidades.map((c) => (
                <TarjetaComunidad key={c.id} comunidad={c} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
