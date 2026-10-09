"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { api, guardarLocal, guardarSesion, leerLocal, leerSesion } from "@/lib/cliente";
import type {
  Categoria,
  DatosCurso,
  EstadoInscripcion,
  EstadoPlataforma,
  Leccion,
  MetodoPago,
  Modulo,
  Pago,
  ResumenCurso,
  Rol,
} from "@/lib/tipos";

export interface Usuario {
  nombre: string;
  rol: Rol;
  /** Fecha en que entró por primera vez (se muestra en el perfil). */
  desde?: string;
  /** Descripción corta que la persona escribe en su perfil. */
  bio?: string;
}

export interface Membresia {
  metodo: MetodoPago;
  desde: string;
}

export interface MensajeChat {
  role: "user" | "assistant";
  content: string;
  estado?: "escribiendo" | "listo" | "error" | "detenido";
  modo?: "ia" | "demo";
  leccion?: string | null;
}

export interface Borrador {
  categoria: Categoria;
  titulo: string;
  cuerpo: string;
}

interface ContextoApp {
  listo: boolean;
  usuario: Usuario | null;
  guardarUsuario: (u: Usuario) => void;
  /** Cierra la sesión y borra lo de esa persona en este navegador. */
  cerrarSesion: () => void;
  pidiendoUsuario: boolean;
  setPidiendoUsuario: (v: boolean) => void;
  /** El curso que la persona está tomando (o revisando, si es la coach). */
  datos: DatosCurso | null;
  errorDatos: string | null;
  recargarCurso: () => Promise<void>;
  /** Todos los cursos de la comunidad, en ficha corta. */
  cursos: ResumenCurso[];
  cursoId: string;
  /** Cambia el curso activo: las páginas del curso, el examen y el asistente pasan a ese curso. */
  cambiarCurso: (id: string) => void;
  /** Ya se sabe si el alumno está unido a la comunidad y a qué cursos (la coach siempre lo está). */
  inscripcionLista: boolean;
  enComunidad: boolean;
  inscritoEn: (curso: string) => boolean;
  /** Paso 1: unirse a la comunidad (gratis). */
  unirmeAComunidad: () => Promise<void>;
  /** Paso 2: inscribirse a un curso de la comunidad (gratis; lo de pago sigue con la membresía). */
  inscribirmeACurso: (curso: string) => Promise<void>;
  estado: EstadoPlataforma | null;
  lecciones: (Leccion & { modulo: Modulo })[];
  membresia: Membresia | null;
  activarMembresia: (m: Membresia | null) => void;
  /** Ficha OXXO o SPEI generada y todavía sin pagar: sobrevive a recargas. */
  pagoPendiente: Pago | null;
  guardarPagoPendiente: (p: Pago | null) => void;
  tieneAcceso: boolean;
  completadas: string[];
  alternarCompletada: (id: string) => void;
  /** Lecciones cuyo video ya vio completo (sin adelantarlo). */
  vistos: string[];
  marcarVisto: (id: string) => void;
  /** Lecciones cuyo repaso ya contestó. */
  repasados: string[];
  marcarRepasado: (id: string) => void;
  chat: MensajeChat[];
  setChat: Dispatch<SetStateAction<MensajeChat[]>>;
  /** Conversación con el asistente general (no usa los cursos). */
  chatGeneral: MensajeChat[];
  setChatGeneral: Dispatch<SetStateAction<MensajeChat[]>>;
  leccionContexto: string | null;
  setLeccionContexto: (id: string | null) => void;
  preguntaPendiente: string | null;
  setPreguntaPendiente: (p: string | null) => void;
  borrador: Borrador | null;
  setBorrador: (b: Borrador | null) => void;
  /** Lección que llevó a la alumna a pagar: al activar la membresía se vuelve ahí. */
  leccionDeseada: string | null;
  guardarLeccionDeseada: (id: string | null) => void;
}

const Contexto = createContext<ContextoApp | null>(null);

const CLAVES = {
  usuario: "fc.usuario",
  membresia: "fc.membresia",
  completadas: "fc.completadas",
  pagoPendiente: "fc.pagoPendiente",
  leccionDeseada: "fc.leccionDeseada",
  chat: "fc.chat",
  chatGeneral: "fc.chatGeneral",
  curso: "fc.curso",
  vistos: "fc.vistos",
  repasados: "fc.repasados",
};

const CURSO_PRINCIPAL = "finanzas-negocio";

export function ProveedorApp({ children }: { children: ReactNode }) {
  const [listo, setListo] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [pidiendoUsuario, setPidiendoUsuario] = useState(false);
  const [datos, setDatos] = useState<DatosCurso | null>(null);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);
  const [cursos, setCursos] = useState<ResumenCurso[]>([]);
  const [cursoId, setCursoId] = useState(CURSO_PRINCIPAL);
  const [inscripcion, setInscripcion] = useState<EstadoInscripcion | null>(null);
  const [estado, setEstado] = useState<EstadoPlataforma | null>(null);
  const [membresia, setMembresia] = useState<Membresia | null>(null);
  const [pagoPendiente, setPagoPendiente] = useState<Pago | null>(null);
  const [completadas, setCompletadas] = useState<string[]>([]);
  const [vistos, setVistos] = useState<string[]>([]);
  const [repasados, setRepasados] = useState<string[]>([]);
  const [chat, setChat] = useState<MensajeChat[]>([]);
  const [chatGeneral, setChatGeneral] = useState<MensajeChat[]>([]);
  const [leccionContexto, setLeccionContexto] = useState<string | null>(null);
  const [preguntaPendiente, setPreguntaPendiente] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [leccionDeseada, setLeccionDeseada] = useState<string | null>(null);

  const recargarCurso = useCallback(async () => {
    try {
      setDatos(await api<DatosCurso>(`/api/curso?curso=${encodeURIComponent(cursoId)}`));
      setErrorDatos(null);
    } catch (e) {
      setErrorDatos((e as Error).message);
    }
  }, [cursoId]);

  // Al cambiar de curso se carga el nuevo; la conversación con el asistente
  // del curso empieza de cero porque responde con otras lecciones.
  const cambiarCurso = useCallback(
    (id: string) => {
      if (id === cursoId) return;
      setDatos(null);
      setCursoId(id);
      guardarLocal(CLAVES.curso, id);
      setChat([]);
      setLeccionContexto(null);
    },
    [cursoId],
  );

  useEffect(() => {
    if (listo) void recargarCurso();
  }, [listo, recargarCurso]);

  useEffect(() => {
    const guardadoUsuario = leerLocal<Usuario>(CLAVES.usuario);
    // Sesiones creadas antes del perfil no traen fecha de alta: se fija hoy.
    if (guardadoUsuario && !guardadoUsuario.desde) {
      guardadoUsuario.desde = new Date().toISOString();
      guardarLocal(CLAVES.usuario, guardadoUsuario);
    }
    setUsuario(guardadoUsuario);
    setMembresia(leerLocal<Membresia>(CLAVES.membresia));
    const pendiente = leerLocal<Pago>(CLAVES.pagoPendiente);
    // Una ficha vencida ya no sirve para pagar: se descarta.
    if (pendiente && (!pendiente.venceEn || Date.parse(pendiente.venceEn) > Date.now())) {
      setPagoPendiente(pendiente);
    } else if (pendiente) {
      guardarLocal(CLAVES.pagoPendiente, null);
    }
    setCompletadas(leerLocal<string[]>(CLAVES.completadas) ?? []);
    setVistos(leerLocal<string[]>(CLAVES.vistos) ?? []);
    setRepasados(leerLocal<string[]>(CLAVES.repasados) ?? []);
    setLeccionDeseada(leerLocal<string>(CLAVES.leccionDeseada));
    // La conversación sobrevive a una recarga o a cambiar de app. Una respuesta
    // que se estaba escribiendo cuando se cerró la página queda como detenida.
    const restaurar = (clave: string) =>
      (leerSesion<MensajeChat[]>(clave) ?? []).map((m) =>
        m.estado === "escribiendo" ? { ...m, estado: "detenido" as const } : m,
      );
    setChat(restaurar(CLAVES.chat));
    setChatGeneral(restaurar(CLAVES.chatGeneral));
    setCursoId(leerLocal<string>(CLAVES.curso) ?? CURSO_PRINCIPAL);
    setListo(true);
    api<ResumenCurso[]>("/api/cursos")
      .then(setCursos)
      .catch(() => setCursos([]));
    api<EstadoPlataforma>("/api/estado")
      .then(setEstado)
      .catch(() => setEstado({ iaActiva: false, modelo: null }));
  }, []);

  const guardarUsuario = useCallback((u: Usuario) => {
    const completo = { ...u, desde: u.desde ?? new Date().toISOString() };
    setUsuario(completo);
    guardarLocal(CLAVES.usuario, completo);
    setPidiendoUsuario(false);
  }, []);

  // En el prototipo todo vive en el navegador: al salir se borra lo de esa
  // persona para que quien entre después no herede su avance ni su membresía.
  const cerrarSesion = useCallback(() => {
    for (const clave of [
      CLAVES.usuario,
      CLAVES.membresia,
      CLAVES.completadas,
      CLAVES.vistos,
      CLAVES.repasados,
      CLAVES.pagoPendiente,
      CLAVES.leccionDeseada,
    ]) {
      guardarLocal(clave, null);
    }
    guardarSesion(CLAVES.chat, null);
    guardarSesion(CLAVES.chatGeneral, null);
    setUsuario(null);
    setMembresia(null);
    setCompletadas([]);
    setVistos([]);
    setRepasados([]);
    setPagoPendiente(null);
    setLeccionDeseada(null);
    setChat([]);
    setChatGeneral([]);
    setLeccionContexto(null);
    setPreguntaPendiente(null);
    setBorrador(null);
    setPidiendoUsuario(false);
  }, []);

  // Inscripción del alumno (comunidad y cursos), guardada en el servidor.
  useEffect(() => {
    setInscripcion(null);
    if (!listo || usuario?.rol !== "alumno") return;
    let vigente = true;
    api<EstadoInscripcion>(`/api/inscripcion?autor=${encodeURIComponent(usuario.nombre)}`)
      .then((e) => vigente && setInscripcion(e))
      .catch(() => vigente && setInscripcion({ comunidad: false, cursos: [] }));
    return () => {
      vigente = false;
    };
  }, [listo, usuario?.nombre, usuario?.rol]);

  const inscribir = useCallback(
    async (accion: "comunidad" | "curso", curso?: string) => {
      if (!usuario) return;
      setInscripcion(
        await api<EstadoInscripcion>("/api/inscripcion", {
          method: "POST",
          json: { autor: usuario.nombre, accion, curso },
        }),
      );
    },
    [usuario],
  );
  const unirmeAComunidad = useCallback(() => inscribir("comunidad"), [inscribir]);
  const inscribirmeACurso = useCallback((curso: string) => inscribir("curso", curso), [inscribir]);

  const activarMembresia = useCallback(
    (m: Membresia | null) => {
      setMembresia(m);
      guardarLocal(CLAVES.membresia, m);
      // Quien paga la membresía queda unido a la comunidad.
      if (m && usuario?.rol === "alumno" && inscripcion && !inscripcion.comunidad) {
        void inscribir("comunidad").catch(() => undefined);
      }
    },
    [usuario?.rol, inscripcion, inscribir],
  );

  const guardarPagoPendiente = useCallback((p: Pago | null) => {
    setPagoPendiente(p);
    guardarLocal(CLAVES.pagoPendiente, p);
  }, []);

  useEffect(() => {
    if (listo) guardarSesion(CLAVES.chat, chat.length ? chat.slice(-30) : null);
  }, [chat, listo]);

  useEffect(() => {
    if (listo) guardarSesion(CLAVES.chatGeneral, chatGeneral.length ? chatGeneral.slice(-30) : null);
  }, [chatGeneral, listo]);

  const guardarLeccionDeseada = useCallback((id: string | null) => {
    setLeccionDeseada(id);
    guardarLocal(CLAVES.leccionDeseada, id);
  }, []);

  // El avance también se guarda en el servidor: la coach lo ve en su matriz,
  // el examen final lo revisa y el alumno lo recupera al volver a entrar.
  const enviarProgreso = useCallback((nombre: string, lista: string[]) => {
    void api("/api/progreso", { method: "POST", json: { autor: nombre, completadas: lista } }).catch(() => {
      // sin conexión: el navegador lo conserva y se reenvía en el siguiente cambio
    });
  }, []);

  useEffect(() => {
    if (!listo || usuario?.rol !== "alumno") return;
    const nombre = usuario.nombre;
    let vigente = true;
    api<{ completadas: string[] }>(`/api/progreso?autor=${encodeURIComponent(nombre)}`)
      .then(({ completadas: remotas }) => {
        if (!vigente) return;
        setCompletadas((locales) => [...new Set([...locales, ...remotas])]);
        const union = [...new Set([...(leerLocal<string[]>(CLAVES.completadas) ?? []), ...remotas])];
        guardarLocal(CLAVES.completadas, union);
        if (union.length !== remotas.length) enviarProgreso(nombre, union);
      })
      .catch(() => {
        // sin conexión: se queda con lo que recuerda el navegador
      });
    return () => {
      vigente = false;
    };
  }, [listo, usuario?.nombre, usuario?.rol, enviarProgreso]);

  const alternarCompletada = useCallback(
    (id: string) => {
      const nuevo = completadas.includes(id) ? completadas.filter((x) => x !== id) : [...completadas, id];
      setCompletadas(nuevo);
      guardarLocal(CLAVES.completadas, nuevo);
      if (usuario?.rol === "alumno") enviarProgreso(usuario.nombre, nuevo);
    },
    [completadas, usuario, enviarProgreso],
  );

  // Pasos de cada lección para el alumno: ver el video completo y contestar
  // el repaso. Se recuerdan en el navegador, como las lecciones completadas.
  const marcarVisto = useCallback((id: string) => {
    setVistos((lista) => {
      if (lista.includes(id)) return lista;
      const nueva = [...lista, id];
      guardarLocal(CLAVES.vistos, nueva);
      return nueva;
    });
  }, []);

  const marcarRepasado = useCallback((id: string) => {
    setRepasados((lista) => {
      if (lista.includes(id)) return lista;
      const nueva = [...lista, id];
      guardarLocal(CLAVES.repasados, nueva);
      return nueva;
    });
  }, []);

  const lecciones = useMemo(
    () =>
      datos?.curso.modulos.flatMap((modulo) => modulo.lecciones.map((l) => ({ ...l, modulo }))) ?? [],
    [datos],
  );

  const esCoach = usuario?.rol === "coach";
  const inscritoEn = useCallback(
    (curso: string) => esCoach || Boolean(inscripcion?.cursos.includes(curso)),
    [esCoach, inscripcion],
  );

  const valor: ContextoApp = {
    listo,
    usuario,
    guardarUsuario,
    cerrarSesion,
    pidiendoUsuario: pidiendoUsuario || (listo && !usuario),
    setPidiendoUsuario,
    datos,
    errorDatos,
    recargarCurso,
    cursos,
    cursoId,
    cambiarCurso,
    inscripcionLista: !usuario || esCoach || inscripcion !== null,
    enComunidad: esCoach || Boolean(inscripcion?.comunidad),
    inscritoEn,
    unirmeAComunidad,
    inscribirmeACurso,
    estado,
    lecciones,
    membresia,
    activarMembresia,
    pagoPendiente,
    guardarPagoPendiente,
    tieneAcceso: usuario?.rol === "coach" || membresia !== null,
    completadas,
    alternarCompletada,
    vistos,
    marcarVisto,
    repasados,
    marcarRepasado,
    chat,
    setChat,
    chatGeneral,
    setChatGeneral,
    leccionContexto,
    setLeccionContexto,
    preguntaPendiente,
    setPreguntaPendiente,
    borrador,
    setBorrador,
    leccionDeseada,
    guardarLeccionDeseada,
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useApp(): ContextoApp {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useApp debe usarse dentro de <ProveedorApp>");
  return ctx;
}
