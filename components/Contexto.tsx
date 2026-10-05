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
  EstadoPlataforma,
  Leccion,
  MetodoPago,
  Modulo,
  Pago,
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
  datos: DatosCurso | null;
  errorDatos: string | null;
  recargarCurso: () => Promise<void>;
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
  chat: MensajeChat[];
  setChat: Dispatch<SetStateAction<MensajeChat[]>>;
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
};

export function ProveedorApp({ children }: { children: ReactNode }) {
  const [listo, setListo] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [pidiendoUsuario, setPidiendoUsuario] = useState(false);
  const [datos, setDatos] = useState<DatosCurso | null>(null);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoPlataforma | null>(null);
  const [membresia, setMembresia] = useState<Membresia | null>(null);
  const [pagoPendiente, setPagoPendiente] = useState<Pago | null>(null);
  const [completadas, setCompletadas] = useState<string[]>([]);
  const [chat, setChat] = useState<MensajeChat[]>([]);
  const [leccionContexto, setLeccionContexto] = useState<string | null>(null);
  const [preguntaPendiente, setPreguntaPendiente] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [leccionDeseada, setLeccionDeseada] = useState<string | null>(null);

  const recargarCurso = useCallback(async () => {
    try {
      setDatos(await api<DatosCurso>("/api/curso"));
      setErrorDatos(null);
    } catch (e) {
      setErrorDatos((e as Error).message);
    }
  }, []);

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
    setLeccionDeseada(leerLocal<string>(CLAVES.leccionDeseada));
    // La conversación sobrevive a una recarga o a cambiar de app. Una respuesta
    // que se estaba escribiendo cuando se cerró la página queda como detenida.
    const guardado = leerSesion<MensajeChat[]>(CLAVES.chat) ?? [];
    setChat(guardado.map((m) => (m.estado === "escribiendo" ? { ...m, estado: "detenido" } : m)));
    setListo(true);
    void recargarCurso();
    api<EstadoPlataforma>("/api/estado")
      .then(setEstado)
      .catch(() => setEstado({ iaActiva: false, modelo: null }));
  }, [recargarCurso]);

  const guardarUsuario = useCallback((u: Usuario) => {
    const completo = { ...u, desde: u.desde ?? new Date().toISOString() };
    setUsuario(completo);
    guardarLocal(CLAVES.usuario, completo);
    setPidiendoUsuario(false);
  }, []);

  // En el prototipo todo vive en el navegador: al salir se borra lo de esa
  // persona para que quien entre después no herede su avance ni su membresía.
  const cerrarSesion = useCallback(() => {
    for (const clave of [CLAVES.usuario, CLAVES.membresia, CLAVES.completadas, CLAVES.pagoPendiente, CLAVES.leccionDeseada]) {
      guardarLocal(clave, null);
    }
    guardarSesion(CLAVES.chat, null);
    setUsuario(null);
    setMembresia(null);
    setCompletadas([]);
    setPagoPendiente(null);
    setLeccionDeseada(null);
    setChat([]);
    setLeccionContexto(null);
    setPreguntaPendiente(null);
    setBorrador(null);
    setPidiendoUsuario(false);
  }, []);

  const activarMembresia = useCallback((m: Membresia | null) => {
    setMembresia(m);
    guardarLocal(CLAVES.membresia, m);
  }, []);

  const guardarPagoPendiente = useCallback((p: Pago | null) => {
    setPagoPendiente(p);
    guardarLocal(CLAVES.pagoPendiente, p);
  }, []);

  useEffect(() => {
    if (listo) guardarSesion(CLAVES.chat, chat.length ? chat.slice(-30) : null);
  }, [chat, listo]);

  const guardarLeccionDeseada = useCallback((id: string | null) => {
    setLeccionDeseada(id);
    guardarLocal(CLAVES.leccionDeseada, id);
  }, []);

  const alternarCompletada = useCallback((id: string) => {
    setCompletadas((actual) => {
      const nuevo = actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id];
      guardarLocal(CLAVES.completadas, nuevo);
      return nuevo;
    });
  }, []);

  const lecciones = useMemo(
    () =>
      datos?.curso.modulos.flatMap((modulo) => modulo.lecciones.map((l) => ({ ...l, modulo }))) ?? [],
    [datos],
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
    estado,
    lecciones,
    membresia,
    activarMembresia,
    pagoPendiente,
    guardarPagoPendiente,
    tieneAcceso: usuario?.rol === "coach" || membresia !== null,
    completadas,
    alternarCompletada,
    chat,
    setChat,
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
