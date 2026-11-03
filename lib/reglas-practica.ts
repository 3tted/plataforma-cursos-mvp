// Reglas de los archivos de práctica, compartidas por el navegador y el servidor.

/** 4 MB: lo que cabe en una petición a Vercel y alcanza para un documento o una foto. */
export const MAX_BYTES_PRACTICA = 4 * 1024 * 1024;

export const EXTENSIONES_PRACTICA: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

/** Lo que acepta el selector de archivos del navegador. */
export const ACEPTA_PRACTICA = Object.keys(EXTENSIONES_PRACTICA)
  .map((e) => `.${e}`)
  .join(",");

export const extensionAceptada = (nombre: string) => (nombre.toLowerCase().split(".").pop() ?? "") in EXTENSIONES_PRACTICA;

/** Hasta este largo llegan las notas del alumno. */
export const MAX_TEXTO_PRACTICA = 6000;
