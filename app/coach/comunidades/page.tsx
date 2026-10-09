"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useApp } from "@/components/Contexto";
import { IconoAsistenteGeneral, IconoEditar, IconoFlechaDer } from "@/components/Iconos";
import PortadaTema from "@/components/PortadaTema";
import { useTitulo } from "@/components/useTitulo";
import { api, hace, moneda } from "@/lib/cliente";
import { TEMAS } from "@/lib/comunidades";
import type { ComunidadCreada, CursoCreado } from "@/lib/tipos";

type ResumenCursoCoach = Pick<CursoCreado, "id" | "comunidad" | "titulo" | "estado" | "origen" | "actualizadoEn"> & {
  lecciones: number;
};

const COMUNIDAD_VACIA = { nombre: "", descripcion: "", tema: "Finanzas", coach_titulo: "", precio_mensual: "390" };

// Las comunidades de la coach: crear una nueva y, dentro de cada una, ver y
// agregar cursos (a mano o, en la siguiente entrega, con IA a partir de un documento).
export default function PaginaMisComunidades() {
  const router = useRouter();
  const { usuario, cambiarComunidad, recargarCatalogo } = useApp();
  const [datos, setDatos] = useState<{ comunidades: ComunidadCreada[]; cursos: ResumenCursoCoach[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [forma, setForma] = useState(COMUNIDAD_VACIA);
  const [enviando, setEnviando] = useState<string | null>(null);
  useTitulo("Mis comunidades");

  const autor = usuario?.nombre ?? "";
  const cabeceras = { "X-Rol": "coach" };

  const cargar = useCallback(() => {
    if (!autor) return;
    api<{ comunidades: ComunidadCreada[]; cursos: ResumenCursoCoach[] }>(
      `/api/coach/comunidades?autor=${encodeURIComponent(autor)}`,
      { headers: { "X-Rol": "coach" } },
    )
      .then((d) => {
        setDatos(d);
        if (d.comunidades.length === 0) setCreando(true);
      })
      .catch((e) => setError((e as Error).message));
  }, [autor]);

  useEffect(cargar, [cargar]);

  if (usuario?.rol !== "coach") {
    return (
      <div className="pagina-estrecha">
        <h1>Esta página es para coaches</h1>
        <p className="texto-suave">Aquí la coach crea su comunidad y sus cursos. Para verla, entra con el rol de coach.</p>
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
        headers: cabeceras,
        json: { autor, ...forma, precio_mensual: Number(forma.precio_mensual) },
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
    setEnviando(comunidad);
    setError(null);
    try {
      const curso = await api<CursoCreado>("/api/coach/cursos", {
        method: "POST",
        headers: cabeceras,
        json: { autor, comunidad },
      });
      router.push(`/coach/curso/${curso.id}`);
    } catch (err) {
      setError((err as Error).message);
      setEnviando(null);
    }
  };

  const verEnPlataforma = async (comunidad: string) => {
    await recargarCatalogo();
    cambiarComunidad(comunidad);
    router.push("/comunidad");
  };

  return (
    <div className="mis-comunidades">
      <header className="cabecera-pagina mis-comunidades-cabecera">
        <div>
          <h1>Mis comunidades</h1>
          <p className="texto-suave">
            Crea tu comunidad y agrégale cursos. Un curso se queda como borrador hasta que lo publicas.
          </p>
        </div>
        {!creando && (
          <button type="button" className="boton" onClick={() => setCreando(true)}>
            Crear comunidad
          </button>
        )}
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {creando && (
        <form className="tarjeta forma-comunidad" onSubmit={crearComunidad}>
          <h2>Nueva comunidad</h2>
          <label className="campo">
            <span>Nombre</span>
            <input
              value={forma.nombre}
              onChange={(e) => setForma({ ...forma, nombre: e.target.value })}
              maxLength={60}
              placeholder="Por ejemplo: Cocina que Vende"
              required
            />
          </label>
          <label className="campo">
            <span>¿Para quién es?</span>
            <textarea
              value={forma.descripcion}
              onChange={(e) => setForma({ ...forma, descripcion: e.target.value })}
              maxLength={240}
              rows={3}
              placeholder="Una o dos líneas: a quién ayudas y con qué."
              required
            />
          </label>
          <div className="forma-fila">
            <label className="campo">
              <span>Tema</span>
              <select value={forma.tema} onChange={(e) => setForma({ ...forma, tema: e.target.value })}>
                {TEMAS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="campo">
              <span>Membresía al mes (MXN)</span>
              <input
                type="number"
                min={50}
                max={5000}
                step={10}
                value={forma.precio_mensual}
                onChange={(e) => setForma({ ...forma, precio_mensual: e.target.value })}
                required
              />
            </label>
          </div>
          <label className="campo">
            <span>Tu título (aparece junto a tu nombre)</span>
            <input
              value={forma.coach_titulo}
              onChange={(e) => setForma({ ...forma, coach_titulo: e.target.value })}
              maxLength={80}
              placeholder="Por ejemplo: Chef y asesora de negocios"
            />
          </label>
          <div className="forma-acciones">
            <button type="submit" className="boton" disabled={enviando === "comunidad"}>
              {enviando === "comunidad" ? "Creando…" : "Crear comunidad"}
            </button>
            {datos && datos.comunidades.length > 0 && (
              <button type="button" className="boton boton-fantasma" onClick={() => setCreando(false)}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {!datos && !error && <p className="texto-suave">Cargando tus comunidades…</p>}

      {datos?.comunidades.map((c) => {
        const suyos = datos.cursos.filter((x) => x.comunidad === c.id);
        const publicados = suyos.filter((x) => x.estado === "publicado").length;
        return (
          <section key={c.id} className="tarjeta mi-comunidad" aria-labelledby={`comunidad-${c.id}`}>
            <div className="mi-comunidad-cabecera">
              <PortadaTema tema={c.tema} clave={c.id} className="mi-comunidad-portada" />
              <div className="mi-comunidad-datos">
                <h2 id={`comunidad-${c.id}`}>{c.nombre}</h2>
                <p className="texto-suave">{c.descripcion}</p>
                <p className="mi-comunidad-meta texto-suave">
                  {c.tema} · {moneda(c.precio_mensual)} al mes ·{" "}
                  {publicados > 0 ? (
                    <button type="button" className="enlace" onClick={() => void verEnPlataforma(c.id)}>
                      Ver en la plataforma
                    </button>
                  ) : (
                    "Aparece en el directorio al publicar su primer curso"
                  )}
                </p>
              </div>
            </div>

            <h3>Cursos</h3>
            {suyos.length === 0 && <p className="vacio">Todavía no tiene cursos.</p>}
            <ul className="mis-cursos">
              {suyos.map((x) => (
                <li key={x.id}>
                  <Link href={`/coach/curso/${x.id}`} className="mi-curso">
                    <span className="mi-curso-titulo">{x.titulo || "Curso sin título"}</span>
                    <span className="texto-suave mi-curso-meta">
                      <span className="cifra">{x.lecciones}</span> {x.lecciones === 1 ? "lección" : "lecciones"} · editado{" "}
                      {hace(x.actualizadoEn)}
                    </span>
                    <span className={x.estado === "publicado" ? "pastilla pastilla-ok" : "pastilla"}>
                      {x.estado === "publicado" ? "Publicado" : "Borrador"}
                    </span>
                    <span className="mi-curso-editar" aria-hidden="true">
                      <IconoEditar width={16} height={16} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="agregar-curso">
              <p className="agregar-curso-titulo">Agregar un curso</p>
              <div className="agregar-curso-opciones">
                <button
                  type="button"
                  className="opcion-agregar"
                  onClick={() => void agregarCursoManual(c.id)}
                  disabled={enviando === c.id}
                >
                  <IconoEditar width={22} height={22} />
                  <span>
                    <strong>{enviando === c.id ? "Creando…" : "A mano"}</strong>
                    <span className="texto-suave">Escribe tus lecciones, sube los videos y arma las preguntas.</span>
                  </span>
                  <IconoFlechaDer width={16} height={16} />
                </button>
                <button type="button" className="opcion-agregar" disabled>
                  <IconoAsistenteGeneral width={22} height={22} />
                  <span>
                    <strong>Con IA, a partir de un documento</strong>
                    <span className="texto-suave">Sube un PDF o Word y la IA te propone el curso. Llega en la siguiente entrega.</span>
                  </span>
                </button>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
