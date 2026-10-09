// Tipos compartidos entre el servidor (rutas /api) y la interfaz.
// Reflejan el modelo de datos que en la Fase 2 pasará a Django:
// Comunidad, Curso, Módulo, Lección, Publicación y Alumno.

export type Rol = "alumno" | "coach";

export interface Comunidad {
  id: string;
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
  /** Lo que el alumno sabrá hacer al terminar (portada del curso). */
  aprenderas?: string[];
  requisitos?: string;
  preguntas_sugeridas: string[];
  modulos: Modulo[];
}

export interface DatosCurso {
  comunidad: Comunidad;
  curso: Curso;
}

// ---------- Comunidades y cursos que crea la coach desde la plataforma ----------

/** Pregunta de opción múltiple de un curso creado (repaso o examen final). */
export interface PreguntaCurso {
  id: string;
  enunciado: string;
  opciones: string[];
  correcta: number;
  explicacion?: string;
  /** En el examen: la lección de donde sale (para decirle al alumno qué repasar). */
  leccion?: string;
}

export interface LeccionCreada {
  id: string;
  titulo: string;
  duracion_min: number;
  gratis: boolean;
  resumen: string;
  contenido: string;
  transcripcion: string;
  preguntas_sugeridas: string[];
  repaso: PreguntaCurso[];
}

export interface ModuloCreado {
  id: string;
  titulo: string;
  lecciones: LeccionCreada[];
}

export interface CursoCreado {
  id: string;
  /** "" mientras la coach no lo pone en una comunidad (así no se puede publicar). */
  comunidad: string;
  /** Los alumnos solo ven los publicados. */
  estado: "borrador" | "publicado";
  /** Cómo nació el borrador: a mano o a partir de un documento con IA. */
  origen: "manual" | "ia";
  titulo: string;
  subtitulo: string;
  aprenderas: string[];
  requisitos: string;
  preguntas_sugeridas: string[];
  modulos: ModuloCreado[];
  examen: PreguntaCurso[];
  autor: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ComunidadCreada extends Comunidad {
  tema: string;
  /** Nombre de la coach que la creó (en la Fase 2, su cuenta). */
  autor: string;
  creadaEn: string;
}

/** Ficha corta de cada curso de la comunidad, para elegir cuál tomar. */
export interface ResumenCurso {
  id: string;
  /** Comunidad a la que pertenece el curso. */
  comunidad: string;
  titulo: string;
  subtitulo: string;
  modulos: number;
  /** Ids de las lecciones del curso (sin las que agrega la coach desde su panel). */
  lecciones: string[];
  minutos: number;
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
  /** Sin este dato, la publicación es de la comunidad principal (las de antes de que hubiera dos). */
  comunidad?: string;
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
  /** Curso del asistente; sin este dato, el principal. */
  curso?: string;
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

/** Cursos por alumnos y comunidades por miembros, de más a menos. */
export interface Tendencias {
  cursos: { id: string; alumnos: number }[];
  comunidades: { id: string; miembros: number }[];
}

export type MetodoPago = "oxxo" | "spei" | "mercadopago";

export interface Pago {
  id: number;
  /** Comunidad de la membresía; sin este dato, la principal. */
  comunidad?: string;
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
  /** "redis": datos compartidos entre las copias del servidor; "archivo": en el disco de esta copia. */
  almacen?: "redis" | "archivo";
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

// ---------- Evaluaciones: repaso por lección, examen final y expediente ----------

/** Pregunta tal como la ve el alumno: sin la respuesta correcta. */
export interface PreguntaPublica {
  id: string;
  enunciado: string;
  opciones: string[];
  /** En el examen final, la lección que conviene repasar si se falla. */
  leccion?: string;
}

export interface EvaluacionesPublicas {
  /** Porcentaje mínimo para aprobar el examen final. */
  aprobarCon: number;
  intentosExamen: number;
  repaso: Record<string, PreguntaPublica[]>;
  examenFinal: { titulo: string; preguntas: PreguntaPublica[] };
}

export interface ResultadoRepaso {
  aciertos: number;
  total: number;
  detalle: { id: string; acierto: boolean; correcta: number; explicacion: string }[];
}

export interface ResultadoExamen {
  aciertos: number;
  total: number;
  puntaje: number;
  aprobado: boolean;
  /** Lecciones de las preguntas falladas: el examen no revela las respuestas. */
  repasar: string[];
  intentosUsados: number;
  intentosMaximos: number;
  /** La coach puede presentarlo para revisarlo; su intento no se guarda. */
  vistaPrevia: boolean;
}

/** Inscripción de un alumno: primero se une a la comunidad (gratis) y luego a cada curso. */
export interface Inscripcion {
  autor: string;
  /** Inscripciones de antes de que hubiera dos comunidades: true = la principal. */
  comunidad?: boolean;
  comunidades?: string[];
  cursos: string[];
  desde: string;
}

/** Lo que el navegador necesita saber de la inscripción de un alumno. */
export interface EstadoInscripcion {
  comunidades: string[];
  cursos: string[];
}

/** Lecciones completadas por alumno, guardadas en el servidor para la matriz de la coach. */
export interface ProgresoAlumno {
  autor: string;
  completadas: string[];
  actualizado: string;
}

export interface IntentoRepaso {
  autor: string;
  leccion: string;
  aciertos: number;
  total: number;
  fallas: string[];
  creadoEn: string;
}

export interface IntentoExamen {
  id: number;
  autor: string;
  /** Curso del examen. Los intentos guardados antes de que hubiera dos cursos no lo traen: son del curso principal. */
  curso?: string;
  aciertos: number;
  total: number;
  puntaje: number;
  aprobado: boolean;
  fallas: string[];
  creadoEn: string;
}

export type EstadoAlumno = "aprobado" | "requiere-apoyo" | "examen-pendiente" | "en-curso" | "sin-iniciar";

export interface Expediente {
  autor: string;
  estado: EstadoAlumno;
  completadas: string[];
  leccionesHechas: number;
  leccionesTotal: number;
  porModulo: { id: string; titulo: string; hechas: number; total: number }[];
  /** Último intento de repaso de cada lección, sumado. */
  repaso: { aciertos: number; total: number; lecciones: number };
  examen: {
    mejorPuntaje: number | null;
    intentos: number;
    intentosMaximos: number;
    aprobado: boolean;
    aprobadoEn: string | null;
  };
  ultimaActividad: string | null;
}

export interface MatrizAlumnos {
  curso: { id: string; titulo: string };
  /** Título de cada lección del curso, para nombrar las preguntas más falladas. */
  titulos: Record<string, string>;
  aprobarCon: number;
  modulos: { id: string; titulo: string; total: number }[];
  alumnos: Expediente[];
  /** Preguntas con más respuestas equivocadas, para saber qué tema reforzar. */
  masFalladas: {
    id: string;
    tipo: "repaso" | "examen";
    enunciado: string;
    leccion: string;
    fallas: number;
    respuestas: number;
  }[];
}
