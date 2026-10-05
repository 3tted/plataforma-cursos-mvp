// Tipos compartidos entre el servidor (rutas /api) y la interfaz.
// Reflejan el modelo de datos que en la Fase 2 pasará a Django:
// Comunidad, Curso, Módulo, Lección, Publicación y Alumno.

export type Rol = "alumno" | "coach";

export interface Comunidad {
  nombre: string;
  coach: string;
  coach_titulo: string;
  descripcion: string;
  precio_mensual: number;
  moneda: string;
}

export interface Leccion {
  id: string;
  titulo: string;
  duracion_min: number;
  gratis: boolean;
  resumen: string;
  preguntas_sugeridas: string[];
  contenido: string;
  transcripcion: string;
  deCoach?: boolean;
  /** Video que subió la coach; sin él, la lección se lee en texto y transcripción. */
  video?: { url: string; tipo: string; nombre: string; subidoEn: string };
}

/** Registro de un video subido (el archivo vive en DATA_DIR/videos). */
export interface VideoLeccion {
  leccion: string;
  archivo: string;
  tipo: string;
  bytes: number;
  nombreOriginal: string;
  subidoEn: string;
}

export interface Modulo {
  id: string;
  titulo: string;
  lecciones: Leccion[];
}

export interface Curso {
  id: string;
  titulo: string;
  subtitulo: string;
  preguntas_sugeridas: string[];
  modulos: Modulo[];
}

export interface DatosCurso {
  comunidad: Comunidad;
  curso: Curso;
}

export type Categoria = "Anuncios" | "Dudas" | "Logros" | "Presentaciones" | "General";

export const CATEGORIAS: Categoria[] = ["Anuncios", "Dudas", "Logros", "Presentaciones", "General"];

export interface Comentario {
  id: number;
  autor: string;
  rol: Rol;
  cuerpo: string;
  creadoEn: string;
}

export interface Publicacion {
  id: number;
  autor: string;
  rol: Rol;
  categoria: Categoria;
  titulo: string;
  cuerpo: string;
  fijada: boolean;
  creadaEn: string;
  comentarios: Comentario[];
  reacciones: string[];
}

export interface LeccionCoach {
  id: number;
  titulo: string;
  contenido: string;
  creadaEn: string;
}

export interface PreguntaIA {
  id: number;
  autor: string;
  pregunta: string;
  leccionActual: string | null;
  citas: string[];
  modo: "ia" | "demo";
  /** Lo que contestó el asistente (recortado), para que la coach lo revise. */
  respuesta?: string;
  creadaEn: string;
}

export interface ResumenComunidad {
  miembros: number;
}

export type MetodoPago = "oxxo" | "spei" | "mercadopago";

export interface Pago {
  id: number;
  autor: string;
  metodo: MetodoPago;
  monto: number;
  referencia: string;
  clabe?: string;
  venceEn?: string;
  estado: "pendiente" | "pagado";
  creadoEn: string;
}

export interface EstadoPlataforma {
  iaActiva: boolean;
  modelo: string | null;
}

export interface ResumenCoach {
  miembros: number;
  publicaciones: number;
  preguntasSemana: number;
  preguntas: PreguntaIA[];
  leccionesConsultadas: { id: string; total: number }[];
  pagos: Pago[];
  ingresosSimulados: number;
  leccionesCoach: LeccionCoach[];
}

export interface TurnoChat {
  role: "user" | "assistant";
  content: string;
}
