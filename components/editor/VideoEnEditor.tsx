"use client";

import { useRef, useState } from "react";
import { MAX_BYTES_VIDEO, tamañoLegible, tipoDeVideo } from "@/lib/reglas-video";
import type { Leccion, OpcionesPresentacion } from "@/lib/tipos";
import EleccionVoz from "../EleccionVoz";
import EditorPresentacion from "./EditorPresentacion";
import FormaPresentacionIA from "./FormaPresentacionIA";
import { IconoAsistenteGeneral, IconoSubir, IconoVideo } from "../Iconos";

// Video de una lección dentro del editor: subir, cambiar o quitar. Una lección
// nueva primero se guarda (así recibe su id) y luego se le sube el video.
export default function VideoEnEditor({
  leccion,
  guardada,
  video,
  presentacion,
  sinGuardar,
  alCambiar,
}: {
  leccion: string;
  guardada: boolean;
  video: { nombre: string; url: string } | null;
  /** Su presentación con IA, si tiene. */
  presentacion: Leccion["presentacion"] | null;
  /** Hay cambios sin guardar (la presentación usa el texto guardado). */
  sinGuardar: boolean;
  alCambiar: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [recien, setRecien] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const [editando, setEditando] = useState(false);

  // Presentación con IA: diapositivas del texto guardado, narradas por la voz del dispositivo.
  const generar = async (opciones: OpcionesPresentacion) => {
    setError(null);
    setPidiendo(false);
    setGenerando(true);
    const res = await fetch(`/api/presentaciones/${leccion}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Rol": "coach" },
      body: JSON.stringify(opciones),
    }).catch(() => null);
    setGenerando(false);
    if (!res?.ok) {
      const datos = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
      return setError(datos.error ?? "No se pudo generar la presentación. Inténtalo de nuevo.");
    }
    setRecien(true);
    alCambiar();
  };

  const quitarPresentacion = async () => {
    const res = await fetch(`/api/presentaciones/${leccion}`, { method: "DELETE", headers: { "X-Rol": "coach" } }).catch(() => null);
    if (!res?.ok) return setError("No se pudo quitar la presentación.");
    alCambiar();
  };

  if (!guardada) {
    return <p className="nota editor-video">Guarda el curso para poder subir el video de esta lección.</p>;
  }

  const subir = (archivo: File) => {
    const tipo = tipoDeVideo(archivo.name, archivo.type);
    if (!tipo) return setError("Ese archivo no es un video MP4, WebM o MOV.");
    if (archivo.size > MAX_BYTES_VIDEO) {
      return setError(`El video pesa ${tamañoLegible(archivo.size)} y el máximo es ${tamañoLegible(MAX_BYTES_VIDEO)}.`);
    }
    setError(null);
    setProgreso(0);
    // XMLHttpRequest para poder mostrar el avance de la subida.
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/videos/${leccion}`);
    xhr.setRequestHeader("Content-Type", tipo);
    xhr.setRequestHeader("X-Rol", "coach");
    xhr.setRequestHeader("X-Nombre-Archivo", encodeURIComponent(archivo.name));
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgreso(e.loaded / e.total);
    xhr.onload = () => {
      setProgreso(null);
      if (xhr.status >= 200 && xhr.status < 300) return alCambiar();
      let mensaje = "No se pudo subir el video. Inténtalo de nuevo.";
      try {
        mensaje = (JSON.parse(xhr.responseText) as { error?: string }).error ?? mensaje;
      } catch {
        // respuesta sin JSON (por ejemplo, el límite de tamaño del servidor)
        if (xhr.status === 413) mensaje = "El video es demasiado pesado para el servidor publicado. Prueba con uno más corto.";
      }
      setError(mensaje);
    };
    xhr.onerror = () => {
      setProgreso(null);
      setError("Se cortó la conexión mientras subía el video.");
    };
    xhr.send(archivo);
  };

  const quitar = async () => {
    const res = await fetch(`/api/videos/${leccion}`, { method: "DELETE", headers: { "X-Rol": "coach" } }).catch(() => null);
    if (!res?.ok) return setError("No se pudo quitar el video.");
    alCambiar();
  };

  return (
    <div className="editor-video">
      <input
        ref={entrada}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
        hidden
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          e.target.value = "";
          if (archivo) subir(archivo);
        }}
      />
      {progreso !== null ? (
        <div className="editor-video-subiendo">
          <div className="progreso" role="progressbar" aria-label="Subiendo video" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progreso * 100)}>
            <span style={{ transform: `scaleX(${progreso})` }} />
          </div>
          <span className="texto-suave cifra">Subiendo… {Math.round(progreso * 100)}%</span>
        </div>
      ) : video ? (
        <p className="editor-video-actual">
          <IconoVideo width={16} height={16} />
          <a href={video.url} target="_blank" rel="noreferrer">
            {video.nombre}
          </a>
          <button type="button" className="enlace" onClick={() => entrada.current?.click()}>
            Cambiar
          </button>
          <button type="button" className="enlace enlace-discreto" onClick={() => void quitar()}>
            Quitar
          </button>
        </p>
      ) : (
        <div className="editor-video-opciones">
          <button type="button" className="boton boton-chico boton-fantasma" onClick={() => entrada.current?.click()}>
            <IconoSubir width={15} height={15} /> Subir video (MP4, WebM o MOV)
          </button>
          {generando ? (
            <span className="texto-suave editor-video-generando">Generando la presentación…</span>
          ) : presentacion ? (
            <span className="editor-video-actual">
              <IconoAsistenteGeneral width={16} height={16} />
              <span>
                Presentación con IA · <span className="cifra">{presentacion.diapositivas.length}</span> diapositivas
              </span>
              <button type="button" className="enlace" onClick={() => setEditando(true)}>
                Editar
              </button>
              <button type="button" className="enlace" onClick={() => setPidiendo(!pidiendo)} aria-expanded={pidiendo}>
                Volver a generar
              </button>
              <button type="button" className="enlace enlace-discreto" onClick={() => void quitarPresentacion()}>
                Quitar
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="boton boton-chico boton-fantasma-borde"
              onClick={() => setPidiendo(!pidiendo)}
              aria-expanded={pidiendo}
            >
              <IconoAsistenteGeneral width={15} height={15} /> Generar presentación con IA
            </button>
          )}
        </div>
      )}
      {!video && pidiendo && !generando && (
        <FormaPresentacionIA
          inicial={presentacion?.opciones}
          generando={generando}
          alGenerar={(o) => void generar(o)}
          alCancelar={() => setPidiendo(false)}
        />
      )}
      {editando && presentacion && (
        <EditorPresentacion
          leccion={leccion}
          inicial={presentacion.diapositivas}
          alCerrar={() => setEditando(false)}
          alGuardar={alCambiar}
        />
      )}
      {!video && presentacion && !generando && (
        <EleccionVoz
          leccion={leccion}
          conVoz={presentacion.conVoz}
          recien={recien}
          alCambiar={() => {
            setRecien(false);
            alCambiar();
          }}
        />
      )}
      {!video && sinGuardar && !generando && (
        <p className="nota">La presentación usa el texto guardado: guarda tus cambios antes de generarla.</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
