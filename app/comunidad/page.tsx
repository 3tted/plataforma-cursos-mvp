"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Arcos from "@/components/Arcos";
import Avatar from "@/components/Avatar";
import Compositor from "@/components/Compositor";
import { useApp } from "@/components/Contexto";
import { IconoAsistente, IconoFlechaDer, IconoFlechaIzq } from "@/components/Iconos";
import PreguntaRapida from "@/components/PreguntaRapida";
import TarjetaPublicacion from "@/components/TarjetaPublicacion";
import { useTitulo } from "@/components/useTitulo";
import { api, moneda } from "@/lib/cliente";
import { CATEGORIAS, type Categoria, type Publicacion, type ResumenComunidad } from "@/lib/tipos";

function Progreso({ hechas, total }: { hechas: number; total: number }) {
  return (
    <div
      className="progreso"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={hechas}
      aria-label="Lecciones completadas"
    >
      <span style={{ transform: `scaleX(${total ? hechas / total : 0})` }} />
    </div>
  );
}

export default function PaginaComunidad() {
  const { datos, lecciones, completadas, tieneAcceso, usuario, pagoPendiente } = useApp();
  const [publicaciones, setPublicaciones] = useState<Publicacion[] | null>(null);
  const [miembros, setMiembros] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [filtro, setFiltro] = useState<Categoria | "Todas">("Todas");
  useTitulo(datos?.comunidad.nombre ?? "Comunidad");

  const cargar = useCallback(() => {
    setError(false);
    api<Publicacion[]>("/api/publicaciones")
      .then(setPublicaciones)
      .catch(() => setError(true));
    api<ResumenComunidad>("/api/comunidad")
      .then((r) => setMiembros(r.miembros))
      .catch(() => setMiembros(null));
  }, []);

  useEffect(cargar, [cargar]);

  const visibles = useMemo(
    () => publicaciones?.filter((p) => filtro === "Todas" || p.categoria === filtro) ?? [],
    [publicaciones, filtro],
  );

  const reemplazar = (actualizada: Publicacion) =>
    setPublicaciones((lista) => lista?.map((p) => (p.id === actualizada.id ? actualizada : p)) ?? null);

  const agregar = (nueva: Publicacion) =>
    setPublicaciones((lista) => {
      if (nueva.fijada) return [nueva, ...(lista ?? [])];
      const fijadas = lista?.filter((p) => p.fijada) ?? [];
      const resto = lista?.filter((p) => !p.fijada) ?? [];
      return [...fijadas, nueva, ...resto];
    });

  const baseCurso = lecciones.filter((l) => !l.deCoach);
  const hechas = baseCurso.filter((l) => completadas.includes(l.id)).length;
  const siguiente = baseCurso.find((l) => !completadas.includes(l.id));
  const comunidad = datos?.comunidad;
  const precio = moneda(comunidad?.precio_mensual ?? 490);
  // Un alumno que todavía no publica nada empieza presentándose, como pide el anuncio fijado.
  const primeraVez =
    usuario?.rol === "alumno" && !!publicaciones && !publicaciones.some((p) => p.autor === usuario.nombre);

  return (
    <div className="rejilla-comunidad">
      <section aria-labelledby="titulo-comunidad" className="columna-principal">
        <Link href="/" className="volver">
          <IconoFlechaIzq width={16} height={16} /> Todas las comunidades
        </Link>
        <header className="portada">
          <Arcos />
          <h1 id="titulo-comunidad">{comunidad?.nombre ?? "Finanzas Claras"}</h1>
          <p className="portada-texto">{comunidad?.descripcion}</p>
        </header>

        {siguiente && (
          <Link
            href={`/curso/${siguiente.id}`}
            className="continuar-movil"
            aria-label={`${hechas === 0 ? "Empezar" : "Continuar"}: ${siguiente.titulo}, ${hechas} de ${baseCurso.length} lecciones completadas`}
          >
            <span className="continuar-movil-titulo">{siguiente.titulo}</span>
            <span className="continuar-movil-flecha" aria-hidden="true">
              <IconoFlechaDer />
            </span>
            <Progreso hechas={hechas} total={baseCurso.length} />
            <span className="continuar-movil-avance texto-suave" aria-hidden="true">
              <span className="cifra">{hechas}</span> de <span className="cifra">{baseCurso.length}</span> lecciones
            </span>
          </Link>
        )}

        <div className="pregunta-movil">
          <p className="pregunta-movil-titulo">
            <IconoAsistente width={16} height={16} /> Pregúntale al asistente del curso
          </p>
          <PreguntaRapida origen="movil" />
        </div>

        <Compositor alPublicar={agregar} primeraVez={primeraVez} />

        <div className="filtros" role="group" aria-label="Filtrar por categoría">
          {(["Todas", ...CATEGORIAS] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={filtro === c}
              className="filtro"
              onClick={() => setFiltro(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {error && (
          <div className="error chat-aviso" role="alert">
            <span>No pudimos cargar las publicaciones. Revisa tu conexión e inténtalo de nuevo.</span>
            <button type="button" className="boton boton-chico boton-secundario" onClick={cargar}>
              Reintentar
            </button>
          </div>
        )}
        {!publicaciones && !error && <p className="texto-suave">Cargando publicaciones…</p>}
        {publicaciones && visibles.length === 0 && (
          <p className="vacio">
            Todavía no hay publicaciones en {filtro === "Todas" ? "la comunidad" : `«${filtro}»`}. Sé la primera persona en
            escribir.
          </p>
        )}
        <div className="lista-publicaciones">
          {visibles.map((p) => (
            <TarjetaPublicacion key={p.id} publicacion={p} alCambiar={reemplazar} />
          ))}
        </div>
      </section>

      <aside className="columna-lateral" aria-label="Resumen">
        <section className="lateral-bloque lateral-coach" aria-label="La coach">
          <Avatar nombre={comunidad?.coach ?? "Daniela Ortega"} tamaño={44} />
          <div>
            <p className="lateral-nombre">{comunidad?.coach}</p>
            <p className="texto-suave">{comunidad?.coach_titulo}</p>
          </div>
          <dl className="datos-comunidad">
            <div>
              <dt>Miembros activos</dt>
              <dd>{miembros ?? "…"}</dd>
            </div>
            <div>
              <dt>Lecciones</dt>
              <dd>{baseCurso.length || "…"}</dd>
            </div>
          </dl>
        </section>

        <section className="lateral-bloque tarjeta-curso" aria-label="Tu avance">
          <h2 className="lateral-titulo">{datos?.curso.titulo}</h2>
          <Progreso hechas={hechas} total={baseCurso.length} />
          <p className="texto-suave">
            <span className="cifra">
              {hechas} de {baseCurso.length}
            </span>{" "}
            lecciones completadas
          </p>
          {siguiente && (
            <>
              <p className="lateral-siguiente">
                {hechas === 0 ? "Primera lección" : "Sigue"}: <strong>{siguiente.titulo}</strong>
              </p>
              <Link href={`/curso/${siguiente.id}`} className="boton boton-bloque">
                {hechas === 0 ? "Empezar el curso" : "Continuar"}
              </Link>
            </>
          )}
        </section>

        <section className="tarjeta-asistente" aria-label="Asistente del curso">
          <h2>
            <IconoAsistente width={18} height={18} /> Asistente del curso
          </h2>
          <p>Pregunta lo que quieras sobre las lecciones. Te responde al momento y te dice de qué lección sale.</p>
          <PreguntaRapida />
        </section>

        {usuario?.rol === "alumno" && !tieneAcceso && (
          <section className="lateral-bloque tarjeta-membresia" aria-label="Membresía">
            <h2>Membresía</h2>
            <p className="precio">
              {precio} <span>al mes</span>
            </p>
            <p className="texto-suave">Curso completo, comunidad y asistente. Paga con OXXO, SPEI o Mercado Pago.</p>
            <Link href="/membresia" className="boton boton-secundario boton-bloque solo-movil">
              {pagoPendiente ? "Ver mi ficha de pago" : `Unirme por ${precio} al mes`}
            </Link>
            <Link href="/membresia" className="enlace solo-escritorio lateral-enlace">
              {pagoPendiente ? "Ver mi ficha de pago" : "Ver qué incluye y cómo se paga"}
            </Link>
          </section>
        )}
      </aside>
    </div>
  );
}
