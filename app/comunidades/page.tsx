"use client";

import { useMemo, useState } from "react";
import { IconoBuscar } from "@/components/Iconos";
import TarjetaComunidad from "@/components/TarjetaComunidad";
import { useTitulo } from "@/components/useTitulo";
import { COMUNIDADES } from "@/lib/comunidades";

// Directorio: todas las comunidades, agrupadas por tema. Las reales (Finanzas
// Claras, con dos cursos, y Vende por WhatsApp, con uno) se abren; las demás
// son de ejemplo para ver cómo crece el directorio.
export default function PaginaComunidades() {
  const [tema, setTema] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  useTitulo("Comunidades");

  // Los temas en el orden en que aparecen; dentro de cada uno, primero las reales.
  const temas = useMemo(() => [...new Set(COMUNIDADES.map((c) => c.tema))], []);
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase("es");
    return COMUNIDADES.filter(
      (c) =>
        (tema === "Todos" || c.tema === tema) &&
        (!q || `${c.nombre} ${c.curso} ${c.coach} ${c.tema}`.toLocaleLowerCase("es").includes(q)),
    );
  }, [tema, busqueda]);
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
        <p className="texto-suave">
          Cada comunidad tiene su coach, sus cursos y su asistente. Por ahora puedes entrar a Finanzas Claras y a Vende por
          WhatsApp; las demás son de ejemplo.
        </p>
      </header>

      <div className="proximas-cabecera">
        <div className="filtros" role="group" aria-label="Filtrar por tema">
          {["Todos", ...temas].map((t) => (
            <button key={t} type="button" className="filtro" aria-pressed={tema === t} onClick={() => setTema(t)}>
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

      {/* Un tema por columna: con pocas comunidades por tema, la página no se llena de huecos. */}
      <div className="directorio-grupos">
        {grupos.map((g) => (
          <section key={g.tema} className="directorio-grupo" aria-labelledby={`tema-${g.tema}`}>
            <h2 id={`tema-${g.tema}`}>{g.tema}</h2>
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
