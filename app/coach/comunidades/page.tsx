"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useApp } from "@/components/Contexto";
import CamposComunidad, { COMUNIDAD_VACIA } from "@/components/editor/CamposComunidad";
import CrearConIA from "@/components/editor/CrearConIA";
import { COMUNIDADES } from "@/lib/comunidades";
import NavCoach from "@/components/NavCoach";
import { IconoAsistenteGeneral, IconoEditar, IconoFlechaDer } from "@/components/Iconos";
import PortadaTema from "@/components/PortadaTema";
import { useTitulo } from "@/components/useTitulo";
import { api, hace, moneda } from "@/lib/cliente";
import type { ComunidadCreada, CursoCreado } from "@/lib/tipos";

type ResumenCursoCoach = Pick<CursoCreado, "id" | "comunidad" | "titulo" | "estado" | "origen" | "actualizadoEn" | "enPagina"> & {
  lecciones: number;
};
type Datos = { comunidades: ComunidadCreada[]; cursos: ResumenCursoCoach[]; ia: boolean };

/** Clave de la sección de cursos que todavía no están en una comunidad. */
const SUELTOS = "";

// Las comunidades y los cursos de la coach. Son cosas aparte: puede crear
// primero la comunidad y luego sus cursos, o primero un curso y después
// ponerlo en una comunidad (para publicarlo tiene que estar en una).
export default function PaginaMisComunidades() {
  const router = useRouter();
  const { usuario, comunidades, cursos, cambiarComunidad, cambiarCurso } = useApp();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [verSueltos, setVerSueltos] = useState(false);
  const [forma, setForma] = useState(COMUNIDAD_VACIA);
  const [enviando, setEnviando] = useState<string | null>(null);
  // Dónde está abierto el formulario de IA (una comunidad o SUELTOS).
  const [conIA, setConIA] = useState<string | null>(null);
  useTitulo("Comunidades y cursos");
  // Las que vienen con la plataforma (de la empresa Merkatics): se manejan aquí, pero su contenido no se edita.
  const deLaPlataforma = usuario?.empresa === "merkatics" ? COMUNIDADES.map((c) => c.id) : [];

  const autor = usuario?.nombre ?? "";

  const cargar = useCallback(() => {
    if (!autor) return;
    api<Datos>("/api/coach/comunidades")
      .then((d) => {
        setDatos(d);
        const pedido = new URLSearchParams(window.location.search).get("crear") === "comunidad";
        if (pedido || (d.comunidades.length === 0 && d.cursos.length === 0 && deLaPlataforma.length === 0)) setCreando(true);
      })
      .catch((e) => setError((e as Error).message));
  }, [autor, deLaPlataforma.length]);

  useEffect(cargar, [cargar]);

  // Desde la página de una comunidad (?comunidad=id) se llega directo a su tarjeta.
  useEffect(() => {
    if (!datos) return;
    const id = new URLSearchParams(window.location.search).get("comunidad");
    if (id) document.getElementById(`tarjeta-${id}`)?.scrollIntoView({ block: "start" });
  }, [datos]);

  if (usuario?.rol !== "coach") {
    return (
      <div className="pagina-estrecha">
        <h1>Esta página es para coaches</h1>
        <p className="texto-suave">Aquí la coach crea sus comunidades y sus cursos. Para verla, entra con el rol de coach.</p>
      </div>
    );
  }

  const crearComunidad = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando("comunidad");
    setError(null);
    try {
      await api<ComunidadCreada>("/api/coach/comunidades", {
        method: "POST",
        json: { ...forma, precio_mensual: Number(forma.precio_mensual) },
      });
      setForma(COMUNIDAD_VACIA);
      setCreando(false);
      cargar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(null);
    }
  };

  const agregarCursoManual = async (comunidad: string) => {
    setEnviando(`curso:${comunidad}`);
    setError(null);
    try {
      const curso = await api<CursoCreado>("/api/coach/cursos", {
        method: "POST",
        json: { comunidad },
      });
      router.push(`/coach/curso/${curso.id}`);
    } catch (err) {
      setError((err as Error).message);
      setEnviando(null);
    }
  };

  const ponerEnComunidad = async (curso: string, comunidad: string) => {
    setEnviando(`mover:${curso}`);
    setError(null);
    try {
      await api(`/api/coach/cursos/${curso}/comunidad`, { method: "POST", json: { comunidad } });
      cargar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(null);
    }
  };

  const sueltos = datos?.cursos.filter((x) => !x.comunidad) ?? [];
  const mostrarSueltos = verSueltos || sueltos.length > 0;

  const listaCursos = (cursos: ResumenCursoCoach[]) => (
    <ul className="mis-cursos">
      {cursos.map((x) => (
        <li key={x.id}>
          <Link href={`/coach/curso/${x.id}`} className="mi-curso">
            <span className="mi-curso-titulo">{x.titulo || "Curso sin título"}</span>
            <span className="texto-suave mi-curso-meta">
              <span className="cifra">{x.lecciones}</span> {x.lecciones === 1 ? "lección" : "lecciones"}
              {x.origen === "ia" && " · hecho con IA"} · editado {hace(x.actualizadoEn)}
            </span>
            <span className={x.estado === "publicado" ? "pastilla pastilla-ok" : "pastilla"}>
              {x.estado === "publicado" ? "Publicado" : x.enPagina ? "En la página" : "Borrador"}
            </span>
            <span className="mi-curso-editar" aria-hidden="true">
              <IconoEditar width={16} height={16} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );

  // "Agregar un curso": a mano, con IA y, en una comunidad, uno que ya hizo.
  const agregarCurso = (comunidad: string) =>
    conIA === comunidad ? (
      <CrearConIA comunidad={comunidad} alCerrar={() => setConIA(null)} />
    ) : (
      <div className="agregar-curso">
        <p className="agregar-curso-titulo">{comunidad ? "Agregar un curso a esta comunidad" : "Crear un curso"}</p>
        <div className="agregar-curso-opciones">
          <button
            type="button"
            className="opcion-agregar"
            onClick={() => void agregarCursoManual(comunidad)}
            disabled={enviando === `curso:${comunidad}`}
          >
            <IconoEditar width={22} height={22} />
            <span>
              <strong>{enviando === `curso:${comunidad}` ? "Creando…" : "A mano"}</strong>
              <span className="texto-suave">Escribe tus lecciones, sube los videos y arma las preguntas.</span>
            </span>
            <IconoFlechaDer width={16} height={16} />
          </button>
          <button type="button" className="opcion-agregar" onClick={() => setConIA(comunidad)} disabled={!datos?.ia}>
            <IconoAsistenteGeneral width={22} height={22} />
            <span>
              <strong>Con IA, a partir de un documento</strong>
              <span className="texto-suave">
                {datos?.ia
                  ? "Sube un PDF o Word con tu material y la IA te propone el curso para que lo revises."
                  : "Necesita una IA conectada (clave de Gemini o de Claude en el servidor)."}
              </span>
            </span>
            <IconoFlechaDer width={16} height={16} />
          </button>
        </div>
        {comunidad && sueltos.length > 0 && (
          <form
            className="poner-curso"
            onSubmit={(e) => {
              e.preventDefault();
              const curso = new FormData(e.currentTarget).get("curso");
              if (typeof curso === "string" && curso) void ponerEnComunidad(curso, comunidad);
            }}
          >
            <label className="campo">
              <span>O agrega uno que ya hiciste</span>
              <select name="curso" defaultValue="">
                <option value="" disabled>
                  Elige un curso sin comunidad
                </option>
                {sueltos.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.titulo || "Curso sin título"}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="boton boton-secundario" disabled={enviando?.startsWith("mover:")}>
              Agregar aquí
            </button>
          </form>
        )}
      </div>
    );

  return (
    <>
      <NavCoach />
      <div className="mis-comunidades">
      <header className="cabecera-pagina mis-comunidades-cabecera">
        <div>
          <h1>Comunidades y cursos</h1>
          <p className="texto-suave">
            Crea primero tu comunidad y luego sus cursos, o al revés. Un curso se queda como borrador hasta que lo
            publicas, y para publicarlo tiene que estar en una comunidad.
          </p>
        </div>
        <div className="mis-comunidades-acciones">
          {!creando && (
            <button type="button" className="boton" onClick={() => setCreando(true)}>
              Crear comunidad
            </button>
          )}
          <button
            type="button"
            className="boton boton-secundario"
            onClick={() => {
              setVerSueltos(true);
              requestAnimationFrame(() => document.getElementById("tarjeta-sueltos")?.scrollIntoView({ block: "start" }));
            }}
          >
            Crear curso
          </button>
        </div>
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {creando && (
        <form className="tarjeta forma-comunidad" onSubmit={crearComunidad}>
          <h2>Nueva comunidad</h2>
          <CamposComunidad forma={forma} alCambiar={setForma} />
          <div className="forma-acciones">
            <button type="submit" className="boton" disabled={enviando === "comunidad"}>
              {enviando === "comunidad" ? "Creando…" : "Crear comunidad"}
            </button>
            <button type="button" className="boton boton-fantasma" onClick={() => setCreando(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {!datos && !error && <p className="texto-suave">Cargando tus comunidades y cursos…</p>}

      {datos && mostrarSueltos && (
        <section id="tarjeta-sueltos" className="tarjeta mi-comunidad mis-sueltos" aria-labelledby="sueltos-titulo">
          <div>
            <h2 id="sueltos-titulo">Cursos sin comunidad</h2>
            <p className="texto-suave">
              Puedes armarlos desde ahora. Cuando tengas tu comunidad, ponlos en ella desde el editor del curso o desde
              la comunidad.
            </p>
          </div>
          {sueltos.length > 0 ? listaCursos(sueltos) : <p className="vacio">Todavía no tienes cursos sueltos.</p>}
          {agregarCurso(SUELTOS)}
        </section>
      )}

      {datos &&
        deLaPlataforma.map((id) => {
          const c = comunidades.find((x) => x.id === id);
          if (!c) return null;
          const suyos = cursos.filter((x) => x.comunidad === id);
          return (
            <section key={id} id={`tarjeta-${id}`} className="tarjeta mi-comunidad" aria-labelledby={`comunidad-${id}`}>
              <div className="mi-comunidad-cabecera">
                <PortadaTema tema={c.tema} clave={id} foto={c.foto} className="mi-comunidad-portada" alt={`Portada de la comunidad «${c.nombre}»`} />
                <div className="mi-comunidad-datos">
                  <h2 id={`comunidad-${id}`}>{c.nombre}</h2>
                  <p className="texto-suave">{c.descripcion}</p>
                  <p className="mi-comunidad-meta texto-suave">
                    {c.tema} · De la plataforma: su texto y sus cursos vienen con Merkatics y no se editan aquí. A sus
                    lecciones sí les subes videos y presentaciones, y en la comunidad publicas anuncios y moderas.
                  </p>
                  <div className="mi-comunidad-enlaces">
                    <Link href="/comunidad" className="enlace mi-comunidad-ver" onClick={() => cambiarComunidad(id)}>
                      Ver la comunidad <IconoFlechaDer width={15} height={15} />
                    </Link>
                    <Link href="/coach" className="enlace mi-comunidad-ver" onClick={() => cambiarComunidad(id)}>
                      Ver su resumen <IconoFlechaDer width={15} height={15} />
                    </Link>
                  </div>
                </div>
              </div>
              <h3>Cursos</h3>
              <ul className="mis-cursos">
                {suyos.map((x) => (
                  <li key={x.id}>
                    <Link href="/curso" className="mi-curso" onClick={() => cambiarCurso(x.id)}>
                      <span className="mi-curso-titulo">{x.titulo}</span>
                      <span className="texto-suave mi-curso-meta">
                        <span className="cifra">{x.lecciones.length}</span> lecciones · <span className="cifra">{x.minutos}</span> min
                      </span>
                      <span className="pastilla pastilla-ok">Publicado</span>
                      <span className="mi-curso-editar" aria-hidden="true">
                        <IconoFlechaDer width={16} height={16} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

      {datos?.comunidades.map((c) => {
        const suyos = datos.cursos.filter((x) => x.comunidad === c.id);
        const publicados = suyos.filter((x) => x.estado === "publicado").length;
        return (
          <section key={c.id} id={`tarjeta-${c.id}`} className="tarjeta mi-comunidad" aria-labelledby={`comunidad-${c.id}`}>
            <div className="mi-comunidad-cabecera">
              <PortadaTema tema={c.tema} clave={c.id} foto={c.foto} className="mi-comunidad-portada" alt={`Portada de la comunidad «${c.nombre}»`} />
              <div className="mi-comunidad-datos">
                <h2 id={`comunidad-${c.id}`}>{c.nombre}</h2>
                <p className="texto-suave">{c.descripcion}</p>
                <p className="mi-comunidad-meta texto-suave">
                  {c.tema} · {moneda(c.precio_mensual)} al mes
                  {publicados === 0 && " · Aparece en el directorio al publicar su primer curso"}
                </p>
                <div className="mi-comunidad-enlaces">
                  <Link href={`/comunidad?id=${encodeURIComponent(c.id)}`} className="enlace mi-comunidad-ver">
                    Ver la comunidad <IconoFlechaDer width={15} height={15} />
                  </Link>
                  <Link href={`/coach/comunidad/${encodeURIComponent(c.id)}`} className="enlace mi-comunidad-ver">
                    <IconoEditar width={15} height={15} /> Editar
                  </Link>
                </div>
              </div>
            </div>

            <h3>Cursos</h3>
            {suyos.length === 0 ? <p className="vacio">Todavía no tiene cursos.</p> : listaCursos(suyos)}
            {agregarCurso(c.id)}
          </section>
        );
      })}
      </div>
    </>
  );
}
