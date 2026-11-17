"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import EditorPreguntas from "@/components/editor/EditorPreguntas";
import {
  IconoAbajo,
  IconoArriba,
  IconoAsistenteGeneral,
  IconoBorrar,
  IconoCheck,
  IconoCurso,
  IconoComunidad,
  IconoDesplegar,
  IconoDocumento,
  IconoEnviar,
  IconoFlechaIzq,
  IconoMas,
  IconoReintentar,
  IconoSubir,
  IconoVideo,
} from "@/components/Iconos";
import { useTitulo } from "@/components/useTitulo";
import { api } from "@/lib/cliente";
import { MAX_BYTES_VIDEO, reloj, segundos, tamañoLegible, tipoDeVideo } from "@/lib/reglas-video";
import { SubidaCancelada, medirDuracion, subirVideo } from "@/lib/subir-video";
import type { BorradorTaller, LeccionTaller, MensajeTaller, TallerCurso, VideoTaller } from "@/lib/tipos";

// Armar un curso platicando con la IA (lib/taller.ts): la plática a un lado y
// el curso que se va armando al otro, cada uno con su propio scroll. Lo que la
// coach cambia a mano se guarda solo; la IA cambia el curso cuando se lo pide.

type Taller = TallerCurso & { ia?: boolean };
type Nota = { rol: "nota" | "error"; texto: string; reintentar?: string };
type Linea = MensajeTaller | Nota;
type Subida = { clave: string; nombre: string; avance: number; error?: string; cancelar?: () => void };

const SALUDOS: Record<TallerCurso["modo"], string> = {
  mano: "Arma tu curso a tu manera: agrega las lecciones a un lado y súbele su video a cada una. Cuando quieras, pídeme lo demás: títulos, descripciones, apuntes, preguntas de repaso y el examen.",
  video:
    "Sube los videos de tu curso: uno o los que necesites, y puedes agregar más después. Mientras los veo, cuéntame cómo lo quieres: para quién es, cuántas lecciones, o si cada video es una lección.",
  documento: "Sube tu PDF o Word y dime cómo quieres el curso. Yo propongo las lecciones, sus apuntes, el repaso y el examen, y lo ajustamos platicando.",
};
const SUGERENCIAS: Record<TallerCurso["modo"], string[]> = {
  mano: ["Ponle título y descripción a todo", "Escribe los apuntes de cada lección", "Haz 2 preguntas de repaso por lección", "Hazme un examen de 8 preguntas"],
  video: ["Arma el curso con mis videos", "Una lección por video", "Divide los videos largos en lecciones de 5 a 10 minutos", "Hazme un examen de 10 preguntas"],
  documento: ["Arma el curso con mi documento", "Hazlo de 5 lecciones", "Hazme un examen de 10 preguntas"],
};
const MODO: Record<TallerCurso["modo"], string> = { mano: "A mano", video: "Con videos", documento: "Con PDF" };

const minutosDe = (l: LeccionTaller, v?: VideoTaller) => {
  if (l.duracion_min) return l.duracion_min;
  const fin = l.fin ?? v?.duracion;
  return v && fin ? Math.max(1, Math.round((fin - (l.inicio ?? 0)) / 60)) : undefined;
};

export default function CrearCurso() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [taller, setTaller] = useState<Taller | null>(null);
  const [borrador, setBorrador] = useState<BorradorTaller | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [estado, setEstado] = useState<"guardado" | "sin-guardar" | "guardando" | "error">("guardado");
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [ver, setVer] = useState<"chat" | "curso">("chat");
  const [punto, setPunto] = useState(false);
  const [creando, setCreando] = useState(false);
  const [errorTramo, setErrorTramo] = useState<Record<string, string>>({});
  useTitulo(borrador?.titulo || "Nuevo curso");

  const raiz = useRef<HTMLDivElement>(null);
  const mensajes = useRef<HTMLDivElement>(null);
  const lado = useRef<HTMLElement>(null);
  const archivoVideos = useRef<HTMLInputElement>(null);
  const archivoDocumento = useRef<HTMLInputElement>(null);
  const paraLeccion = useRef<string | null>(null);
  const actual = useRef<BorradorTaller | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cola = useRef<Promise<void>>(Promise.resolve());
  const pendiente = useRef(false);
  const siguiendo = useRef(new Set<string>());
  const reintentos = useRef<Record<string, number>>({});
  actual.current = borrador;

  // ---------------------------------------------------------------- cargar

  useEffect(() => {
    api<Taller>(`/api/coach/talleres/${id}`)
      .then((t) => {
        setTaller(t);
        setBorrador(t.borrador);
        setLineas(t.chat);
        // A mano, las lecciones vacías empiezan abiertas.
        setAbiertas(new Set(t.borrador.lecciones.filter((l) => !l.titulo && !l.contenido && !l.video).map((l) => l.id)));
      })
      .catch((e) => setError((e as Error).message));
  }, [id]);

  // ---------------------------------------------------------------- guardar lo que cambia a mano

  const guardarYa = useCallback((): Promise<void> => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    if (!pendiente.current || !actual.current) return cola.current;
    pendiente.current = false;
    const enviado = actual.current;
    setEstado("guardando");
    cola.current = cola.current.then(() =>
      api<Taller>(`/api/coach/talleres/${id}`, { method: "PUT", json: { borrador: enviado } })
        .then((t) => {
          setTaller((x) => (x ? { ...t, ia: x.ia } : t));
          setEstado(pendiente.current ? "sin-guardar" : "guardado");
        })
        .catch(() => {
          pendiente.current = true;
          setEstado("error");
        }),
    );
    return cola.current;
  }, [id]);

  const cambiar = useCallback(
    (cambio: (b: BorradorTaller) => BorradorTaller) => {
      setBorrador((b) => (b ? cambio(b) : b));
      pendiente.current = true;
      setEstado("sin-guardar");
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => void guardarYa(), 800);
    },
    [guardarYa],
  );

  const cambiarLeccion = (lid: string, cambio: Partial<LeccionTaller>) =>
    cambiar((b) => ({ ...b, lecciones: b.lecciones.map((l) => (l.id === lid ? { ...l, ...cambio } : l)) }));

  useEffect(() => {
    const alSalir = (e: BeforeUnloadEvent) => {
      if (pendiente.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, []);

  /** Cuando el servidor devuelve el curso cambiado (la IA, un video quitado…). */
  const recibir = (t: TallerCurso) => {
    setTaller((x) => ({ ...t, ia: x?.ia }));
    setBorrador(t.borrador);
    pendiente.current = false;
    setEstado("guardado");
  };

  // ---------------------------------------------------------------- lecciones

  const nuevoId = (b: BorradorTaller) => `L${Math.max(0, taller?.siguiente ? taller.siguiente - 1 : 0, ...b.lecciones.map((l) => Number(l.id.slice(1)) || 0)) + 1}`;

  const agregarLeccion = (despuesDe?: string) => {
    if (!borrador || borrador.lecciones.length >= 30) return;
    const lid = nuevoId(borrador);
    cambiar((b) => {
      const i = despuesDe ? b.lecciones.findIndex((l) => l.id === despuesDe) : b.lecciones.length - 1;
      const nueva: LeccionTaller = { id: lid, modulo: b.lecciones[i]?.modulo ?? "", titulo: "", resumen: "", contenido: "", preguntas_sugeridas: [], repaso: [] };
      const lecciones = [...b.lecciones];
      lecciones.splice(i + 1, 0, nueva);
      return { ...b, lecciones };
    });
    setAbiertas((s) => new Set(s).add(lid));
    requestAnimationFrame(() => {
      const el = document.getElementById(`leccion-${lid}`);
      const contenedor = lado.current;
      if (!el) return;
      if (contenedor && contenedor.scrollHeight > contenedor.clientHeight + 1) {
        contenedor.scrollTo({ top: contenedor.scrollTop + el.getBoundingClientRect().top - contenedor.getBoundingClientRect().top - 12, behavior: "smooth" });
      } else {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      (el.querySelector("input") as HTMLInputElement | null)?.focus({ preventScroll: true });
    });
  };

  const quitarLeccion = (l: LeccionTaller, n: number) => {
    if (!window.confirm(`¿Quitar la lección ${n}${l.titulo ? ` «${l.titulo}»` : ""}?`)) return;
    cambiar((b) => ({
      ...b,
      lecciones: b.lecciones.filter((x) => x.id !== l.id),
      examen: b.examen.map((q) => (q.leccion === l.id ? { ...q, leccion: undefined } : q)),
    }));
  };

  const mover = (lid: string, hacia: -1 | 1) =>
    cambiar((b) => {
      const i = b.lecciones.findIndex((l) => l.id === lid);
      const j = i + hacia;
      if (i < 0 || j < 0 || j >= b.lecciones.length) return b;
      const lecciones = [...b.lecciones];
      [lecciones[i], lecciones[j]] = [lecciones[j], lecciones[i]];
      return { ...b, lecciones };
    });

  const cambiarTramo = (l: LeccionTaller, campo: "inicio" | "fin", valor: string) => {
    const v = taller?.videos.find((x) => x.id === l.video);
    const limpio = valor.trim();
    const s = limpio === "" ? undefined : segundos(limpio);
    if (limpio !== "" && s === undefined) {
      setErrorTramo((e) => ({ ...e, [l.id]: "Escribe el tiempo como 6:10 o 1:02:30." }));
      return;
    }
    const inicio = campo === "inicio" ? s : l.inicio;
    const fin = campo === "fin" ? s : l.fin;
    const tope = v?.duracion;
    if (fin !== undefined && fin - (inicio ?? 0) < 5) {
      setErrorTramo((e) => ({ ...e, [l.id]: "El tramo debe durar al menos 5 segundos." }));
      return;
    }
    if (tope && ((inicio ?? 0) >= tope || (fin ?? 0) > tope + 1)) {
      setErrorTramo((e) => ({ ...e, [l.id]: `El video dura ${reloj(tope)}.` }));
      return;
    }
    setErrorTramo((e) => ({ ...e, [l.id]: "" }));
    cambiarLeccion(l.id, { inicio, fin });
  };

  // ---------------------------------------------------------------- el chat

  useEffect(() => {
    const m = mensajes.current;
    if (m) m.scrollTop = m.scrollHeight;
  }, [lineas, pensando]);

  const mandar = async (mensaje: string) => {
    const limpio = mensaje.trim();
    if (!limpio || pensando || !taller?.ia) return;
    setTexto("");
    setLineas((ls) => [...ls.filter((l) => l.rol !== "error"), { rol: "coach", texto: limpio }]);
    setPensando(true);
    try {
      await guardarYa();
      const r = await api<{ respuesta: string; cambios: string[]; taller: TallerCurso }>(`/api/coach/talleres/${id}/mensaje`, {
        method: "POST",
        json: { texto: limpio },
      });
      setLineas((ls) => [...ls, { rol: "ia", texto: r.respuesta, cambios: r.cambios }]);
      recibir(r.taller);
      if (r.cambios.length && ver === "chat") setPunto(true);
    } catch (e) {
      setLineas((ls) => [...ls.slice(0, -1), { rol: "error", texto: (e as Error).message, reintentar: limpio }]);
    } finally {
      setPensando(false);
    }
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    void mandar(texto);
  };

  // ---------------------------------------------------------------- videos

  const seguir = useCallback(
    (vid: string) => {
      if (siguiendo.current.has(vid)) return;
      siguiendo.current.add(vid);
      const vuelta = async () => {
        let v: VideoTaller | null = null;
        try {
          v = await api<VideoTaller>(`/api/coach/talleres/${id}/videos/${vid}`, { method: "POST" });
        } catch {
          setTimeout(vuelta, 8000);
          return;
        }
        let antes: VideoTaller["estado"] | undefined;
        setTaller((t) => {
          if (!t) return t;
          antes = t.videos.find((x) => x.id === vid)?.estado;
          return { ...t, videos: t.videos.map((x) => (x.id === vid ? v! : x)) };
        });
        if (v.estado === "listo") {
          siguiendo.current.delete(vid);
          if (antes !== "listo") setLineas((ls) => [...ls, { rol: "nota", texto: `Ya vi «${v!.nombreOriginal}». Pídeme lo que quieras con él.` }]);
        } else if (v.estado === "error") {
          // Si la IA está saturada, se vuelve a intentar sola un par de veces.
          const n = (reintentos.current[vid] ?? 0) + 1;
          reintentos.current[vid] = n;
          if (n <= 3) setTimeout(vuelta, 30_000);
          else siguiendo.current.delete(vid);
        } else {
          setTimeout(vuelta, 3000);
        }
      };
      void vuelta();
    },
    [id],
  );

  useEffect(() => {
    taller?.videos.filter((v) => v.estado === "subido" || v.estado === "procesando").forEach((v) => seguir(v.id));
  }, [taller?.videos, seguir]);

  const reintentarVideo = (vid: string) => {
    reintentos.current[vid] = 0;
    siguiendo.current.delete(vid);
    seguir(vid);
  };

  const subir = async (archivos: File[], leccion: string | null) => {
    for (const [i, archivo] of archivos.entries()) {
      const clave = `${Date.now()}-${i}`;
      const anotar = (cambio: Partial<Subida>) => setSubidas((ss) => ss.map((s) => (s.clave === clave ? { ...s, ...cambio } : s)));
      setSubidas((ss) => [...ss, { clave, nombre: archivo.name, avance: 0 }]);
      const tipo = tipoDeVideo(archivo.name, archivo.type);
      if (!tipo) {
        anotar({ error: "No es un video MP4, WebM o MOV." });
        continue;
      }
      if (archivo.size > MAX_BYTES_VIDEO) {
        anotar({ error: `Pesa más de ${tamañoLegible(MAX_BYTES_VIDEO)}. Expórtalo en menor calidad.` });
        continue;
      }
      const duracion = await medirDuracion(archivo);
      if (duracion && duracion > 2 * 3600) {
        anotar({ error: "Dura más de 2 horas. Súbelo en partes." });
        continue;
      }
      await guardarYa();
      const subida = subirVideo({ base: `/api/coach/talleres/${id}/videos`, enLaNube: "videos/taller" }, archivo, tipo, (f) => anotar({ avance: f }), duracion ?? undefined);
      anotar({ cancelar: subida.cancelar });
      try {
        const v = (await subida.listo) as VideoTaller;
        setSubidas((ss) => ss.filter((s) => s.clave !== clave));
        setTaller((t) => (t ? { ...t, videos: [...t.videos, v] } : t));
        // El primero va a la lección donde le dio «Subir video».
        if (leccion && i === 0) cambiarLeccion(leccion, { video: v.id, inicio: undefined, fin: undefined });
      } catch (e) {
        if (e instanceof SubidaCancelada) setSubidas((ss) => ss.filter((s) => s.clave !== clave));
        else anotar({ error: (e as Error).message });
      }
    }
  };

  const quitarVideo = async (v: VideoTaller) => {
    if (!window.confirm(`¿Quitar «${v.nombreOriginal}»? Las lecciones que lo usan se quedan sin video.`)) return;
    try {
      await guardarYa();
      recibir(await api<TallerCurso>(`/api/coach/talleres/${id}/videos/${v.id}`, { method: "DELETE" }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // ---------------------------------------------------------------- documento

  const subirDocumento = async (archivo: File) => {
    const clave = `doc-${Date.now()}`;
    setSubidas((ss) => [...ss, { clave, nombre: archivo.name, avance: 1 }]);
    try {
      await guardarYa();
      const forma = new FormData();
      forma.append("archivo", archivo);
      const t = await api<TallerCurso>(`/api/coach/talleres/${id}/documento`, { method: "POST", body: forma });
      recibir(t);
      setSubidas((ss) => ss.filter((s) => s.clave !== clave));
      setLineas((ls) => [...ls, { rol: "nota", texto: `Ya tengo «${archivo.name}». Dime cómo quieres el curso o dale «Arma el curso con mi documento».` }]);
    } catch (e) {
      setSubidas((ss) => ss.map((s) => (s.clave === clave ? { ...s, error: (e as Error).message } : s)));
    }
  };

  const quitarDocumento = async () => {
    if (!window.confirm("¿Quitar el documento?")) return;
    try {
      await guardarYa();
      recibir(await api<TallerCurso>(`/api/coach/talleres/${id}/documento`, { method: "DELETE" }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // ---------------------------------------------------------------- terminar

  const crear = async () => {
    setCreando(true);
    setError(null);
    try {
      await guardarYa();
      const r = await api<{ id: string; aviso: string | null }>(`/api/coach/talleres/${id}/crear`, { method: "POST" });
      try {
        if (r.aviso) sessionStorage.setItem(`fc.avisoIA.${r.id}`, r.aviso);
      } catch {
        // sin almacenamiento: el aviso no se muestra
      }
      router.push(`/coach/curso/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
      setCreando(false);
    }
  };

  const descartar = async () => {
    if (!window.confirm("¿Descartar este curso? Se borran sus videos y lo que llevas.")) return;
    pendiente.current = false;
    if (temporizador.current) clearTimeout(temporizador.current);
    try {
      await api(`/api/coach/talleres/${id}`, { method: "DELETE" });
      router.push("/coach/comunidades");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // ---------------------------------------------------------------- alto de los paneles

  // El chat y el curso llenan lo que queda de la pantalla, cada uno con su propio scroll.
  useLayoutEffect(() => {
    const medir = () => {
      const el = raiz.current;
      if (!el) return;
      const arriba = el.getBoundingClientRect().top + window.scrollY;
      el.style.setProperty("--alto-taller", `${Math.max(480, window.innerHeight - arriba - 16)}px`);
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [taller !== null]);

  if (error && !taller) {
    return (
      <div className="pagina-estrecha">
        <h1>No pudimos abrir este curso</h1>
        <p className="texto-suave">{error}</p>
        <Link href="/coach/comunidades" className="boton">
          Volver a tus comunidades
        </Link>
      </div>
    );
  }
  if (!taller || !borrador) return <p className="texto-suave">Cargando…</p>;

  const videos = new Map(taller.videos.map((v, i) => [v.id, { v, num: i + 1 }]));
  const totalPreguntas = borrador.lecciones.reduce((n, l) => n + l.repaso.length, 0);
  const usos = (vid: string) => borrador.lecciones.filter((l) => l.video === vid).length;
  const textoEstado = { guardado: "Todo guardado", "sin-guardar": "Sin guardar…", guardando: "Guardando…", error: "No se pudo guardar" }[estado];

  return (
    <div className="taller-pagina">
      <div className="taller-barra">
        <Link href="/coach/comunidades" className="enlace taller-volver">
          <IconoFlechaIzq width={16} height={16} /> Comunidades y cursos
        </Link>
        <span className="pastilla">
          <IconoComunidad width={14} height={14} /> {MODO[taller.modo]}
        </span>
        <span className="nota taller-guardado" data-error={estado === "error" || undefined} aria-live="polite">
          {textoEstado}
        </span>
        <div className="taller-barra-acciones">
          <button type="button" className="boton boton-fantasma boton-chico taller-descartar" onClick={() => void descartar()}>
            Descartar
          </button>
          <button type="button" className="boton" onClick={() => void crear()} disabled={creando}>
            <IconoCheck width={16} height={16} /> {creando ? "Creando…" : "Crear curso"}
          </button>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="taller-pestanas" role="tablist" aria-label="Qué ver">
        {(["chat", "curso"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={ver === p}
            onClick={() => {
              setVer(p);
              if (p === "curso") setPunto(false);
            }}
          >
            {p === "chat" ? <IconoAsistenteGeneral width={16} height={16} /> : <IconoCurso width={16} height={16} />}
            {p === "chat" ? "Chat" : "Curso"}
            {p === "curso" && punto && <span className="taller-punto" aria-label="con cambios nuevos" />}
          </button>
        ))}
      </div>

      <div className="taller" ref={raiz} data-ver={ver}>
        {/* ------------------------------------------------ chat */}
        <section className="taller-chat" aria-label="Chat con la IA">
          <header className="taller-chat-cabecera">
            <span className="taller-chat-avatar">
              <IconoAsistenteGeneral width={18} height={18} />
            </span>
            <div>
              <p className="taller-chat-nombre">Asistente de cursos</p>
              <p className="nota">{taller.ia ? "Te ayuda a armar el curso. Pídele lo que necesites." : "No está conectada: falta GEMINI_API_KEY en el servidor."}</p>
            </div>
          </header>
          <div className="taller-mensajes" ref={mensajes} aria-live="polite">
            <div className="burbuja burbuja-ia">{SALUDOS[taller.modo]}</div>
            {lineas.map((m, i) => (
              <div key={i} className="taller-linea">
                <div className={`burbuja burbuja-${m.rol}`}>
                  {m.texto}
                  {"reintentar" in m && m.reintentar && (
                    <button type="button" className="enlace taller-reintentar" onClick={() => void mandar(m.reintentar!)}>
                      Intentar de nuevo
                    </button>
                  )}
                </div>
                {"cambios" in m && m.cambios && m.cambios.length > 0 && (
                  <ul className="burbuja-cambios">
                    {m.cambios.map((c, k) => (
                      <li key={k}>
                        <IconoCheck width={13} height={13} />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {pensando && (
              <div className="burbuja burbuja-ia burbuja-espera">
                <span className="taller-puntos" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="nota">Pensando… si arma todo el curso puede tardar un minuto.</span>
              </div>
            )}
          </div>
          <div className="taller-sugerencias">
            {SUGERENCIAS[taller.modo].map((s) => (
              <button key={s} type="button" className="taller-sugerencia" onClick={() => void mandar(s)} disabled={pensando || !taller.ia}>
                {s}
              </button>
            ))}
          </div>
          <form className="taller-escribir" onSubmit={enviar}>
            <label className="sr-only" htmlFor="taller-texto">
              Tu mensaje para la IA
            </label>
            <textarea
              id="taller-texto"
              rows={2}
              maxLength={2000}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void mandar(texto);
                }
              }}
              placeholder="Pídele algo a la IA… (Enter para enviar)"
              disabled={pensando || !taller.ia}
            />
            <button type="submit" className="boton taller-enviar" aria-label="Enviar" disabled={pensando || !taller.ia || !texto.trim()}>
              <IconoEnviar width={18} height={18} />
            </button>
          </form>
        </section>

        {/* ------------------------------------------------ el curso */}
        <section className="taller-lado" ref={lado} aria-label="El curso">
          {subidas.length > 0 && (
            <div className="taller-subidas" aria-live="polite">
              {subidas.map((s) => (
                <div key={s.clave} className="taller-subida" data-error={s.error ? "" : undefined}>
                  <div className="taller-subida-texto">
                    <span className="taller-video-nombre">{s.nombre}</span>
                    <span className="nota">{s.error ?? (s.avance < 1 ? `Subiendo… ${Math.round(s.avance * 100)}%` : "Guardando…")}</span>
                  </div>
                  {!s.error && (
                    <div className="taller-barra-avance">
                      <span style={{ width: `${Math.round(s.avance * 100)}%` }} />
                    </div>
                  )}
                  {(s.error || s.cancelar) && (
                    <button
                      type="button"
                      className="enlace taller-subida-cerrar"
                      onClick={() => {
                        s.cancelar?.();
                        setSubidas((ss) => ss.filter((x) => x.clave !== s.clave));
                      }}
                    >
                      {s.error ? "Cerrar" : "Cancelar"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <section className="tarjeta taller-material">
            <div className="taller-seccion-cabecera">
              <h2>Material</h2>
              <div className="taller-material-botones">
                <button type="button" className="boton boton-secundario boton-chico" onClick={() => ((paraLeccion.current = null), archivoVideos.current?.click())}>
                  <IconoVideo width={16} height={16} /> Agregar videos
                </button>
                <button type="button" className="boton boton-secundario boton-chico" onClick={() => archivoDocumento.current?.click()}>
                  <IconoDocumento width={16} height={16} /> {taller.documento ? "Cambiar documento" : "Subir PDF o Word"}
                </button>
              </div>
            </div>
            {taller.videos.length > 0 && (
              <ul className="taller-videos">
                {taller.videos.map((v, i) => (
                  <li key={v.id} className="taller-video" data-estado={v.estado}>
                    <span className="taller-num">{i + 1}</span>
                    <div className="taller-video-datos">
                      <p className="taller-video-nombre">{v.nombreOriginal}</p>
                      <p className="nota">
                        {v.duracion ? `${reloj(v.duracion)} · ` : ""}
                        {v.estado === "listo" ? (
                          <span className="taller-estado-listo">
                            <IconoCheck width={12} height={12} /> La IA ya lo vio
                          </span>
                        ) : v.estado === "error" ? (
                          <span className="taller-estado-error">No se pudo ver</span>
                        ) : (
                          <span className="taller-estado-viendo">
                            <span className="taller-puntos" aria-hidden="true">
                              <span />
                              <span />
                              <span />
                            </span>
                            La IA lo está viendo…
                          </span>
                        )}
                        {" · "}
                        {usos(v.id) ? `en ${usos(v.id)} ${usos(v.id) === 1 ? "lección" : "lecciones"}` : "sin lección"}
                      </p>
                      {v.estado === "error" && v.error && <p className="nota taller-estado-error">{v.error}</p>}
                    </div>
                    <div className="taller-video-acciones">
                      {v.estado === "error" && (
                        <button type="button" className="boton boton-secundario boton-chico" onClick={() => reintentarVideo(v.id)}>
                          <IconoReintentar width={14} height={14} /> Intentar de nuevo
                        </button>
                      )}
                      <button type="button" className="boton-icono boton-icono-chico" onClick={() => void quitarVideo(v)} aria-label={`Quitar ${v.nombreOriginal}`}>
                        <IconoBorrar width={16} height={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {taller.documento && (
              <div className="taller-video">
                <span className="taller-num">
                  <IconoDocumento width={16} height={16} />
                </span>
                <div className="taller-video-datos">
                  <p className="taller-video-nombre">{taller.documento.nombre}</p>
                  <p className="nota">
                    {taller.documento.tipo === "pdf" ? "PDF" : `${taller.documento.palabras ?? 0} palabras`} · la IA lo lee cada vez que le escribes
                  </p>
                </div>
                <button type="button" className="boton-icono boton-icono-chico" onClick={() => void quitarDocumento()} aria-label="Quitar el documento">
                  <IconoBorrar width={16} height={16} />
                </button>
              </div>
            )}
            {taller.videos.length === 0 && !taller.documento && (
              <button
                type="button"
                className="taller-soltar"
                onClick={() => (taller.modo === "documento" ? archivoDocumento.current?.click() : ((paraLeccion.current = null), archivoVideos.current?.click()))}
              >
                <IconoSubir width={26} height={26} />
                {taller.modo === "documento" ? (
                  <>
                    <strong>Sube tu PDF o Word</strong>
                    <span className="nota">La IA lo lee y arma el curso contigo. Hasta 4 MB.</span>
                  </>
                ) : taller.modo === "video" ? (
                  <>
                    <strong>Sube tus videos</strong>
                    <span className="nota">Uno o varios a la vez: MP4, WebM o MOV, hasta {tamañoLegible(MAX_BYTES_VIDEO)} y 2 horas cada uno.</span>
                  </>
                ) : (
                  <>
                    <strong>Sube tus videos aquí o en cada lección</strong>
                    <span className="nota">Opcional: también puedes armar lecciones solo de texto.</span>
                  </>
                )}
              </button>
            )}
          </section>

          <section className="tarjeta taller-datos">
            <label className="sr-only" htmlFor="t-titulo">
              Título del curso
            </label>
            <input id="t-titulo" className="taller-titulo" value={borrador.titulo} maxLength={120} placeholder="Título del curso" onChange={(e) => cambiar((b) => ({ ...b, titulo: e.target.value }))} />
            <label className="campo">
              <span className="sr-only">Subtítulo</span>
              <input value={borrador.subtitulo} maxLength={240} placeholder="Subtítulo: para quién es y qué logra" onChange={(e) => cambiar((b) => ({ ...b, subtitulo: e.target.value }))} />
            </label>
            <details className="taller-mas">
              <summary>Más datos del curso</summary>
              <div className="taller-campos">
                <label className="campo">
                  <span>Lo que aprenderá (una idea por renglón)</span>
                  <textarea rows={4} value={borrador.aprenderas.join("\n")} onChange={(e) => cambiar((b) => ({ ...b, aprenderas: e.target.value.split("\n") }))} />
                </label>
                <label className="campo">
                  <span>Requisitos</span>
                  <input value={borrador.requisitos} maxLength={300} placeholder="Ninguno." onChange={(e) => cambiar((b) => ({ ...b, requisitos: e.target.value }))} />
                </label>
                <label className="campo">
                  <span>Preguntas sugeridas para el asistente (una por renglón)</span>
                  <textarea
                    rows={3}
                    value={borrador.preguntas_sugeridas.join("\n")}
                    onChange={(e) => cambiar((b) => ({ ...b, preguntas_sugeridas: e.target.value.split("\n") }))}
                  />
                </label>
              </div>
            </details>
          </section>

          <section className="taller-lecciones" aria-labelledby="t-lecciones">
            <h2 id="t-lecciones" className="taller-lecciones-titulo">
              Lecciones{" "}
              <span className="nota">
                · {borrador.lecciones.length} · {totalPreguntas} {totalPreguntas === 1 ? "pregunta" : "preguntas"} de repaso
              </span>
            </h2>
            {borrador.lecciones.length === 0 && <p className="tarjeta texto-suave">Todavía no hay lecciones. Agrégalas tú o pídele a la IA que las arme con tu material.</p>}
            {borrador.lecciones.map((l, i) => {
              const v = l.video ? videos.get(l.video) : undefined;
              const minutos = minutosDe(l, v?.v);
              const nuevoModulo = l.modulo && l.modulo !== borrador.lecciones[i - 1]?.modulo;
              return (
                <div key={l.id} className="taller-leccion-bloque">
                  {nuevoModulo && <p className="taller-modulo">{l.modulo}</p>}
                  <details
                    id={`leccion-${l.id}`}
                    className="taller-leccion"
                    open={abiertas.has(l.id)}
                    onToggle={(e) => {
                      const abierta = (e.currentTarget as HTMLDetailsElement).open;
                      setAbiertas((s) => {
                        if (s.has(l.id) === abierta) return s;
                        const n = new Set(s);
                        if (abierta) n.add(l.id);
                        else n.delete(l.id);
                        return n;
                      });
                    }}
                  >
                    <summary>
                      <span className="taller-leccion-num">{i + 1}</span>
                      <span className="taller-leccion-resumen">
                        <span className="taller-leccion-titulo">{l.titulo || "Lección sin título"}</span>
                        <span className="nota">
                          {v ? (
                            <>
                              <IconoVideo width={12} height={12} /> Video {v.num}
                              {(l.inicio !== undefined || l.fin !== undefined) && ` · ${reloj(l.inicio ?? 0)}–${l.fin !== undefined ? reloj(l.fin) : "final"}`}
                            </>
                          ) : (
                            <>
                              <IconoDocumento width={12} height={12} /> Texto
                            </>
                          )}
                          {minutos ? ` · ${minutos} min` : ""} · {l.repaso.length} {l.repaso.length === 1 ? "pregunta" : "preguntas"}
                          {!l.contenido && <span className="taller-falta"> · sin apuntes</span>}
                        </span>
                      </span>
                      <IconoDesplegar width={16} height={16} className="taller-flecha" />
                    </summary>

                    <div className="taller-leccion-cuerpo">
                      <div className="taller-fila">
                        <label className="campo taller-crece">
                          <span>Título</span>
                          <input value={l.titulo} maxLength={140} placeholder={`Lección ${i + 1}`} onChange={(e) => cambiarLeccion(l.id, { titulo: e.target.value })} />
                        </label>
                        <label className="campo taller-crece">
                          <span>Módulo</span>
                          <input value={l.modulo} maxLength={120} placeholder="Opcional" onChange={(e) => cambiarLeccion(l.id, { modulo: e.target.value })} />
                        </label>
                      </div>

                      <div className="taller-video-leccion">
                        <div className="taller-fila">
                          <label className="campo taller-crece">
                            <span>Video</span>
                            <select value={l.video ?? ""} onChange={(e) => cambiarLeccion(l.id, { video: e.target.value || undefined, inicio: undefined, fin: undefined })}>
                              <option value="">Sin video (lección de texto)</option>
                              {taller.videos.map((x, k) => (
                                <option key={x.id} value={x.id}>
                                  Video {k + 1} · {x.nombreOriginal}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            className="boton boton-secundario taller-subir-aqui"
                            onClick={() => {
                              paraLeccion.current = l.id;
                              archivoVideos.current?.click();
                            }}
                          >
                            <IconoSubir width={16} height={16} /> Subir video
                          </button>
                        </div>
                        {v && (
                          <>
                            <div className="taller-fila">
                              <label className="campo">
                                <span>Empieza en</span>
                                <input
                                  key={`i-${l.inicio ?? ""}`}
                                  className="taller-tiempo"
                                  defaultValue={l.inicio !== undefined ? reloj(l.inicio) : ""}
                                  placeholder="0:00"
                                  inputMode="numeric"
                                  onBlur={(e) => cambiarTramo(l, "inicio", e.target.value)}
                                />
                              </label>
                              <label className="campo">
                                <span>Termina en</span>
                                <input
                                  key={`f-${l.fin ?? ""}`}
                                  className="taller-tiempo"
                                  defaultValue={l.fin !== undefined ? reloj(l.fin) : ""}
                                  placeholder={v.v.duracion ? reloj(v.v.duracion) : "final"}
                                  inputMode="numeric"
                                  onBlur={(e) => cambiarTramo(l, "fin", e.target.value)}
                                />
                              </label>
                              <p className="nota taller-crece">Vacío = el video completo{v.v.duracion ? ` (${reloj(v.v.duracion)})` : ""}.</p>
                            </div>
                            {errorTramo[l.id] && (
                              <p className="nota taller-estado-error" role="alert">
                                {errorTramo[l.id]}
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      <label className="campo">
                        <span>Descripción (una línea: qué logra el alumno)</span>
                        <input value={l.resumen} maxLength={300} onChange={(e) => cambiarLeccion(l.id, { resumen: e.target.value })} />
                      </label>
                      <label className="campo">
                        <span>Apuntes de la lección (Markdown)</span>
                        <textarea rows={l.contenido ? 8 : 3} value={l.contenido} onChange={(e) => cambiarLeccion(l.id, { contenido: e.target.value })} />
                      </label>
                      <div className="taller-fila">
                        <label className="campo taller-crece">
                          <span>Preguntas sugeridas para el asistente (una por renglón)</span>
                          <textarea rows={2} value={l.preguntas_sugeridas.join("\n")} onChange={(e) => cambiarLeccion(l.id, { preguntas_sugeridas: e.target.value.split("\n") })} />
                        </label>
                        <label className="campo">
                          <span>Minutos</span>
                          <input
                            className="taller-tiempo"
                            type="number"
                            min={1}
                            max={240}
                            value={l.duracion_min ?? ""}
                            placeholder={String(minutos ?? 5)}
                            onChange={(e) => cambiarLeccion(l.id, { duracion_min: e.target.value ? Number(e.target.value) : undefined })}
                          />
                        </label>
                      </div>
                      <div>
                        <p className="taller-subtitulo">Preguntas de repaso</p>
                        <EditorPreguntas
                          preguntas={l.repaso}
                          alCambiar={(repaso) => cambiarLeccion(l.id, { repaso })}
                          vacio="Sin preguntas todavía. Pídeselas a la IA o agrégalas tú."
                          maximo={10}
                        />
                      </div>
                    </div>
                    <div className="taller-leccion-acciones">
                      <button type="button" className="boton boton-fantasma boton-chico" onClick={() => mover(l.id, -1)} disabled={i === 0}>
                        <IconoArriba width={14} height={14} /> Subir
                      </button>
                      <button type="button" className="boton boton-fantasma boton-chico" onClick={() => mover(l.id, 1)} disabled={i === borrador.lecciones.length - 1}>
                        <IconoAbajo width={14} height={14} /> Bajar
                      </button>
                      <button type="button" className="boton boton-fantasma boton-chico" onClick={() => agregarLeccion(l.id)}>
                        <IconoMas width={14} height={14} /> Lección debajo
                      </button>
                      <button type="button" className="boton boton-fantasma boton-chico taller-quitar" onClick={() => quitarLeccion(l, i + 1)}>
                        <IconoBorrar width={14} height={14} /> Quitar
                      </button>
                    </div>
                  </details>
                </div>
              );
            })}
            {borrador.lecciones.length < 30 && (
              <button type="button" className="boton boton-secundario taller-agregar" onClick={() => agregarLeccion()}>
                <IconoMas width={16} height={16} /> Agregar lección
              </button>
            )}
          </section>

          <details className="tarjeta taller-examen">
            <summary>
              <span className="taller-examen-titulo">Examen final</span>
              <span className="nota">
                {borrador.examen.length} {borrador.examen.length === 1 ? "pregunta" : "preguntas"}
                {borrador.examen.length === 0 && " · si lo dejas vacío, el curso no tendrá examen"}
              </span>
              <IconoDesplegar width={16} height={16} className="taller-flecha" />
            </summary>
            <EditorPreguntas
              preguntas={borrador.examen}
              alCambiar={(examen) => cambiar((b) => ({ ...b, examen }))}
              lecciones={borrador.lecciones.map((l) => ({ id: l.id, titulo: l.titulo }))}
              vacio="Pídele a la IA un examen («hazme un examen de 10 preguntas») o agrega las preguntas tú."
            />
          </details>
        </section>
      </div>

      <input
        ref={archivoVideos}
        type="file"
        hidden
        multiple
        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
        onChange={(e) => {
          const archivos = Array.from(e.target.files ?? []);
          e.target.value = "";
          const leccion = paraLeccion.current;
          paraLeccion.current = null;
          void subir(leccion ? archivos.slice(0, 1) : archivos, leccion);
        }}
      />
      <input
        ref={archivoDocumento}
        type="file"
        hidden
        accept="application/pdf,.pdf,.docx,.txt,.md"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          e.target.value = "";
          if (archivo) void subirDocumento(archivo);
        }}
      />
    </div>
  );
}
