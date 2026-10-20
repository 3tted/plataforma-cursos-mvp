"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useApp } from "@/components/Contexto";
import { IconoBorrar, IconoComunidad } from "@/components/Iconos";
import Arcos from "@/components/Arcos";
import Markdown from "@/components/Markdown";
import MatrizAlumnos from "@/components/MatrizAlumnos";
import SelectorCurso from "@/components/SelectorCurso";
import { useCursosDeMiEmpresa } from "@/components/useMiEmpresa";
import { useTitulo } from "@/components/useTitulo";
import { api, fechaCorta, hace, moneda } from "@/lib/cliente";
import { agrupar } from "@/lib/preguntas";
import type { LeccionCoach, ResumenCoach } from "@/lib/tipos";

const NOMBRE_METODO = { oxxo: "OXXO", spei: "SPEI", mercadopago: "Mercado Pago" } as const;

export default function PaginaCoach() {
  const router = useRouter();
  const {
    usuario,
    datos,
    lecciones,
    recargarCurso,
    setBorrador,
    cursoId,
    cambiarCurso,
    comunidades,
    comunidadId,
    cambiarComunidad,
    cursosComunidad,
  } = useApp();
  const [resumen, setResumen] = useState<ResumenCoach | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [agregada, setAgregada] = useState<string | null>(null);
  const [porBorrar, setPorBorrar] = useState<number | null>(null);
  useTitulo("Panel de coach");
  // El panel es solo de lo de su empresa.
  const { mios: cursos, activoEsMio } = useCursosDeMiEmpresa();

  // Todo el panel es del curso elegido arriba (y de su comunidad). Si cambia
  // antes de que llegue el resumen anterior, ese ya no se muestra.
  const vigente = useRef(cursoId);
  const cargar = useCallback(() => {
    vigente.current = cursoId;
    setError(null);
    api<ResumenCoach>(`/api/coach/resumen?curso=${encodeURIComponent(cursoId)}`)
      .then((r) => vigente.current === cursoId && setResumen(r))
      .catch(() => vigente.current === cursoId && setError("No pudimos cargar el resumen. Revisa tu conexión e inténtalo de nuevo."));
  }, [cursoId]);

  useEffect(() => {
    setResumen(null);
    if (usuario?.rol === "coach" && activoEsMio) cargar();
  }, [usuario, cargar, activoEsMio]);

  const grupos = useMemo(() => agrupar(resumen?.preguntas ?? []).slice(0, 12), [resumen]);

  if (usuario?.rol !== "coach") {
    return (
      <div className="pagina-estrecha">
        <h1>Esta vista es para la coach</h1>
        <p className="texto-suave">
          Aquí la coach ve qué preguntan sus alumnos al asistente, qué lecciones generan más dudas y los pagos. Para
          verla, entra con una cuenta de coach.
        </p>
      </div>
    );
  }

  // Sin cursos de su empresa en la página todavía, no hay nada que resumir.
  if (!activoEsMio) {
    return (
      <div className="pagina-estrecha">
        <h1>Panel de coach</h1>
        <p className="texto-suave">
          Aquí verás qué preguntan tus alumnos, qué lecciones generan más dudas y los pagos de tus comunidades. Empieza
          por crear tu comunidad y subir su primer curso a la página.
        </p>
        <Link href="/coach/comunidades" className="boton">
          Crear una comunidad o un curso
        </Link>
      </div>
    );
  }

  const agregarLeccion = async (e: FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const nueva = await api<LeccionCoach & { idCurso: string }>("/api/coach/lecciones", {
        method: "POST",
        json: { titulo, contenido, curso: cursoId },
      });
      setAgregada(nueva.idCurso);
      setTitulo("");
      setContenido("");
      await recargarCurso();
      cargar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const borrarLeccion = async (id: number) => {
    try {
      await api(`/api/coach/lecciones/${id}`, { method: "DELETE" });
      if (agregada === `C${id}`) setAgregada(null);
      setPorBorrar(null);
      await recargarCurso();
      cargar();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const responderEnComunidad = (pregunta: string, veces: number) => {
    setBorrador({
      categoria: "Dudas",
      titulo: pregunta.length > 140 ? pregunta.slice(0, 137) + "…" : pregunta,
      cuerpo: `${veces > 1 ? `Esta pregunta me la hicieron ${veces} veces en el asistente.` : "Me hicieron esta pregunta en el asistente."} Mi respuesta:\n\n`,
    });
    router.push("/comunidad");
  };

  const tituloDe = (id: string) => resumen?.titulos[id] ?? lecciones.find((l) => l.id === id)?.titulo ?? id;
  const maxConsultas = Math.max(1, ...(resumen?.leccionesConsultadas.map((l) => l.total) ?? [1]));
  const pagados = resumen?.pagos.filter((p) => p.estado === "pagado").length ?? 0;
  // Las lecciones del curso; las que la coach pega abajo son de texto, para probar el asistente.
  const delCurso = lecciones.filter((l) => !l.deCoach);
  const conVideo = delCurso.filter((l) => l.video).length;

  return (
    <div className="pagina-coach">
      <header className="portada">
        <Arcos />
        <h1>Hola, {usuario.nombre.split(" ")[0]}</h1>
        <p className="portada-texto">Lo que pasa en tu comunidad y lo que tus alumnos le preguntan al asistente.</p>
        <Link href="/coach/comunidades" className="boton boton-secundario portada-accion">
          Crear una comunidad o un curso
        </Link>
      </header>

      <section className="tarjeta panel-alcance" aria-label="Comunidad y curso del panel">
        <div className="panel-alcance-fila">
          <p className="panel-alcance-etiqueta">Comunidad</p>
          <div className="selector-curso" role="group" aria-label="Comunidad">
            {comunidades
              .filter((c) => cursos.some((x) => x.comunidad === c.id))
              .map((c) => {
                const suyos = cursos.filter((x) => x.comunidad === c.id).length;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className="selector-curso-opcion"
                    aria-pressed={c.id === comunidadId}
                    onClick={() => cambiarComunidad(c.id)}
                  >
                    <span className="selector-curso-titulo">{c.nombre}</span>
                    <span className="selector-curso-meta">
                      <span className="cifra">{suyos}</span> {suyos === 1 ? "curso" : "cursos"}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
        <div className="panel-alcance-fila">
          <p className="panel-alcance-etiqueta">Curso</p>
          {cursosComunidad.length > 0 ? (
            <SelectorCurso activo={cursoId} alElegir={cambiarCurso} etiqueta="Curso" aunqueSeaUno />
          ) : (
            <p className="panel-alcance-unico">{datos?.curso.titulo ?? "…"}</p>
          )}
        </div>
        <p className="nota">
          Todo lo de abajo es de lo que elijas aquí: el avance, las preguntas y los videos, del curso; los miembros, las
          publicaciones y los pagos, de su comunidad.
        </p>
      </section>

      {error && (
        <div className="error chat-aviso" role="alert">
          <span>{error}</span>
          <button type="button" className="boton boton-chico boton-secundario" onClick={cargar}>
            Reintentar
          </button>
        </div>
      )}

      <section aria-label="Resumen">
        <dl className="datos-coach">
          <div>
            <dt>Preguntas al asistente (7 días)</dt>
            <dd className="cifra">{resumen?.preguntasSemana ?? "…"}</dd>
          </div>
          <div>
            <dt>Miembros activos</dt>
            <dd className="cifra">{resumen?.miembros ?? "…"}</dd>
          </div>
          <div>
            <dt>Publicaciones</dt>
            <dd className="cifra">{resumen?.publicaciones ?? "…"}</dd>
          </div>
          <div>
            <dt>Pagos confirmados</dt>
            <dd className="cifra">{resumen ? pagados : "…"}</dd>
          </div>
          <div>
            <dt>Ingresos (simulados)</dt>
            <dd className="cifra">{resumen ? moneda(resumen.ingresosSimulados) : "…"}</dd>
          </div>
        </dl>
      </section>

      <MatrizAlumnos curso={cursoId} />

      <div className="rejilla-coach">
        <section className="tarjeta" aria-labelledby="preguntas-titulo">
          <h2 id="preguntas-titulo">Preguntas recientes de tus alumnos</h2>
          {resumen && grupos.length === 0 && (
            <p className="vacio">
              Todavía no hay preguntas. <Link href="/curso/asistente">Haz una de prueba</Link> para ver cómo aparece aquí.
            </p>
          )}
          <ul className="lista-preguntas">
            {grupos.map((g) => (
              <li key={g.clave} className="grupo-pregunta">
                <div className="grupo-pregunta-cabecera">
                  {g.veces > 1 && (
                    <span className="grupo-pregunta-conteo">
                      <span className="cifra">{g.veces}</span> veces
                    </span>
                  )}
                  <div>
                    <p className="pregunta-texto">{g.pregunta}</p>
                    <p className="texto-suave pregunta-meta">
                      {g.personas === 1 ? g.ultima.autor : `${g.personas} personas`} · {hace(g.ultima.creadaEn)}
                    </p>
                  </div>
                </div>
                {g.citas.length > 0 ? (
                  <div className="citas">
                    {g.citas.map((id) => (
                      <Link key={id} className="cita" href={`/curso/${id}`} title={tituloDe(id)}>
                        <span className="cita-id">{id}</span>
                        <span className="cita-titulo">{tituloDe(id)}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="nota">El curso no cubre esta pregunta: buena candidata para responderla tú.</p>
                )}
                {g.ultima.respuesta && (
                  <details>
                    <summary>Ver qué respondió el asistente</summary>
                    <Markdown texto={g.ultima.respuesta} className="prosa prosa-chat" conFuentes />
                  </details>
                )}
                <div className="grupo-pregunta-acciones">
                  <button type="button" className="accion" onClick={() => responderEnComunidad(g.pregunta, g.veces)}>
                    <IconoComunidad width={15} height={15} />
                    Responder en la comunidad
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="tarjeta" aria-labelledby="consultadas-titulo">
          <h2 id="consultadas-titulo">Lecciones más consultadas</h2>
          <p className="texto-suave">
            Las lecciones que el asistente cita más al responder. Muchas citas suelen indicar un tema que conviene reforzar.
          </p>
          {resumen && resumen.leccionesConsultadas.length === 0 && <p className="vacio">Sin datos todavía.</p>}
          <ul className="barras">
            {resumen?.leccionesConsultadas.map((l) => (
              <li key={l.id}>
                <span className="barra-etiqueta">
                  <span className="cita-id">{l.id}</span> {tituloDe(l.id)}
                </span>
                <span className="barra-pista">
                  <span className="barra-relleno" style={{ width: `${(l.total / maxConsultas) * 100}%` }} />
                </span>
                <span className="barra-valor">{l.total}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="tarjeta" aria-labelledby="videos-titulo">
        <h2 id="videos-titulo">Videos de tus lecciones</h2>
        <p className="texto-suave">
          <span className="cifra">{conVideo}</span> de <span className="cifra">{delCurso.length}</span> lecciones
          tienen video. Para subir o cambiar uno, abre la lección.
        </p>
        <ul className="videos-lista">
          {delCurso.map((l) => (
            <li key={l.id}>
              <Link href={`/curso/${l.id}`}>
                <span className="cita-id">{l.id}</span> {l.titulo}
              </Link>
              <span className={l.video ? "pastilla pastilla-ok" : "pastilla"}>{l.video ? "Con video" : "Sin video"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="tarjeta" aria-labelledby="propia-titulo">
        <h2 id="propia-titulo">Prueba el asistente con tu propio contenido</h2>
        {datos ? (
          <>
            <p className="texto-suave">
              Pega el texto o la transcripción de una lección tuya. Se agrega a «{datos.curso.titulo}» y el asistente
              empieza a responder con ella al momento.
            </p>
            <form className="formulario-leccion" onSubmit={agregarLeccion}>
              <label className="campo">
                <span>Título de la lección</span>
                <input
                  id="leccion-titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  maxLength={120}
                  placeholder="Por ejemplo: Cómo negociar con proveedores"
                  required
                />
              </label>
              <label className="campo">
                <span>Contenido o transcripción</span>
                <textarea
                  id="leccion-contenido"
                  value={contenido}
                  onChange={(e) => setContenido(e.target.value)}
                  maxLength={20000}
                  rows={8}
                  placeholder="Pega aquí el texto de tu lección…"
                  required
                />
              </label>
              <div className="fila-acciones">
                <span className="nota cifra">{contenido.length.toLocaleString("es-MX")} / 20,000 caracteres</span>
                <button type="submit" className="boton" disabled={guardando}>
                  {guardando ? "Agregando…" : "Agregar al curso"}
                </button>
              </div>
            </form>
            {agregada && (
              <p className="aviso aviso-ok" role="status">
                <span>
                  Listo: la lección ya está en el curso como <span className="cita-id">{agregada}</span>.{" "}
                  <Link href={`/curso/${agregada}`}>Ábrela</Link> o <Link href="/curso/asistente">pregúntale al asistente</Link>{" "}
                  sobre ella.
                </span>
              </p>
            )}
            {resumen && resumen.leccionesCoach.length > 0 && (
              <ul className="lecciones-propias">
                {resumen.leccionesCoach.map((l) => (
                  <li key={l.id}>
                    <Link href={`/curso/C${l.id}`}>
                      <span className="cita-id">C{l.id}</span> {l.titulo}
                    </Link>
                    <span className="texto-suave">{fechaCorta(l.creadaEn)}</span>
                    {porBorrar === l.id ? (
                      <span className="confirmacion" role="group" aria-label={`Confirmar que quitas ${l.titulo}`}>
                        ¿Quitarla del curso?
                        <button type="button" className="boton boton-chico" onClick={() => borrarLeccion(l.id)}>
                          Sí, quitar
                        </button>
                        <button type="button" className="boton boton-chico boton-fantasma" onClick={() => setPorBorrar(null)}>
                          Cancelar
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="boton-icono boton-icono-chico"
                        onClick={() => setPorBorrar(l.id)}
                        aria-label={`Quitar la lección ${l.titulo}`}
                        title="Quitar del curso"
                      >
                        <IconoBorrar width={15} height={15} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="texto-suave">Cargando el curso…</p>
        )}
      </section>

      <section className="tarjeta" aria-labelledby="pagos-titulo">
        <h2 id="pagos-titulo">Pagos (simulados)</h2>
        {resumen && resumen.pagos.length === 0 ? (
          <p className="vacio">Todavía no hay pagos. Entra como alumno y prueba la membresía.</p>
        ) : (
          <div className="tabla-desplazable">
            <table className="tabla-pagos">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Alumno</th>
                  <th>Método</th>
                  <th>Monto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {resumen?.pagos.map((p) => (
                  <tr key={p.id}>
                    <td>{fechaCorta(p.creadoEn)}</td>
                    <td>{p.autor}</td>
                    <td>{NOMBRE_METODO[p.metodo]}</td>
                    <td className="numero">{moneda(p.monto)}</td>
                    <td>
                      <span className={p.estado === "pagado" ? "pastilla pastilla-ok" : "pastilla"}>
                        {p.estado === "pagado" ? "Pagado" : "Pendiente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
