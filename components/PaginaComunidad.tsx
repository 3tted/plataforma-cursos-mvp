"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Arcos from "@/components/Arcos";
import Avatar from "@/components/Avatar";
import Compositor from "@/components/Compositor";
import { useApp } from "@/components/Contexto";
import { IconoAsistente, IconoEditar, IconoFlechaIzq } from "@/components/Iconos";
import PreguntaRapida from "@/components/PreguntaRapida";
import CursosComunidad from "@/components/CursosComunidad";
import TarjetaPublicacion from "@/components/TarjetaPublicacion";
import PresentacionComunidad from "@/components/PresentacionComunidad";
import { useTitulo } from "@/components/useTitulo";
import { api, moneda } from "@/lib/cliente";
import { COMUNIDADES } from "@/lib/comunidades";
import { CATEGORIAS, type Categoria, type ComunidadCreada, type Publicacion, type ResumenComunidad } from "@/lib/tipos";

// La página de una comunidad (/c/<id>): su presentación, sus cursos, el
// asistente y, para quien está unido, sus publicaciones. Se ve sin cuenta; la
// cuenta se pide al querer empezar. La dirección manda: abre esa comunidad.
export default function PaginaComunidad({ id }: { id: string }) {
  const {
    datos,
    tieneAcceso,
    usuario,
    pagoPendiente,
    inscripcionLista,
    enComunidad,
    comunidadId,
    cursosComunidad,
    cursos,
    cambiarComunidad,
    coachAqui,
  } = useApp();
  // Si la comunidad todavía no tiene cursos en la página, solo sus coaches la
  // ven (vacía, con el botón para agregarle uno); para los demás no existe.
  const [sinCursos, setSinCursos] = useState<ComunidadCreada | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const esCoach = usuario?.rol === "coach";
  useEffect(() => {
    setNoExiste(false);
    if (cursos.length === 0) return;
    if (cursos.some((c) => c.comunidad === id)) {
      setSinCursos(null);
      if (id !== comunidadId) cambiarComunidad(id);
      return;
    }
    if (!esCoach) return setNoExiste(true);
    let vigente = true;
    api<{ comunidades: ComunidadCreada[] }>("/api/coach/comunidades")
      .then((d) => {
        if (!vigente) return;
        const suya = d.comunidades.find((c) => c.id === id) ?? null;
        setSinCursos(suya);
        if (!suya) setNoExiste(true);
      })
      .catch(() => vigente && setNoExiste(true));
    return () => {
      vigente = false;
    };
  }, [id, cursos, esCoach, comunidadId, cambiarComunidad]);
  const [publicaciones, setPublicaciones] = useState<Publicacion[] | null>(null);
  const [miembros, setMiembros] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [filtro, setFiltro] = useState<Categoria | "Todas">("Todas");
  useTitulo(datos?.comunidad.nombre ?? "Comunidad");

  // Cada carga lleva su número: si se cambia de comunidad antes de que llegue
  // la respuesta anterior, esa respuesta ya no se muestra.
  const carga = useRef(0);
  const cargar = useCallback(() => {
    const esta = ++carga.current;
    const vigente = () => esta === carga.current;
    setError(false);
    const consulta = `?comunidad=${encodeURIComponent(comunidadId)}`;
    api<Publicacion[]>(`/api/publicaciones${consulta}`)
      .then((p) => vigente() && setPublicaciones(p))
      .catch(() => vigente() && setError(true));
    api<ResumenComunidad>(`/api/comunidad${consulta}`)
      .then((r) => vigente() && setMiembros(r.miembros))
      .catch(() => vigente() && setMiembros(null));
    // Al unirse se vuelve a contar: la persona ya es miembro.
  }, [comunidadId, enComunidad]);

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

  const comunidad = datos?.comunidad;
  // Las coaches de la empresa de una comunidad creada en la plataforma le agregan cursos desde aquí.
  const esDuena = coachAqui && !COMUNIDADES.some((c) => c.id === comunidadId);
  const precio = moneda(comunidad?.precio_mensual ?? 490);
  // Un alumno que todavía no publica nada empieza presentándose, como pide el anuncio fijado.
  const primeraVez =
    usuario?.rol === "alumno" && !!publicaciones && !publicaciones.some((p) => p.autor === usuario.nombre);

  if (sinCursos) {
    return (
      <div className="comunidad-vacia">
        <Link href="/coach/comunidades" className="volver">
          <IconoFlechaIzq width={16} height={16} /> Comunidades y cursos
        </Link>
        <header className="portada">
          <Arcos />
          <h1>{sinCursos.nombre}</h1>
          <p className="portada-texto">{sinCursos.descripcion}</p>
          <div className="portada-accion presentacion-duena">
            <Link href={`/coach/comunidades?comunidad=${encodeURIComponent(sinCursos.id)}`} className="boton">
              + Agregar un curso
            </Link>
            <Link href={`/coach/comunidad/${encodeURIComponent(sinCursos.id)}`} className="boton boton-fantasma-borde">
              <IconoEditar width={16} height={16} /> Editar
            </Link>
          </div>
        </header>
        <div className="aviso">
          <p>
            <strong>Tu comunidad todavía no tiene cursos publicados.</strong> Por ahora solo tú la ves; aparece en el
            directorio para los alumnos en cuanto publiques el primero.
          </p>
        </div>
      </div>
    );
  }

  if (noExiste) {
    return (
      <div className="pagina-estrecha">
        <h1>No encontramos esa comunidad</h1>
        <p className="texto-suave">Revisa el enlace que te compartieron o búscala en el directorio.</p>
        <Link href="/comunidades" className="boton boton-secundario">
          Ver todas las comunidades
        </Link>
      </div>
    );
  }

  // Mientras llega la comunidad de la dirección no se muestra la anterior.
  if (!inscripcionLista || datos?.comunidad.id !== id) return <p className="texto-suave">Cargando la comunidad…</p>;

  return (
    <div className="rejilla-comunidad">
      <section aria-labelledby="titulo-comunidad" className="columna-principal">
        <Link href="/comunidades" className="volver">
          <IconoFlechaIzq width={16} height={16} /> Todas las comunidades
        </Link>
        <PresentacionComunidad miembros={miembros} publicaciones={publicaciones} esDuena={esDuena} />

        {/* En celular los cursos van aquí, en una fila que se desliza de lado. */}
        <CursosComunidad fila />

        {enComunidad ? (
          <>
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
                  onClick={(e) => {
                    setFiltro(c);
                    e.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
                  }}
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
                <TarjetaPublicacion
                  key={p.id}
                  publicacion={p}
                  alCambiar={reemplazar}
                  alBorrar={(id) => setPublicaciones((lista) => lista?.filter((x) => x.id !== id) ?? null)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="aviso aviso-privada">
            <p>
              <strong>Las publicaciones son solo para miembros.</strong> Únete gratis para leer lo que comparte la
              comunidad, hacer preguntas y presentarte.
            </p>
          </div>
        )}
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
              <dt>Cursos</dt>
              <dd>{cursosComunidad.length || "…"}</dd>
            </div>
          </dl>
        </section>

        <div className="lateral-bloque lateral-cursos">
          <CursosComunidad />
        </div>

        <section className="tarjeta-asistente" aria-label="Asistente del curso">
          <h2>
            <IconoAsistente width={18} height={18} /> Asistente del curso
          </h2>
          <p>
            Pregunta lo que quieras sobre las lecciones. Te responde al momento y te dice de qué lección sale.
            {cursosComunidad.length > 1 && datos && <> Ahora responde con «{datos.curso.titulo}».</>}
          </p>
          <PreguntaRapida />
        </section>

        {usuario?.rol === "alumno" && !tieneAcceso && (
          <section className="lateral-bloque tarjeta-membresia" aria-label="Membresía">
            <h2>Membresía</h2>
            <p className="precio">
              {precio} <span>al mes</span>
            </p>
            <p className="texto-suave">
              {cursosComunidad.length > 1 ? `Los ${cursosComunidad.length} cursos de la comunidad` : "El curso completo"}, la comunidad y el
              asistente. Paga con OXXO, SPEI o Mercado Pago.
            </p>
            <Link href="/membresia" className="boton boton-secundario boton-bloque solo-movil">
              {pagoPendiente ? "Ver mi ficha de pago" : `Activar membresía por ${precio} al mes`}
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
