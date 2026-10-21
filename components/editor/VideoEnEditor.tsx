"use client";

import { useRef, useState } from "react";
import { MAX_BYTES_VIDEO, reloj, segundos, tamañoLegible, tipoDeVideo } from "@/lib/reglas-video";
import { SubidaCancelada, destinoDeLeccion, subirVideo } from "@/lib/subir-video";
import type { Leccion, OpcionesPresentacion } from "@/lib/tipos";
import { useApp } from "../Contexto";
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
  /** Con tramo: la lección es una parte de un video que comparte con otras (curso armado desde un video). */
  video: { nombre: string; url: string; inicio?: number; fin?: number } | null;
  /** Su presentación con IA, si tiene. */
  presentacion: Leccion["presentacion"] | null;
  /** Hay cambios sin guardar (la presentación usa el texto guardado). */
  sinGuardar: boolean;
  alCambiar: () => void;
}) {
  const { estado } = useApp();
  const entrada = useRef<HTMLInputElement>(null);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [recien, setRecien] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const [editando, setEditando] = useState(false);
  const [ajustando, setAjustando] = useState(false);

  // Presentación con IA: diapositivas del texto guardado, narradas por la voz del dispositivo.
  const generar = async (opciones: OpcionesPresentacion) => {
    setError(null);
    setPidiendo(false);
    setGenerando(true);
    const res = await fetch(`/api/presentaciones/${leccion}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const res = await fetch(`/api/presentaciones/${leccion}`, { method: "DELETE" }).catch(() => null);
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
    subirVideo(destinoDeLeccion(leccion), archivo, tipo, !!estado?.videosEnLaNube, setProgreso).listo.then(
      () => {
        setProgreso(null);
        alCambiar();
      },
      (e: Error) => {
        setProgreso(null);
        if (!(e instanceof SubidaCancelada)) setError(e.message);
      },
    );
  };

  const quitar = async () => {
    const res = await fetch(`/api/videos/${leccion}`, { method: "DELETE" }).catch(() => null);
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
        <>
          <p className="editor-video-actual">
            <IconoVideo width={16} height={16} />
            <a href={video.fin !== undefined ? `${video.url}#t=${video.inicio ?? 0},${video.fin}` : video.url} target="_blank" rel="noreferrer">
              {video.nombre}
            </a>
            {video.fin !== undefined && (
              <span className="texto-suave">
                del <span className="cifra">{reloj(video.inicio ?? 0)}</span> al <span className="cifra">{reloj(video.fin)}</span>
              </span>
            )}
            {video.fin !== undefined && (
              <button type="button" className="enlace" onClick={() => setAjustando(!ajustando)} aria-expanded={ajustando}>
                Ajustar tramo
              </button>
            )}
            <button type="button" className="enlace" onClick={() => entrada.current?.click()}>
              Cambiar
            </button>
            <button type="button" className="enlace enlace-discreto" onClick={() => void quitar()}>
              Quitar
            </button>
          </p>
          {ajustando && video.fin !== undefined && (
            <AjustarTramo
              leccion={leccion}
              inicio={video.inicio ?? 0}
              fin={video.fin}
              alGuardar={() => {
                setAjustando(false);
                alCambiar();
              }}
              alCancelar={() => setAjustando(false)}
            />
          )}
        </>
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

/** Dónde empieza y termina la lección dentro del video (minutos y segundos). */
function AjustarTramo({
  leccion,
  inicio,
  fin,
  alGuardar,
  alCancelar,
}: {
  leccion: string;
  inicio: number;
  fin: number;
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const [desde, setDesde] = useState(reloj(inicio));
  const [hasta, setHasta] = useState(reloj(fin));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    const a = segundos(desde);
    const b = segundos(hasta);
    if (a === undefined || b === undefined) return setError("Escribe minutos y segundos, por ejemplo 6:10.");
    if (b - a < 5) return setError("El fin tiene que quedar al menos 5 segundos después del inicio.");
    setGuardando(true);
    setError(null);
    const res = await fetch(`/api/videos/${leccion}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inicio: a, fin: b }),
    }).catch(() => null);
    setGuardando(false);
    if (!res?.ok) {
      const datos = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
      return setError(datos.error ?? "No se pudo guardar el tramo. Inténtalo de nuevo.");
    }
    alGuardar();
  };

  return (
    <div className="editor-tramo" role="group" aria-label="Tramo del video">
      <label className="campo">
        <span>Empieza en</span>
        <input value={desde} onChange={(e) => setDesde(e.target.value)} inputMode="numeric" placeholder="0:00" className="cifra" />
      </label>
      <label className="campo">
        <span>Termina en</span>
        <input value={hasta} onChange={(e) => setHasta(e.target.value)} inputMode="numeric" placeholder="0:00" className="cifra" />
      </label>
      <div className="editor-tramo-acciones">
        <button type="button" className="boton boton-chico" onClick={() => void guardar()} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar tramo"}
        </button>
        <button type="button" className="boton boton-chico boton-fantasma" onClick={alCancelar}>
          Cancelar
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
