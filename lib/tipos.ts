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
  /** Texto más largo para la presentación de la comunidad (lo escribe la coach). */
  acerca?: string;
  /** Foto de portada que subió la coach (url de /api/fotos). */
  foto?: string;
  /** Marca de la empresa dueña (color y logo); sin el dato, la de Merkatics. */
  marca?: MarcaEmpresa;
  /** Empresa dueña; sin el dato, la de Merkatics (las comunidades de ejemplo). */
  empresa?: string;
  /** Nombre de la empresa dueña (para enlazar su página, /e/<empresa>). */
  empresaNombre?: string;
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
  video?: { url: string; tipo: string; nombre: string; subidoEn: string; inicio?: number; fin?: number };
  /** Presentación con IA (diapositivas narradas con la voz del dispositivo), si no hay video. */
  presentacion?: { diapositivas: Diapositiva[]; creadaEn: string; conVoz: boolean; opciones?: OpcionesPresentacion };
}

/** Una diapositiva de la presentación de una lección. */
export interface Diapositiva {
  titulo: string;
  puntos: string[];
  /** Lo que dice la voz mientras se ve la diapositiva (también son sus subtítulos). */
  narracion: string;
}

/** Lo que la coach le pide a la IA al generar una presentación. */
export interface OpcionesPresentacion {
  /** Duración aproximada en minutos (sin el dato: la IA decide por lo largo de la lección). */
  minutos?: number;
  /** Cuántas diapositivas (sin el dato: según la duración). */
  diapositivas?: number;
  tono?: "cercano" | "formal" | "motivador";
  /** Indicaciones libres de la coach. */
  indicaciones?: string;
}

export interface Presentacion {
  leccion: string;
  diapositivas: Diapositiva[];
  creadaEn: string;
  /** La coach decide si lleva voz (sin el dato: con voz). */
  conVoz?: boolean;
  /** Lo que pidió al generarla, para proponerlo la siguiente vez. */
  opciones?: OpcionesPresentacion;
  /** Última vez que la coach la editó a mano. */
  editadaEn?: string;
}

/** Registro de un video subido (el archivo vive en DATA_DIR/videos). */
export interface VideoLeccion {
  leccion: string;
  /** Nombre del archivo en el disco (o su ruta en Vercel Blob). */
  archivo: string;
  /** Con Vercel Blob: la url del archivo (el reproductor va directo ahí). */
  url?: string;
  tipo: string;
  bytes: number;
  nombreOriginal: string;
  subidoEn: string;
  /**
   * Tramo del video que es de esta lección, en segundos (sin el dato: todo el
   * video). Las lecciones de un curso armado desde un video comparten el archivo.
   */
  inicio?: number;
  fin?: number;
}

/** Video que la coach sube para que la IA arme un curso con él (ver lib/curso-video.ts). */
export interface VideoFuente {
  id: string;
  empresa: string;
  archivo: string;
  url?: string;
  tipo: string;
  bytes: number;
  nombreOriginal: string;
  subidoEn: string;
  /** Lo que dura, en segundos (lo mide el navegador antes de subirlo). */
  duracion?: number;
  /** El video ya subido a Gemini para que lo vea ("files/…"). */
  gemini?: string;
  /** Lo que la IA ya armó del curso (ver TrabajoCursoVideo en lib/curso-video.ts). */
  trabajo?: unknown;
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
  /** Curso de la coach que ya está en la página pero sin publicar (solo ella lo ve). */
  sinPublicar?: boolean;
  /** Foto de portada que subió la coach (url de /api/fotos). */
  foto?: string;
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
  /** Subido a la página sin publicar: la coach lo ve en su comunidad como lo verá el alumno. */
  enPagina?: boolean;
  /** Cómo nació el borrador: a mano o a partir de un documento con IA. */
  origen: "manual" | "ia";
  /** Foto de portada que subió la coach (url de /api/fotos). */
  foto?: string;
  titulo: string;
  subtitulo: string;
  aprenderas: string[];
  requisitos: string;
  preguntas_sugeridas: string[];
  modulos: ModuloCreado[];
  examen: PreguntaCurso[];
  autor: string;
  /** Empresa del curso (la de la coach que lo creó). Opcional: llegó con las cuentas. */
  empresa?: string;
  creadoEn: string;
  actualizadoEn: string;
}

/**
 * Empresa (tenant): dueña de comunidades y cursos, con su marca. Su equipo
 * son las cuentas con `empresa` igual a su id, cada una con su rol: dueño,
 * administrador o coach.
 */
export interface Empresa {
  id: string;
  /** Nombre de la cuenta dueña. */
  dueno: string;
  nombre: string;
  /** Color principal en hex (#rrggbb); sin él, la marca de Merkatics. Los demás tonos se calculan (lib/marca.ts). */
  color?: string;
  /** Logo (url de /api/fotos). */
  logo?: string;
  /** A qué se dedica (lo escribe quien la registra). */
  giro?: string;
  /** Cuántos alumnos tenía al registrarse (un rango de RANGOS_ALUMNOS). */
  alumnosAprox?: string;
  creadaEn: string;
  actualizadaEn: string;
}

/**
 * Rol dentro de la empresa. El dueño y el administrador la manejan (equipo,
 * roles, invitaciones y marca); solo el dueño no se puede quitar y puede
 * pasarle la empresa a otra persona. El coach enseña: ve y edita todo el
 * contenido, los alumnos y los pagos, y modera las comunidades.
 */
export type RolEmpresa = "dueno" | "admin" | "coach";

/**
 * Cuenta de una persona. El nombre no se repite: es con el que se firma todo
 * lo que hace en la plataforma (publicaciones, avance, cursos).
 */
export interface Cuenta {
  id: string;
  correo: string;
  nombre: string;
  rol: Rol;
  /** Solo las coaches: su empresa y su rol en ella. */
  empresa?: string;
  rolEmpresa?: RolEmpresa;
  /** Equipo de Merkatics: invita a las empresas nuevas. */
  admin?: boolean;
  /** Contraseña cifrada (scrypt). Las cuentas que solo entran con Google no la tienen. */
  contrasena?: { sal: string; hash: string };
  /** Identificador de Google ("sub"), si la cuenta entra con Google. */
  google?: string;
  /** Cuenta de demostración: entra con la contraseña de demo mientras no ponga una propia. */
  demo?: boolean;
  bio?: string;
  creadaEn: string;
  intentosFallidos?: number;
  bloqueadaHasta?: string;
}

/** Sesión abierta: el navegador guarda el token en una cookie; aquí solo su huella (SHA-256). */
export interface Sesion {
  huella: string;
  cuenta: string;
  creadaEn: string;
  venceEn: string;
}

/** Invitación para ser coach: de una empresa que ya existe o para crear una empresa nueva. */
export interface Invitacion {
  codigo: string;
  tipo: "coach" | "empresa";
  /** La empresa a la que entra (tipo "coach"). */
  empresa?: string;
  /** Con qué rol entra a esa empresa (tipo "coach"); sin el dato, coach. */
  rol?: "admin" | "coach";
  /** Nombre propuesto para la empresa nueva (tipo "empresa"). */
  nombreEmpresa?: string;
  creadaPor: string;
  creadaEn: string;
  venceEn: string;
  usadaPor?: string;
  usadaEn?: string;
}

/** Opciones de "¿Cuántos alumnos tienes hoy?" al registrar una empresa. */
export const RANGOS_ALUMNOS = ["Todavía ninguno", "1 a 50", "51 a 200", "Más de 200"];

/** Lo que el navegador sabe de la cuenta con sesión abierta. */
export interface CuentaPublica {
  nombre: string;
  correo: string;
  rol: Rol;
  empresa?: string;
  rolEmpresa?: RolEmpresa;
  /** Dueño de su empresa: no se le puede quitar y puede pasarle la empresa a otra persona. */
  dueno: boolean;
  /** Dueño o administrador: maneja el equipo, las invitaciones y la marca. */
  administra: boolean;
  admin: boolean;
  /** Tiene contraseña propia (las de Google o demo pueden no tenerla). */
  conContrasena: boolean;
  conGoogle: boolean;
  demo: boolean;
  bio?: string;
  desde: string;
}

/** Lo que la interfaz necesita para pintar la marca de una empresa. */
export interface MarcaEmpresa {
  nombre: string;
  color: string;
  logo?: string;
}

export interface ComunidadCreada extends Comunidad {
  tema: string;
  /** Nombre de la coach que la creó. */
  autor: string;
  creadaEn: string;
}

/** Ficha corta de cada curso de la comunidad, para elegir cuál tomar. */
export interface ResumenCurso {
  id: string;
  /** Comunidad a la que pertenece el curso. */
  comunidad: string;
  /** Empresa dueña del curso. */
  empresa: string;
  titulo: string;
  subtitulo: string;
  modulos: number;
  /** Ids de las lecciones del curso (sin las que agrega la coach desde su panel). */
  lecciones: string[];
  minutos: number;
  /** Lo que se ve sin membresía: "Módulo 1 gratis", "2 lecciones gratis" o "". */
  gratis: string;
  /** false: está en la página pero sin publicar (solo lo ve su coach). */
  publicado: boolean;
  /** Foto de portada que subió la coach. */
  foto?: string;
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
  /** Curso al que la agregó la coach (sin el dato: el curso principal, como antes). */
  curso?: string;
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
  /** Los videos se suben a Vercel Blob (sin el límite de 4 MB de las peticiones). */
  videosEnLaNube?: boolean;
}

export interface ResumenCoach {
  miembros: number;
  publicaciones: number;
  preguntasSemana: number;
  preguntas: PreguntaIA[];
  leccionesConsultadas: { id: string; total: number }[];
  /** Título de cada lección citada, sea del curso que sea (el asistente general cita de todos). */
  titulos: Record<string, string>;
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

/** Respuestas que necesita una pregunta para mostrar su porcentaje de fallas. */
export const MIN_RESPUESTAS = 3;

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
