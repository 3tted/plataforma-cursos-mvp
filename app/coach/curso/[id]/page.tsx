"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/Contexto";
import EditorPreguntas from "@/components/editor/EditorPreguntas";
import FotoPortada from "@/components/editor/FotoPortada";
import VideoEnEditor from "@/components/editor/VideoEnEditor";
import { IconoAsistenteGeneral, IconoBorrar, IconoFlechaIzq } from "@/components/Iconos";
import { useTitulo } from "@/components/useTitulo";
import { api } from "@/lib/cliente";
import type { CursoCreado, DatosCurso, Leccion, LeccionCreada, ModuloCreado } from "@/lib/tipos";

const idTemporal = () => `nueva-${Math.random().toString(36).slice(2, 10)}`;

const leccionNueva = (): LeccionCreada => ({
  id: idTemporal(),
  titulo: "",
  duracion_min: 5,
  gratis: false,
  resumen: "",
  contenido: "",
  transcripcion: "",
  preguntas_sugeridas: [],
  repaso: [],
});

// Editor de un curso de la coach: datos, módulos y lecciones (texto,
// transcripción, video y repaso) y examen final. Se guarda como borrador y
// se publica cuando está completo.
export default function EditorCurso() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { usuario, cambiarCurso, recargarCatalogo, recargarCurso } = useApp();
  const [guardado, setGuardado] = useState<CursoCreado | null>(null);
  const [curso, setCurso] = useState<CursoCreado | null>(null);
  const [videos, setVideos] = useState<Record<string, { nombre: string; url: string; inicio?: number; fin?: number }>>({});
  // La presentación con IA de cada lección (si tiene).
  const [presentaciones, setPresentaciones] = useState<Record<string, NonNullable<Leccion["presentacion"]>>>({});
  const [ocupado, setOcupado] = useState<"guardar" | "publicar" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [faltan, setFaltan] = useState<string[]>([]);
  const [comunidades, setComunidades] = useState<{ id: string; nombre: string; tema: string }[] | null>(null);
  // Aviso de la IA al crear el borrador (si no juntó todas las lecciones o preguntas pedidas).
  const [avisoIA, setAvisoIA] = useState<string | null>(null);
  useEffect(() => {
    try {
      setAvisoIA(sessionStorage.getItem(`fc.avisoIA.${id}`));
    } catch {
      setAvisoIA(null);
    }
  }, [id]);
  useTitulo(curso?.titulo || "Editar curso");

  const autor = usuario?.nombre ?? "";
  const sinGuardar = !!curso && JSON.stringify(curso) !== JSON.stringify(guardado);

  const cargarVideos = useCallback(async () => {
    const datos = await api<DatosCurso>(`/api/curso?curso=${encodeURIComponent(id)}&borrador=1`).catch(() => null);
    if (!datos || datos.curso.id !== id) return;
    const lista: Record<string, { nombre: string; url: string; inicio?: number; fin?: number }> = {};
    for (const m of datos.curso.modulos)
      for (const l of m.lecciones) if (l.video) lista[l.id] = { nombre: l.video.nombre, url: l.video.url, inicio: l.video.inicio, fin: l.video.fin };
    setVideos(lista);
    const conPresentacion: Record<string, NonNullable<Leccion["presentacion"]>> = {};
    for (const m of datos.curso.modulos) for (const l of m.lecciones) if (l.presentacion) conPresentacion[l.id] = l.presentacion;
    setPresentaciones(conPresentacion);
  }, [id]);

  useEffect(() => {
    if (!autor) return;
    api<CursoCreado>(`/api/coach/cursos/${id}`)
      .then((c) => {
        setGuardado(c);
        setCurso(c);
      })
      .catch((e) => setError((e as Error).message));
    api<{ comunidades: { id: string; nombre: string; tema: string }[] }>("/api/coach/comunidades")
      .then((d) => setComunidades(d.comunidades.map((c) => ({ id: c.id, nombre: c.nombre, tema: c.tema }))))
      .catch(() => setComunidades([]));
    void cargarVideos();
  }, [id, autor, cargarVideos]);

  // Avisa antes de salir si hay cambios sin guardar.
  useEffect(() => {
    if (!sinGuardar) return;
    const alSalir = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, [sinGuardar]);

  if (usuario?.rol !== "coach") {
    return (
      <div className="pagina-estrecha">
        <h1>Esta página es para coaches</h1>
      </div>
    );
  }
  if (!curso) {
    return error ? (
      <div className="pagina-estrecha">
        <p className="error">{error}</p>
        <Link href="/coach/comunidades" className="volver">
          <IconoFlechaIzq width={16} height={16} /> Comunidades y cursos
        </Link>
      </div>
    ) : (
      <p className="texto-suave">Cargando el curso…</p>
    );
  }

  const cambiar = (f: (c: CursoCreado) => CursoCreado) => {
    setCurso((c) => (c ? f(c) : c));
    setAviso(null);
  };
  const cambiarModulo = (i: number, f: (m: ModuloCreado) => ModuloCreado) =>
    cambiar((c) => ({ ...c, modulos: c.modulos.map((m, j) => (j === i ? f(m) : m)) }));
  const cambiarLeccion = (i: number, k: number, cambio: Partial<LeccionCreada>) =>
    cambiarModulo(i, (m) => ({ ...m, lecciones: m.lecciones.map((l, j) => (j === k ? { ...l, ...cambio } : l)) }));
  const mover = <T,>(lista: T[], de: number, a: number) => {
    if (a < 0 || a >= lista.length) return lista;
    const copia = [...lista];
    const [x] = copia.splice(de, 1);
    copia.splice(a, 0, x);
    return copia;
  };

  const lecciones = curso.modulos.flatMap((m) => m.lecciones);
  const guardadas = new Set(guardado?.modulos.flatMap((m) => m.lecciones.map((l) => l.id)) ?? []);

  const guardar = async (): Promise<CursoCreado | null> => {
    setOcupado("guardar");
    setError(null);
    try {
      const nuevo = await api<CursoCreado>(`/api/coach/cursos/${id}`, {
        method: "PUT",
        json: { curso },
      });
      setGuardado(nuevo);
      setCurso(nuevo);
      setAviso("Cambios guardados.");
      if (nuevo.estado === "publicado") void recargarCatalogo();
      return nuevo;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setOcupado(null);
    }
  };

  const publicar = async (publicar: boolean) => {
    if (sinGuardar && !(await guardar())) return;
    setOcupado("publicar");
    setError(null);
    setFaltan([]);
    try {
      const res = await fetch(`/api/coach/cursos/${id}/publicar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicar }),
      });
      const datos = (await res.json()) as CursoCreado & { error?: string; faltan?: string[] };
      if (!res.ok) {
        setError(datos.error ?? "No se pudo publicar.");
        setFaltan(datos.faltan ?? []);
        return;
      }
      setGuardado(datos);
      setCurso(datos);
      setAviso(
        publicar ? "¡Publicado! Tus alumnos ya lo ven en la comunidad." : "Despublicado: vuelve a ser borrador.",
      );
      await recargarCatalogo();
    } catch {
      setError("No se pudo conectar. Revisa tu conexión.");
    } finally {
      setOcupado(null);
    }
  };

  // La comunidad se cambia al momento (no espera a «Guardar»).
  const moverA = async (destino: string) => {
    setError(null);
    try {
      await api(`/api/coach/cursos/${id}/comunidad`, {
        method: "POST",
        json: { comunidad: destino },
      });
      setCurso((c) => (c ? { ...c, comunidad: destino } : c));
      setGuardado((g) => (g ? { ...g, comunidad: destino } : g));
      setAviso(destino ? "Curso puesto en la comunidad." : "El curso quedó sin comunidad.");
      void recargarCatalogo();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Lleva el curso a su comunidad, tal como lo verá el alumno. Si todavía no
  // estaba en la página, primero lo sube (sin publicarlo: solo la coach lo ve).
  const irALaPagina = async () => {
    if (sinGuardar && !(await guardar())) return;
    setError(null);
    if (curso.estado !== "publicado" && !curso.enPagina) {
      const res = await fetch(`/api/coach/cursos/${id}/pagina`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enPagina: true }),
      }).catch(() => null);
      const datos = res ? ((await res.json().catch(() => ({}))) as CursoCreado & { error?: string }) : null;
      if (!res?.ok || !datos) return setError(datos?.error ?? "No se pudo subir a la página. Revisa tu conexión.");
      setGuardado(datos);
      setCurso(datos);
    }
    await recargarCatalogo();
    cambiarCurso(id);
    await recargarCurso();
    router.push("/curso");
  };

  const quitarDeLaPagina = async () => {
    const res = await fetch(`/api/coach/cursos/${id}/pagina`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enPagina: false }),
    }).catch(() => null);
    if (!res?.ok) return setError("No se pudo quitar de la página.");
    const datos = (await res.json()) as CursoCreado;
    setGuardado(datos);
    setCurso(datos);
    setAviso("El curso volvió a quedar solo en el editor.");
    void recargarCatalogo();
  };

  const borrar = async () => {
    if (!window.confirm("¿Borrar este borrador? No se puede deshacer.")) return;
    try {
      await api(`/api/coach/cursos/${id}`, { method: "DELETE" });
      router.push("/coach/comunidades");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const lineas = (v: string[]) => v.join("\n");
  const enLineas = (texto: string) => texto.split("\n");

  return (
    <div className="editor-curso">
      <div className="editor-barra">
        <Link href="/coach/comunidades" className="volver">
          <IconoFlechaIzq width={16} height={16} /> Comunidades y cursos
        </Link>
        <span className={curso.estado === "publicado" ? "pastilla pastilla-ok" : "pastilla"}>
          {curso.estado === "publicado" ? "Publicado" : curso.enPagina ? "En la página · sin publicar" : "Borrador"}
        </span>
        <span className="texto-suave editor-estado" role="status">
          {ocupado === "guardar" ? "Guardando…" : sinGuardar ? "Cambios sin guardar" : aviso}
        </span>
        <div className="editor-acciones">
          <button
            type="button"
            className="boton boton-chico boton-fantasma-borde"
            onClick={() => void irALaPagina()}
            disabled={!curso.comunidad}
            title={curso.comunidad ? undefined : "Ponlo primero en una comunidad"}
          >
            {curso.estado === "publicado" || curso.enPagina ? "Ver en la página" : "Subir a la página"}
          </button>
          <button
            type="button"
            className="boton boton-chico boton-secundario"
            onClick={() => void guardar()}
            disabled={!sinGuardar || ocupado !== null}
          >
            Guardar
          </button>
          {curso.estado === "publicado" ? (
            <button
              type="button"
              className="boton boton-chico boton-fantasma"
              onClick={() => void publicar(false)}
              disabled={ocupado !== null}
            >
              Despublicar
            </button>
          ) : (
            <button
              type="button"
              className="boton boton-chico"
              onClick={() => void publicar(true)}
              disabled={ocupado !== null}
            >
              {ocupado === "publicar" ? "Publicando…" : "Publicar"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error editor-error" role="alert">
          <p>{error}</p>
          {faltan.length > 0 && (
            <ul>
              {faltan.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {curso.origen === "ia" && curso.estado === "borrador" && (
        <div className="aviso editor-aviso-ia">
          <IconoAsistenteGeneral width={22} height={22} />
          <div className="editor-aviso-ia-texto">
            <p>
              <strong>La IA armó este borrador con tu documento.</strong> Revísalo antes de publicar: que cada lección
              diga lo que tú enseñas, que las respuestas marcadas como correctas lo sean y que los minutos tengan
              sentido. Después súbelo a la página: ahí lo ves como tus alumnos, le agregas los videos (o presentaciones con
              IA) y lo publicas cuando esté listo.
            </p>
            {avisoIA && <p className="editor-aviso-faltan">{avisoIA}</p>}
          </div>
        </div>
      )}

      <section className="tarjeta editor-seccion" aria-labelledby="datos-titulo">
        <h2 id="datos-titulo">Datos del curso</h2>
        <label className="campo">
          <span>Comunidad</span>
          <select
            id="comunidad-curso"
            value={curso.comunidad}
            onChange={(e) => void moverA(e.target.value)}
            disabled={curso.estado === "publicado" || comunidades === null}
          >
            <option value="">Sin comunidad por ahora</option>
            {comunidades?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          {curso.estado === "publicado" ? (
            <p className="nota">Para cambiarlo de comunidad, primero despublícalo.</p>
          ) : comunidades?.length === 0 ? (
            <p className="nota">
              Todavía no tienes comunidades. <Link href="/coach/comunidades">Crea una</Link> y luego elígela aquí; para
              publicar el curso tiene que estar en una.
            </p>
          ) : (
            !curso.comunidad && <p className="nota">Para publicar el curso, elige en qué comunidad va.</p>
          )}
        </label>
        <FotoPortada
          de="curso"
          id={curso.id}
          tema={comunidades?.find((c) => c.id === curso.comunidad)?.tema ?? "Otro"}
          foto={curso.foto}
          alCambiar={(foto) => {
            // La foto se guarda al momento, aparte del resto del curso.
            const conFoto = (c: CursoCreado | null) => (c ? { ...c, foto } : c);
            setGuardado(conFoto);
            setCurso(conFoto);
            void recargarCatalogo();
          }}
        />
        <label className="campo">
          <span>Título</span>
          <input
            value={curso.titulo}
            onChange={(e) => cambiar((c) => ({ ...c, titulo: e.target.value }))}
            maxLength={120}
            placeholder="Por ejemplo: Tu menú que se vende solo"
          />
        </label>
        <label className="campo">
          <span>Subtítulo (una línea que diga qué logra el alumno)</span>
          <input
            value={curso.subtitulo}
            onChange={(e) => cambiar((c) => ({ ...c, subtitulo: e.target.value }))}
            maxLength={240}
          />
        </label>
        <div className="forma-fila">
          <label className="campo">
            <span>Lo que aprenderás (uno por renglón)</span>
            <textarea
              rows={5}
              value={lineas(curso.aprenderas)}
              onChange={(e) => cambiar((c) => ({ ...c, aprenderas: enLineas(e.target.value) }))}
            />
          </label>
          <label className="campo">
            <span>Preguntas sugeridas para el asistente (una por renglón)</span>
            <textarea
              rows={5}
              value={lineas(curso.preguntas_sugeridas)}
              onChange={(e) => cambiar((c) => ({ ...c, preguntas_sugeridas: enLineas(e.target.value) }))}
            />
          </label>
        </div>
        <label className="campo">
          <span>Requisitos</span>
          <input
            value={curso.requisitos}
            onChange={(e) => cambiar((c) => ({ ...c, requisitos: e.target.value }))}
            maxLength={300}
            placeholder="Por ejemplo: Ninguno."
          />
        </label>
      </section>

      <section className="editor-seccion" aria-labelledby="temario-editor-titulo">
        <h2 id="temario-editor-titulo">Temario</h2>
        {curso.modulos.map((m, i) => (
          <div key={i} className="tarjeta editor-modulo">
            <div className="editor-modulo-cabecera">
              <span className="modulo-numero">Módulo {i + 1}</span>
              <label className="campo">
                <span className="sr-only">Título del módulo {i + 1}</span>
                <input
                  value={m.titulo}
                  onChange={(e) => cambiarModulo(i, (x) => ({ ...x, titulo: e.target.value }))}
                  maxLength={120}
                  placeholder="Título del módulo"
                />
              </label>
              <div className="editor-orden">
                <button
                  type="button"
                  className="boton-icono boton-icono-chico"
                  onClick={() => cambiar((c) => ({ ...c, modulos: mover(c.modulos, i, i - 1) }))}
                  disabled={i === 0}
                  aria-label="Subir módulo"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="boton-icono boton-icono-chico"
                  onClick={() => cambiar((c) => ({ ...c, modulos: mover(c.modulos, i, i + 1) }))}
                  disabled={i === curso.modulos.length - 1}
                  aria-label="Bajar módulo"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="boton-icono boton-icono-chico"
                  onClick={() =>
                    window.confirm("¿Quitar este módulo con todas sus lecciones?") &&
                    cambiar((c) => ({ ...c, modulos: c.modulos.filter((_, j) => j !== i) }))
                  }
                  aria-label={`Quitar el módulo ${i + 1}`}
                >
                  <IconoBorrar width={16} height={16} />
                </button>
              </div>
            </div>

            {m.lecciones.map((l, k) => (
              <details key={l.id} className="editor-leccion" open={!l.titulo}>
                <summary>
                  <span className="editor-leccion-titulo">{l.titulo || "Lección sin título"}</span>
                  <span className="texto-suave editor-leccion-meta">
                    <span className="cifra">{l.duracion_min}</span> min
                    {l.gratis && " · Gratis"}
                    {videos[l.id] && " · Video"}
                    {l.repaso.length > 0 && ` · ${l.repaso.length} de repaso`}
                  </span>
                </summary>
                <div className="editor-leccion-cuerpo">
                  <div className="forma-fila editor-fila-leccion">
                    <label className="campo">
                      <span>Título</span>
                      <input
                        value={l.titulo}
                        onChange={(e) => cambiarLeccion(i, k, { titulo: e.target.value })}
                        maxLength={140}
                      />
                    </label>
                    <label className="campo editor-minutos">
                      <span>Minutos</span>
                      <input
                        type="number"
                        min={1}
                        max={240}
                        value={l.duracion_min}
                        onChange={(e) => cambiarLeccion(i, k, { duracion_min: Number(e.target.value) || 1 })}
                      />
                    </label>
                    <label className="editor-gratis">
                      <input
                        type="checkbox"
                        checked={l.gratis}
                        onChange={(e) => cambiarLeccion(i, k, { gratis: e.target.checked })}
                      />
                      Gratis (sin membresía)
                    </label>
                  </div>
                  <label className="campo">
                    <span>Resumen (una línea)</span>
                    <input
                      value={l.resumen}
                      onChange={(e) => cambiarLeccion(i, k, { resumen: e.target.value })}
                      maxLength={300}
                    />
                  </label>
                  <div className="campo">
                    <span>Video</span>
                    <VideoEnEditor
                      leccion={l.id}
                      guardada={guardadas.has(l.id)}
                      video={videos[l.id] ?? null}
                      presentacion={presentaciones[l.id] ?? null}
                      sinGuardar={sinGuardar}
                      alCambiar={() => void cargarVideos()}
                    />
                  </div>
                  <label className="campo">
                    <span>Texto de la lección (con ## para subtítulos y ** para negritas)</span>
                    <textarea
                      rows={10}
                      value={l.contenido}
                      onChange={(e) => cambiarLeccion(i, k, { contenido: e.target.value })}
                      maxLength={20000}
                    />
                  </label>
                  <label className="campo">
                    <span>Transcripción del video (opcional)</span>
                    <textarea
                      rows={4}
                      value={l.transcripcion}
                      onChange={(e) => cambiarLeccion(i, k, { transcripcion: e.target.value })}
                      maxLength={20000}
                    />
                  </label>
                  <label className="campo">
                    <span>Preguntas sugeridas de esta lección (una por renglón)</span>
                    <textarea
                      rows={3}
                      value={lineas(l.preguntas_sugeridas)}
                      onChange={(e) => cambiarLeccion(i, k, { preguntas_sugeridas: enLineas(e.target.value) })}
                    />
                  </label>
                  <div className="campo">
                    <span>Repaso de la lección (el alumno lo contesta después del video)</span>
                    <EditorPreguntas
                      preguntas={l.repaso}
                      alCambiar={(repaso) => cambiarLeccion(i, k, { repaso })}
                      vacio="Sin preguntas de repaso. Te recomendamos dos."
                      maximo={10}
                    />
                  </div>
                  <div className="editor-leccion-acciones">
                    <button
                      type="button"
                      className="enlace"
                      onClick={() => cambiarModulo(i, (x) => ({ ...x, lecciones: mover(x.lecciones, k, k - 1) }))}
                      disabled={k === 0}
                    >
                      Subir
                    </button>
                    <button
                      type="button"
                      className="enlace"
                      onClick={() => cambiarModulo(i, (x) => ({ ...x, lecciones: mover(x.lecciones, k, k + 1) }))}
                      disabled={k === m.lecciones.length - 1}
                    >
                      Bajar
                    </button>
                    <button
                      type="button"
                      className="enlace enlace-discreto"
                      onClick={() =>
                        window.confirm("¿Quitar esta lección?") &&
                        cambiarModulo(i, (x) => ({ ...x, lecciones: x.lecciones.filter((_, j) => j !== k) }))
                      }
                    >
                      Quitar lección
                    </button>
                  </div>
                </div>
              </details>
            ))}

            <button
              type="button"
              className="boton boton-chico boton-fantasma"
              onClick={() => cambiarModulo(i, (x) => ({ ...x, lecciones: [...x.lecciones, leccionNueva()] }))}
            >
              + Agregar lección
            </button>
          </div>
        ))}
        <button
          type="button"
          className="boton boton-secundario"
          onClick={() =>
            cambiar((c) => ({
              ...c,
              modulos: [...c.modulos, { id: `M${c.modulos.length + 1}`, titulo: "", lecciones: [leccionNueva()] }],
            }))
          }
        >
          + Agregar módulo
        </button>
      </section>

      <section className="tarjeta editor-seccion" aria-labelledby="examen-editor-titulo">
        <h2 id="examen-editor-titulo">Examen final</h2>
        <p className="texto-suave">
          Se desbloquea al terminar todas las lecciones. Se aprueba con 70% y hay 3 intentos.
        </p>
        <EditorPreguntas
          preguntas={curso.examen}
          alCambiar={(examen) => cambiar((c) => ({ ...c, examen }))}
          lecciones={lecciones.map((l) => ({ id: l.id, titulo: l.titulo }))}
          vacio="Todavía no hay preguntas. El examen necesita al menos una para publicar el curso."
        />
      </section>

      {curso.estado === "borrador" && (
        <div className="editor-pie">
          {curso.enPagina && (
            <button type="button" className="enlace enlace-discreto" onClick={() => void quitarDeLaPagina()}>
              Quitar de la página
            </button>
          )}
          <button type="button" className="enlace enlace-discreto editor-borrar" onClick={() => void borrar()}>
            Borrar este borrador
          </button>
        </div>
      )}
    </div>
  );
}
