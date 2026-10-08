import type { Icon, IconProps, IconWeight } from "@phosphor-icons/react";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  DownloadSimple,
  Exam,
  GraduationCap,
  ListChecks,
  XCircle,
  BookOpenText,
  ChartBar,
  ChatCircleText,
  ChatsCircle,
  Check,
  Copy,
  LockSimple,
  MagnifyingGlass,
  NotePencil,
  PaperPlaneRight,
  Play,
  PushPin,
  Article,
  CalendarBlank,
  ChalkboardTeacher,
  PencilSimple,
  Question,
  SealCheck,
  SignOut,
  Sparkle,
  Student,
  Stop,
  ThumbsUp,
  Trash,
  UploadSimple,
  VideoCamera,
  X,
} from "@phosphor-icons/react/ssr";

// Una sola familia de íconos (Phosphor) con el mismo trazo en toda la app.
// Se conservan los nombres de siempre; width/height se traducen al tamaño.
type P = Omit<IconProps, "size"> & { width?: number | string; height?: number | string };

function icono(Componente: Icon, peso: IconWeight = "regular") {
  function IconoApp({ width, height, weight, ...resto }: P) {
    return <Componente size={width ?? height ?? 18} weight={weight ?? peso} aria-hidden="true" {...resto} />;
  }
  return IconoApp;
}

export const IconoComunidad = icono(ChatsCircle);
export const IconoCurso = icono(BookOpenText);
export const IconoAsistente = icono(NotePencil);
/** Asistente general de Merkatics (el del menú), distinto del asistente del curso. */
export const IconoAsistenteGeneral = icono(Sparkle);
export const IconoPanel = icono(ChartBar);
export const IconoCandado = icono(LockSimple);
export const IconoCheck = icono(Check, "bold");
export const IconoPlay = icono(Play, "fill");
export const IconoEnviar = icono(PaperPlaneRight);
export const IconoDetener = icono(Stop, "fill");
export const IconoUtil = icono(ThumbsUp);
export const IconoComentario = icono(ChatCircleText);
export const IconoCopiar = icono(Copy);
export const IconoCerrar = icono(X);
export const IconoFlechaDer = icono(ArrowRight);
export const IconoFlechaIzq = icono(ArrowLeft);
export const IconoFijado = icono(PushPin);
export const IconoBorrar = icono(Trash);
export const IconoSello = icono(SealCheck, "fill");
export const IconoSubir = icono(UploadSimple);
export const IconoSalir = icono(SignOut);
export const IconoAlumno = icono(Student);
export const IconoCoach = icono(ChalkboardTeacher);
export const IconoCalendario = icono(CalendarBlank);
export const IconoEditar = icono(PencilSimple);
export const IconoPregunta = icono(Question);
export const IconoPublicacion = icono(Article);
export const IconoVideo = icono(VideoCamera);
export const IconoRepaso = icono(ListChecks);
export const IconoExamen = icono(Exam);
export const IconoAprobado = icono(GraduationCap);
export const IconoAcierto = icono(CheckCircle, "fill");
export const IconoError = icono(XCircle, "fill");
export const IconoReintentar = icono(ArrowCounterClockwise);
export const IconoDescargar = icono(DownloadSimple);
export const IconoBuscar = icono(MagnifyingGlass);
