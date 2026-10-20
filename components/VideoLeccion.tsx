"use client";

import { useRef, useState, type DragEvent } from "react";
import { fechaCorta } from "@/lib/cliente";
import { MAX_BYTES_VIDEO, tipoDeVideo, tamañoLegible } from "@/lib/reglas-video";
import type { Leccion, OpcionesPresentacion } from "@/lib/tipos";
import { useApp } from "./Contexto";
import { acentoSobreOscuro } from "@/lib/marca";
import { posterDeVideo } from "@/lib/poster";
import { IconoAsistenteGeneral, IconoSubir } from "./Iconos";
import EleccionVoz from "./EleccionVoz";
import PresentacionLeccion from "./PresentacionLeccion";
import EditorPresentacion from "./editor/EditorPresentacion";
import FormaPresentacionIA from "./editor/FormaPresentacionIA";

type Estado = "inactivo" | "subiendo" | "error";

// Video de la lección. El alumno ve el reproductor (o, si todavía no hay
// video, un aviso honesto). La coach, además, sube, cambia o quita el video.
// Con `sinAdelantar`, el alumno puede regresar pero no brincar hacia adelante,
// y `alTerminar` avisa cuando llegó al final.
export default function VideoLeccion({
  leccion,
  numero,
  sinAdelantar = false,
  alTerminar,
}: {
  leccion: Leccion;
  /** Número de la lección dentro del curso (lo que ve el alumno, no su código interno). */
  numero?: number;
  sinAdelantar?: boolean;
  alTerminar?: () => void;
}) {
  const { recargarCurso, datos, coachAqui } = useApp();
  const esCoach = coachAqui;
  const [estado, setEstado] = useState<Estado>("inactivo");
  const [progreso, setProgreso] = useState(0);
  const [archivoEnCurso, setArchivoEnCurso] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  // Hasta dónde llegó viéndolo de corrido; adelantar más allá regresa aquí.
  const visto = useRef(0);
  const terminado = useRef(false);
  const [avisoAdelantar, setAvisoAdelantar] = useState(false);
  const subida = useRef<XMLHttpRequest | null>(null);
  const [generando, setGenerando] = useState(false);
  // Recién generada: se le pide a la coach que la revise y elija si lleva voz.
  const [recienGenerada, setRecienGenerada] = useState(false);
  // La coach dice cómo quiere la presentación antes de generarla, y luego la edita.
  const [pidiendo, setPidiendo] = useState(false);
  const [editando, setEditando] = useState(false);

  // Presentación con IA (diapositivas narradas por la voz del dispositivo).
  const generarPresentacion = async (opciones: OpcionesPresentacion) => {
    setPidiendo(false);
    setGenerando(true);
    setMensaje(null);
    setEstado("inactivo");
    setAnuncio("Generando la presentación con IA.");
    const res = await fetch(`/api/presentaciones/${leccion.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opciones),
    }).catch(
      () => null,
    );
    setGenerando(false);
    if (!res?.ok) {
      const datos = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
      return fallo(datos.error ?? "No se pudo generar la presentación. Revisa tu conexión e inténtalo de nuevo.");
    }
    await recargarCurso();
    setRecienGenerada(true);
    setAnuncio("Presentación lista. Mírala y elige si lleva voz.");
  };

  const quitarPresentacion = async () => {
    const res = await fetch(`/api/presentaciones/${leccion.id}`, { method: "DELETE" }).catch(
      () => null,
    );
    if (!res?.ok) return fallo("No se pudo quitar la presentación. Inténtalo de nuevo.");
    await recargarCurso();
    setAnuncio("Presentación quitada.");
  };

  const fallo = (texto: string) => {
    setEstado("error");
    setMensaje(texto);
    setAnuncio(texto);
  };

  const subir = (archivo: File) => {
    const tipo = tipoDeVideo(archivo.name, archivo.type);
    if (!tipo) return fallo("Ese archivo no es un video MP4, WebM o MOV.");
    if (archivo.size > MAX_BYTES_VIDEO) {
      return fallo(
        `El video pesa ${tamañoLegible(archivo.size)} y el máximo es ${tamañoLegible(MAX_BYTES_VIDEO)}. Expórtalo en menor calidad o recórtalo.`,
      );
    }
    // XMLHttpRequest en vez de fetch: es la única forma de mostrar el avance de una subida.
    const xhr = new XMLHttpRequest();
    subida.current = xhr;
    xhr.open("PUT", `/api/videos/${leccion.id}`);
    xhr.setRequestHeader("Content-Type", tipo);
    xhr.setRequestHeader("X-Nombre-Archivo", encodeURIComponent(archivo.name));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgreso(e.loaded / e.total);
    };
    xhr.onload = async () => {
      subida.current = null;
      if (xhr.status >= 200 && xhr.status < 300) {
        await recargarCurso();
        setEstado("inactivo");
        setMensaje(null);
        setAnuncio("Video subido. Ya se puede ver en la lección.");
      } else {
        let texto: string | undefined;
        try {
          texto = (JSON.parse(xhr.responseText) as { error?: string }).error;
        } catch {
          // respuesta sin JSON
        }
        fallo(texto ?? "No se pudo subir el video. Inténtalo de nuevo.");
      }
    };
    xhr.onerror = () => {
      subida.current = null;
      fallo("Se cortó la conexión mientras subía el video. Revisa tu internet e inténtalo de nuevo.");
    };
    xhr.onabort = () => {
      subida.current = null;
      setEstado("inactivo");
      setAnuncio("Subida cancelada.");
    };
    setConfirmandoQuitar(false);
    setMensaje(null);
    setProgreso(0);
    setArchivoEnCurso(archivo.name);
    setEstado("subiendo");
    setAnuncio(`Subiendo ${archivo.name}.`);
    xhr.send(archivo);
  };

  const quitar = async () => {
    const res = await fetch(`/api/videos/${leccion.id}`, {
      method: "DELETE",
    }).catch(() => null);
    setConfirmandoQuitar(false);
    if (!res?.ok) return fallo("No se pudo quitar el video. Inténtalo de nuevo.");
    await recargarCurso();
    setAnuncio("Video quitado. La lección sigue con su texto y transcripción.");
  };

  const alSoltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastrando(false);
    const archivo = e.dataTransfer.files[0];
    if (archivo && estado !== "subiendo") subir(archivo);
  };

  const selector = esCoach && (
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
  );

  const avisoLector = (
    <p className="sr-only" role="status" aria-live="polite">
      {anuncio}
    </p>
  );

  const avance = estado === "subiendo" && (
    <div className="subida">
      <div
        className="progreso"
        role="progressbar"
        aria-label={`Subiendo ${archivoEnCurso}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progreso * 100)}
      >
        <span style={{ transform: `scaleX(${progreso})` }} />
      </div>
      <p className="subida-texto">
        <span>
          Subiendo <strong>{archivoEnCurso}</strong>
        </span>
        <span className="cifra">{Math.round(progreso * 100)}%</span>
      </p>
      <button type="button" className="enlace enlace-discreto" onClick={() => subida.current?.abort()}>
        Cancelar subida
      </button>
    </div>
  );

  const error = estado === "error" && mensaje && (
    <p className="error" role="alert">
      {mensaje}
    </p>
  );

  // ---------------------------------------------------------------- con video
  if (leccion.video && estado !== "subiendo") {
    return (
      <figure className="video-leccion">
        <video
          key={leccion.video.url}
          className="video-reproductor"
          controls
          preload="metadata"
          playsInline
          src={leccion.video.url}
          poster={posterDeVideo(numero ? `Lección ${numero}` : "Lección", leccion.titulo, acentoSobreOscuro(datos?.comunidad.marca?.color))}
          aria-label={`Video de la lección «${leccion.titulo}»`}
          onLoadedMetadata={() => {
            visto.current = 0;
            terminado.current = false;
            setAvisoAdelantar(false);
          }}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            // Solo cuenta lo que avanzó reproduciéndose, no un salto.
            const paso = Math.max(2, v.playbackRate * 0.75);
            if (!v.seeking && v.currentTime <= visto.current + paso) visto.current = Math.max(visto.current, v.currentTime);
            if (!terminado.current && v.duration && visto.current >= v.duration - 1) {
              terminado.current = true;
              alTerminar?.();
            }
          }}
          onSeeking={(e) => {
            const v = e.currentTarget;
            if (sinAdelantar && v.currentTime > visto.current + 1) {
              v.currentTime = visto.current;
              setAvisoAdelantar(true);
            }
          }}
          onRateChange={(e) => {
            // Hasta 2x: más rápido ya no es ver el video.
            if (sinAdelantar && e.currentTarget.playbackRate > 2) e.currentTarget.playbackRate = 2;
          }}
          onEnded={(e) => {
            if (!terminado.current && (!sinAdelantar || visto.current >= e.currentTarget.duration - 2)) {
              terminado.current = true;
              alTerminar?.();
            }
          }}
        >
          Tu navegador no puede reproducir este video. La transcripción está al final de la lección.
        </video>
        {sinAdelantar && (
          <p className="video-aviso texto-suave" role="status">
            {avisoAdelantar
              ? "Este video no se puede adelantar: sigue desde donde te quedaste."
              : "Mira el video completo para desbloquear el repaso de esta lección."}
          </p>
        )}
        {esCoach && (
          <figcaption className="video-coach">
            {selector}
            <span className="video-archivo texto-suave">
              {leccion.video.nombre} · subido el {fechaCorta(leccion.video.subidoEn)}
            </span>
            {confirmandoQuitar ? (
              <span className="confirmacion" role="group" aria-label="Confirmar que quitas el video">
                <span>¿Quitar el video? La lección se queda con su texto y transcripción.</span>
                <button type="button" className="boton boton-chico" onClick={quitar}>
                  Quitar video
                </button>
                <button type="button" className="boton boton-chico boton-fantasma" onClick={() => setConfirmandoQuitar(false)}>
                  Conservarlo
                </button>
              </span>
            ) : (
              <span className="video-coach-acciones">
                <button type="button" className="boton boton-chico boton-secundario" onClick={() => entrada.current?.click()}>
                  <IconoSubir width={16} height={16} /> Cambiar video
                </button>
                <button type="button" className="enlace enlace-discreto" onClick={() => setConfirmandoQuitar(true)}>
                  Quitar video
                </button>
              </span>
            )}
            {error}
          </figcaption>
        )}
        {avisoLector}
      </figure>
    );
  }

  // ---------------------------------------------------------------- sin video, con presentación
  if (leccion.presentacion && estado !== "subiendo" && !generando) {
    return (
      <div className="video-leccion">
        <PresentacionLeccion
          idLeccion={leccion.id}
          numero={numero}
          diapositivas={leccion.presentacion.diapositivas}
          conVoz={leccion.presentacion.conVoz}
          sinAdelantar={sinAdelantar}
          alTerminar={alTerminar}
        />
        {esCoach && (
          <EleccionVoz
            leccion={leccion.id}
            conVoz={leccion.presentacion.conVoz}
            recien={recienGenerada}
            alCambiar={async () => {
              setRecienGenerada(false);
              await recargarCurso();
            }}
          />
        )}
        {esCoach && (
          <div className="video-coach">
            {selector}
            <span className="video-archivo texto-suave">
              Presentación con IA · {leccion.presentacion.diapositivas.length} diapositivas · {fechaCorta(leccion.presentacion.creadaEn)}
            </span>
            <span className="video-coach-acciones">
              <button type="button" className="boton boton-chico boton-secundario" onClick={() => entrada.current?.click()}>
                <IconoSubir width={16} height={16} /> Subir un video
              </button>
              <button type="button" className="boton boton-chico boton-fantasma-borde" onClick={() => setEditando(true)}>
                Editar presentación
              </button>
              <button type="button" className="enlace" onClick={() => setPidiendo(!pidiendo)} aria-expanded={pidiendo}>
                Volver a generar
              </button>
              <button type="button" className="enlace enlace-discreto" onClick={quitarPresentacion}>
                Quitar presentación
              </button>
            </span>
            {error}
          </div>
        )}
        {esCoach && pidiendo && (
          <FormaPresentacionIA
            inicial={leccion.presentacion.opciones}
            generando={generando}
            alGenerar={(o) => void generarPresentacion(o)}
            alCancelar={() => setPidiendo(false)}
          />
        )}
        {esCoach && editando && (
          <EditorPresentacion
            leccion={leccion.id}
            inicial={leccion.presentacion.diapositivas}
            alCerrar={() => setEditando(false)}
            alGuardar={recargarCurso}
          />
        )}
        {avisoLector}
      </div>
    );
  }

  // ---------------------------------------------------------------- sin video, alumno
  if (!esCoach) {
    // Las lecciones que la coach pega desde su panel son de texto: sin aviso de video.
    if (leccion.deCoach) return null;
    return (
      <div className="video">
        <p className="video-titulo">Esta lección todavía no tiene video</p>
        <p className="video-texto">Todo lo que dice está escrito abajo y en su transcripción.</p>
      </div>
    );
  }

  // ---------------------------------------------------------------- sin video (o subiendo), coach
  return (
    <div
      className="video video-subir"
      data-arrastrando={arrastrando}
      data-pidiendo={pidiendo}
      onDragOver={(e) => {
        e.preventDefault();
        if (estado !== "subiendo") setArrastrando(true);
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={alSoltar}
    >
      {selector}
      {estado === "subiendo" ? (
        <>
          <p className="video-titulo">{leccion.video ? "Cambiando el video de esta lección" : "Subiendo el video de esta lección"}</p>
          {avance}
        </>
      ) : pidiendo ? (
        <FormaPresentacionIA generando={generando} alGenerar={(o) => void generarPresentacion(o)} alCancelar={() => setPidiendo(false)} />
      ) : generando ? (
        <>
          <p className="video-titulo">Generando la presentación…</p>
          <div className="progreso progreso-indeterminado" aria-hidden="true">
            <span />
          </div>
          <p className="video-texto">La IA arma las diapositivas con el texto de la lección. Suele tardar unos segundos.</p>
        </>
      ) : (
        <>
          <p className="video-titulo">Sube el video de esta lección</p>
          <p className="video-texto">
            <span className="solo-escritorio">Arrástralo aquí o elígelo de tu computadora. </span>
            <span className="solo-movil">Elígelo de tu celular. </span>
            MP4, WebM o MOV, hasta 250 MB.
          </p>
          <div className="video-subir-acciones">
            <button type="button" className="boton" onClick={() => entrada.current?.click()}>
              <IconoSubir width={18} height={18} /> Elegir video
            </button>
            <button type="button" className="boton boton-fantasma-borde" onClick={() => setPidiendo(true)}>
              <IconoAsistenteGeneral width={18} height={18} /> Generar presentación con IA
            </button>
          </div>
          <p className="video-texto">
            ¿Sin video todavía? La IA arma diapositivas con el texto de la lección y la voz del dispositivo las narra.
          </p>
          {error}
          <p className="nota video-nota-prototipo">
            En el prototipo el video se guarda en la computadora donde corre la plataforma, no en internet.
          </p>
        </>
      )}
      {avisoLector}
    </div>
  );
}
