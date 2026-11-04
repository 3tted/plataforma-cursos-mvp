"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { api, guardarLocal, guardarSesion, leerLocal, leerSesion } from "@/lib/cliente";
import { COMUNIDADES, type ComunidadDirectorio } from "@/lib/comunidades";
import { fotoDePortada, type Foto } from "@/lib/portadas";
import type {
  Categoria,
  CuentaPublica,
  DatosCurso,
  EstadoInscripcion,
  EstadoPlataforma,
  Leccion,
  MarcaEmpresa,
  MetodoPago,
  Modulo,
  Pago,
  ResumenCurso,
  Rol,
} from "@/lib/tipos";

/** La cuenta con sesión abierta (la da el servidor; ver /api/sesion). */
export type Usuario = CuentaPublica;

/** Cómo se puede entrar en este servidor. */
export interface OpcionesEntrada {
  google: boolean;
  /** Cuentas de demostración y su contraseña (solo si es la del proyecto). */
  demo: { contrasena: string; cuentas: { nombre: string; correo: string; detalle: string }[] } | null;
}

// Lo que pasó al volver de Google (?google=…).
const AVISOS_GOOGLE: Record<string, string> = {
  cancelado: "Cancelaste la entrada con Google.",
  fallo: "No pudimos entrar con Google. Inténtalo de nuevo.",
  invitacion: "Entraste, pero la invitación ya no sirve: ya se usó o venció. Pide una nueva.",
  "sin-configurar": "La entrada con Google todavía no está configurada en este servidor. Entra con tu correo.",
};

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
  /** Pone la cuenta con sesión: al entrar o cuando cambia algo de su perfil. */
  guardarUsuario: (u: Usuario) => void;
  /** Cierra la sesión y borra lo de esa persona en este navegador. */
  cerrarSesion: () => void;
  opcionesEntrada: OpcionesEntrada | null;
  /** Aviso para la pantalla de entrada (por ejemplo, al volver de Google). */
  avisoEntrada: string | null;
  /** La marca de la página de una empresa (/e/<id>), que la pone esa página. */
  marcaPagina: MarcaEmpresa | null;
  fijarMarcaPagina: (m: MarcaEmpresa | null) => void;
  pidiendoUsuario: boolean;
  setPidiendoUsuario: (v: boolean) => void;
  /** Abre la pantalla de entrada; con rol, ya viene elegido (por ejemplo, "Soy coach"). */
  pedirEntrada: (rol?: Rol) => void;
  rolSugerido: Rol | null;
  /** El curso que la persona está tomando (o revisando, si es la coach). */
  datos: DatosCurso | null;
  errorDatos: string | null;
  recargarCurso: () => Promise<void>;
  /** Todos los cursos de la plataforma, en ficha corta (cada uno dice su comunidad). */
  cursos: ResumenCurso[];
  /** Los cursos de la comunidad que se está viendo. */
  cursosComunidad: ResumenCurso[];
  /** Directorio: las comunidades del proyecto y las que crearon las coaches. */
  comunidades: ComunidadDirectorio[];
  /** El tema de una comunidad (para su portada ilustrada). */
  temaDe: (comunidad: string) => string;
  /** La foto de portada de un curso o una comunidad: la que subió la coach o la del proyecto. */
  fotoDe: (clave: string) => Foto | null;
  /** Vuelve a pedir cursos y comunidades (por ejemplo, al publicar un curso). */
  recargarCatalogo: () => Promise<void>;
  /** Aviso breve que aparece abajo de la pantalla (por ejemplo, al inscribirse). */
  aviso: { texto: string; id: number } | null;
  avisar: (texto: string | null) => void;
  cursoId: string;
  /** Cambia el curso activo: las páginas del curso, el examen y el asistente pasan a ese curso. */
  cambiarCurso: (id: string) => void;
  /** La comunidad que se está viendo: la del curso activo. */
  comunidadId: string;
  /** Pasa a otra comunidad (a su curso inscrito o, si no, al primero). */
  cambiarComunidad: (id: string) => void;
  /** Ya se sabe si el alumno está unido a la comunidad y a qué cursos (la coach siempre lo está). */
  inscripcionLista: boolean;
  /** Unido a la comunidad que se está viendo. */
  enComunidad: boolean;
  /** Coach de la empresa dueña de la comunidad que se está viendo: la edita y la modera. */
  coachAqui: boolean;
  /** ¿Es coach de la empresa dueña de esa comunidad? */
  esCoachDe: (comunidad: string) => boolean;
  enLaComunidad: (comunidad: string) => boolean;
  inscritoEn: (curso: string) => boolean;
  /** Paso 1: unirse a una comunidad (gratis); sin id, a la que se está viendo. */
  unirmeAComunidad: (comunidad?: string) => Promise<void>;
  /** Paso 2: inscribirse a un curso de la comunidad (gratis; lo de pago sigue con la membresía). */
  inscribirmeACurso: (curso: string) => Promise<void>;
  estado: EstadoPlataforma | null;
  lecciones: (Leccion & { modulo: Modulo })[];
  /** Membresía de la comunidad que se está viendo (cada comunidad cobra la suya). */
  membresia: Membresia | null;
  /** Activa o quita la membresía de la comunidad que se está viendo. */
  activarMembresia: (m: Membresia | null) => void;
  membresiaEn: (comunidad: string) => Membresia | null;
  /** Ficha OXXO o SPEI generada y todavía sin pagar: sobrevive a recargas. */
  pagoPendiente: Pago | null;
  guardarPagoPendiente: (p: Pago | null) => void;
  tieneAcceso: boolean;
  completadas: string[];
  /** Cuándo completó cada lección (ISO), para las que se abren al día siguiente. */
  fechasCompletadas: Record<string, string>;
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
  /** De quién es lo guardado en este navegador (avance, membresías): si entra otra cuenta, se borra. */
  usuario: "fc.usuario",
  membresia: "fc.membresia",
  completadas: "fc.completadas",
  fechasCompletadas: "fc.fechasCompletadas",
  pagoPendiente: "fc.pagoPendiente",
  leccionDeseada: "fc.leccionDeseada",
  chat: "fc.chat",
  chatGeneral: "fc.chatGeneral",
  curso: "fc.curso",
  vistos: "fc.vistos",
  repasados: "fc.repasados",
};

/** Lo que este navegador guarda por persona (se borra si entra otra). */
const CLAVES_PERSONALES = ["membresia", "completadas", "fechasCompletadas", "vistos", "repasados", "pagoPendiente", "leccionDeseada"] as const;

/**
 * Anota de quién es lo guardado en el navegador. Si entra otra cuenta (o
 * ninguna) después de alguien, borra lo de la anterior y devuelve true.
 */
function quedarseCon(cuenta: Usuario | null): boolean {
  const antes = leerLocal<{ nombre?: string }>(CLAVES.usuario)?.nombre ?? null;
  const ahora = cuenta?.nombre ?? null;
  if (antes === ahora) return false;
  if (antes !== null) {
    for (const clave of CLAVES_PERSONALES) guardarLocal(CLAVES[clave], null);
    guardarSesion(CLAVES.chat, null);
    guardarSesion(CLAVES.chatGeneral, null);
  }
  guardarLocal(CLAVES.usuario, ahora ? { nombre: ahora } : null);
  return antes !== null;
}

const CURSO_PRINCIPAL = "finanzas-negocio";
const COMUNIDAD_PRINCIPAL = "finanzas-claras";

export function ProveedorApp({ children }: { children: ReactNode }) {
  const [listo, setListo] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [opcionesEntrada, setOpcionesEntrada] = useState<OpcionesEntrada | null>(null);
  const [avisoEntrada, setAvisoEntrada] = useState<string | null>(null);
  const [marcaPagina, fijarMarcaPagina] = useState<MarcaEmpresa | null>(null);
  const [pidiendoUsuario, setPidiendoUsuario] = useState(false);
  const [rolSugerido, setRolSugerido] = useState<Rol | null>(null);
  const pedirEntrada = useCallback((rol?: Rol) => {
    setRolSugerido(rol ?? null);
    setPidiendoUsuario(true);
  }, []);
  const [datos, setDatos] = useState<DatosCurso | null>(null);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);
  const [cursos, setCursos] = useState<ResumenCurso[]>([]);
  const [comunidades, setComunidades] = useState<ComunidadDirectorio[]>(COMUNIDADES);
  const [cursoId, setCursoId] = useState(CURSO_PRINCIPAL);
  const [inscripcion, setInscripcion] = useState<EstadoInscripcion | null>(null);
  const [estado, setEstado] = useState<EstadoPlataforma | null>(null);
  const [membresias, setMembresias] = useState<Record<string, Membresia>>({});
  const [pagoPendiente, setPagoPendiente] = useState<Pago | null>(null);
  const [completadas, setCompletadas] = useState<string[]>([]);
  const [fechasCompletadas, setFechasCompletadas] = useState<Record<string, string>>({});
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
      // La coach también ve sus borradores (vista previa antes de publicar).
      const borrador = usuario?.rol === "coach" ? "&borrador=1" : "";
      setDatos(await api<DatosCurso>(`/api/curso?curso=${encodeURIComponent(cursoId)}${borrador}`));
      setErrorDatos(null);
    } catch (e) {
      setErrorDatos((e as Error).message);
    }
  }, [cursoId, usuario?.rol]);

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

  // Al abrir la plataforma: primero la sesión (del servidor) y luego lo que
  // este navegador recuerda de esa misma persona.
  useEffect(() => {
    let vigente = true;
    void (async () => {
      const sesion = await api<OpcionesEntrada & { cuenta: Usuario | null }>("/api/sesion").catch(() => null);
      if (!vigente) return;
      const cuenta = sesion?.cuenta ?? null;
      setOpcionesEntrada(sesion ? { google: sesion.google, demo: sesion.demo } : { google: false, demo: null });
      quedarseCon(cuenta);
      setUsuario(cuenta);
      // Al volver de Google llega ?google=…: se avisa y se quita de la dirección.
      const url = new URL(window.location.href);
      const google = url.searchParams.get("google");
      if (google) {
        url.searchParams.delete("google");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
        if (AVISOS_GOOGLE[google]) {
          setAvisoEntrada(AVISOS_GOOGLE[google]);
          if (!cuenta) setPidiendoUsuario(true);
        }
      }

      // Antes había una sola membresía (de Finanzas Claras); ahora hay una por comunidad.
      const guardadas = leerLocal<Membresia | Record<string, Membresia>>(CLAVES.membresia);
      setMembresias(
        !guardadas ? {} : "metodo" in guardadas ? { [COMUNIDAD_PRINCIPAL]: guardadas as Membresia } : (guardadas as Record<string, Membresia>),
      );
      const pendiente = leerLocal<Pago>(CLAVES.pagoPendiente);
      // Una ficha vencida ya no sirve para pagar: se descarta.
      if (pendiente && (!pendiente.venceEn || Date.parse(pendiente.venceEn) > Date.now())) {
        setPagoPendiente(pendiente);
      } else if (pendiente) {
        guardarLocal(CLAVES.pagoPendiente, null);
      }
      setCompletadas(leerLocal<string[]>(CLAVES.completadas) ?? []);
      setFechasCompletadas(leerLocal<Record<string, string>>(CLAVES.fechasCompletadas) ?? {});
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
    })();
    api<EstadoPlataforma>("/api/estado")
      .then(setEstado)
      .catch(() => setEstado({ iaActiva: false, modelo: null }));
    return () => {
      vigente = false;
    };
  }, []);

  // Solo cuenta la última carga: una respuesta vieja no pisa el catálogo.
  const cargaCatalogo = useRef(0);
  const recargarCatalogo = useCallback(async () => {
    const esta = ++cargaCatalogo.current;
    const [lista, directorio] = await Promise.all([
      api<ResumenCurso[]>("/api/cursos").catch(() => null),
      api<ComunidadDirectorio[]>("/api/comunidades").catch(() => null),
    ]);
    if (esta !== cargaCatalogo.current) return;
    if (lista) setCursos(lista);
    if (directorio) setComunidades(directorio);
  }, []);

  // Al entrar o cambiar de rol, el catálogo se vuelve a pedir (la coach suma sus cursos sin publicar).
  useEffect(() => {
    if (listo) void recargarCatalogo();
  }, [listo, usuario?.nombre, usuario?.rol, recargarCatalogo]);

  const guardarUsuario = useCallback((u: Usuario) => {
    if (quedarseCon(u)) {
      // Entró otra persona: lo que recordaba el navegador era de la anterior.
      setMembresias({});
      setCompletadas([]);
    setFechasCompletadas({});
      setFechasCompletadas({});
      setVistos([]);
      setRepasados([]);
      setPagoPendiente(null);
      setLeccionDeseada(null);
      setChat([]);
      setChatGeneral([]);
    }
    setUsuario(u);
    setAvisoEntrada(null);
    setPidiendoUsuario(false);
  }, []);

  // El avance y la membresía de prueba viven en el navegador: al salir se
  // borran para que quien entre después no los herede.
  const cerrarSesion = useCallback(() => {
    void api("/api/sesion", { method: "DELETE" }).catch(() => undefined);
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
    setMembresias({});
    setCompletadas([]);
    setFechasCompletadas({});
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

  // Inscripción (comunidades y cursos), guardada en el servidor. Una coach
  // también la tiene en las comunidades de otras empresas.
  useEffect(() => {
    setInscripcion(null);
    if (!listo || !usuario) return;
    let vigente = true;
    api<EstadoInscripcion>("/api/inscripcion")
      .then((e) => vigente && setInscripcion(e))
      .catch(() => vigente && setInscripcion({ comunidades: [], cursos: [] }));
    return () => {
      vigente = false;
    };
  }, [listo, usuario?.nombre, usuario?.rol]);

  // La comunidad que se está viendo es la del curso activo.
  const comunidadId =
    datos?.comunidad.id ?? cursos.find((c) => c.id === cursoId)?.comunidad ?? COMUNIDAD_PRINCIPAL;

  const inscribir = useCallback(
    async (accion: "comunidad" | "curso", extra: { curso?: string; comunidad?: string }) => {
      if (!usuario) return;
      setInscripcion(
        await api<EstadoInscripcion>("/api/inscripcion", {
          method: "POST",
          json: { accion, ...extra },
        }),
      );
    },
    [usuario],
  );
  const unirmeAComunidad = useCallback(
    (comunidad?: string) => inscribir("comunidad", { comunidad: comunidad ?? comunidadId }),
    [inscribir, comunidadId],
  );
  const inscribirmeACurso = useCallback((curso: string) => inscribir("curso", { curso }), [inscribir]);

  const activarMembresia = useCallback(
    (m: Membresia | null) => {
      setMembresias((todas) => {
        const nuevas = { ...todas };
        if (m) nuevas[comunidadId] = m;
        else delete nuevas[comunidadId];
        guardarLocal(CLAVES.membresia, nuevas);
        return nuevas;
      });
      // Quien paga la membresía queda unido a esa comunidad.
      if (m && usuario?.rol === "alumno" && inscripcion && !inscripcion.comunidades.includes(comunidadId)) {
        void inscribir("comunidad", { comunidad: comunidadId }).catch(() => undefined);
      }
    },
    [usuario?.rol, inscripcion, inscribir, comunidadId],
  );

  // Pasar a una comunidad es pasar a uno de sus cursos: el inscrito o el primero.
  const cambiarComunidad = useCallback(
    (comunidad: string) => {
      const suyos = cursos.filter((c) => c.comunidad === comunidad);
      const elegido = suyos.find((c) => inscripcion?.cursos.includes(c.id)) ?? suyos[0];
      if (elegido) cambiarCurso(elegido.id);
    },
    [cursos, inscripcion, cambiarCurso],
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
  // Con el avance viajan las fechas en que se completó cada lección: así se
  // abren las que piden esperar al día siguiente, también en otro dispositivo.
  const ponerFechas = useCallback((nuevas: Record<string, string>) => {
    setFechasCompletadas((actuales) => {
      const juntas = { ...nuevas };
      // Si las dos tienen fecha, cuenta la más antigua (la de la primera vez).
      for (const [id, f] of Object.entries(actuales)) if (!juntas[id] || f < juntas[id]) juntas[id] = f;
      guardarLocal(CLAVES.fechasCompletadas, juntas);
      return juntas;
    });
  }, []);

  const enviarProgreso = useCallback(
    (lista: string[]) => {
      void api<{ fechas?: Record<string, string> }>("/api/progreso", { method: "POST", json: { completadas: lista } })
        .then((r) => r.fechas && ponerFechas(r.fechas))
        .catch(() => {
          // sin conexión: el navegador lo conserva y se reenvía en el siguiente cambio
        });
    },
    [ponerFechas],
  );

  useEffect(() => {
    if (!listo || usuario?.rol !== "alumno") return;
    let vigente = true;
    api<{ completadas: string[]; fechas?: Record<string, string> }>("/api/progreso")
      .then(({ completadas: remotas, fechas }) => {
        if (!vigente) return;
        if (fechas) ponerFechas(fechas);
        setCompletadas((locales) => [...new Set([...locales, ...remotas])]);
        const union = [...new Set([...(leerLocal<string[]>(CLAVES.completadas) ?? []), ...remotas])];
        guardarLocal(CLAVES.completadas, union);
        if (union.length !== remotas.length) enviarProgreso(union);
      })
      .catch(() => {
        // sin conexión: se queda con lo que recuerda el navegador
      });
    return () => {
      vigente = false;
    };
  }, [listo, usuario?.nombre, usuario?.rol, enviarProgreso, ponerFechas]);

  const alternarCompletada = useCallback(
    (id: string) => {
      const quitar = completadas.includes(id);
      const nuevo = quitar ? completadas.filter((x) => x !== id) : [...completadas, id];
      setCompletadas(nuevo);
      guardarLocal(CLAVES.completadas, nuevo);
      setFechasCompletadas((actuales) => {
        const fechas = { ...actuales };
        if (quitar) delete fechas[id];
        else fechas[id] ??= new Date().toISOString();
        guardarLocal(CLAVES.fechasCompletadas, fechas);
        return fechas;
      });
      if (usuario?.rol === "alumno") enviarProgreso(nuevo);
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

  // La coach entra a todo lo de su empresa sin unirse ni pagar; en las demás es como cualquier alumno.
  const empresaDe = useCallback(
    (comunidad: string) =>
      (datos?.comunidad.id === comunidad ? datos.comunidad.empresa : undefined) ??
      cursos.find((c) => c.comunidad === comunidad)?.empresa ??
      comunidades.find((c) => c.id === comunidad)?.empresa ??
      "merkatics",
    [datos, cursos, comunidades],
  );
  const esCoachDe = useCallback(
    (comunidad: string) => usuario?.rol === "coach" && usuario.empresa === empresaDe(comunidad),
    [usuario?.rol, usuario?.empresa, empresaDe],
  );
  const coachAqui = esCoachDe(comunidadId);
  const inscritoEn = useCallback(
    (curso: string) => {
      const comunidad = cursos.find((c) => c.id === curso)?.comunidad;
      return (!!comunidad && esCoachDe(comunidad)) || Boolean(inscripcion?.cursos.includes(curso));
    },
    [cursos, esCoachDe, inscripcion],
  );
  const enLaComunidad = useCallback(
    (comunidad: string) => esCoachDe(comunidad) || Boolean(inscripcion?.comunidades.includes(comunidad)),
    [esCoachDe, inscripcion],
  );
  const membresiaEn = useCallback((comunidad: string) => membresias[comunidad] ?? null, [membresias]);
  const membresia = membresias[comunidadId] ?? null;
  const cursosComunidad = useMemo(() => cursos.filter((c) => c.comunidad === comunidadId), [cursos, comunidadId]);
  const temaDe = useCallback(
    (comunidad: string) => comunidades.find((c) => c.id === comunidad)?.tema ?? "Finanzas",
    [comunidades],
  );

  const fotoDe = useCallback(
    (clave: string): Foto | null => {
      const subida =
        cursos.find((c) => c.id === clave)?.foto ??
        comunidades.find((c) => c.id === clave)?.foto ??
        (datos?.curso.id === clave ? datos.curso.foto : undefined) ??
        (datos?.comunidad.id === clave ? datos.comunidad.foto : undefined);
      return subida ? { src: subida, foco: "50% 50%" } : fotoDePortada(clave);
    },
    [cursos, comunidades, datos],
  );

  const [aviso, setAviso] = useState<{ texto: string; id: number } | null>(null);
  const avisar = useCallback((texto: string | null) => setAviso(texto ? { texto, id: Date.now() } : null), []);

  const valor: ContextoApp = {
    listo,
    usuario,
    guardarUsuario,
    cerrarSesion,
    opcionesEntrada,
    avisoEntrada,
    marcaPagina,
    fijarMarcaPagina,
    // Sin sesión se ve la página para visitantes; la entrada se abre desde sus botones.
    pidiendoUsuario,
    setPidiendoUsuario,
    pedirEntrada,
    rolSugerido,
    datos,
    errorDatos,
    recargarCurso,
    cursos,
    cursosComunidad,
    comunidades,
    temaDe,
    fotoDe,
    recargarCatalogo,
    aviso,
    avisar,
    cursoId,
    cambiarCurso,
    comunidadId,
    cambiarComunidad,
    inscripcionLista: !usuario || coachAqui || inscripcion !== null,
    enComunidad: enLaComunidad(comunidadId),
    coachAqui,
    esCoachDe,
    enLaComunidad,
    inscritoEn,
    unirmeAComunidad,
    inscribirmeACurso,
    estado,
    lecciones,
    membresia,
    activarMembresia,
    membresiaEn,
    pagoPendiente,
    guardarPagoPendiente,
    tieneAcceso: coachAqui || membresia !== null,
    completadas,
    fechasCompletadas,
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
