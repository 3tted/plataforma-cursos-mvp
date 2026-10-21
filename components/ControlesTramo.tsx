"use client";

import { CornersIn, CornersOut, Pause, Play, SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { useEffect, useState, type CSSProperties, type RefObject } from "react";
import { reloj } from "@/lib/reglas-video";

// Controles de una lección que es un tramo de un video más largo (curso
// armado desde un video): el tiempo y la barra son los de la lección, no los
// del video completo. Se ven igual que los de la presentación con IA. Los
// límites del tramo (no salirse, pausar al final) los cuida el <video>.
export default function ControlesTramo({
  video,
  marco,
  inicio,
  fin,
}: {
  video: HTMLVideoElement | null;
  /** Lo que va a pantalla completa (el video con estos controles). */
  marco: RefObject<HTMLDivElement | null>;
  inicio: number;
  fin: number;
}) {
  const largo = Math.max(fin - inicio, 1);
  const [actual, setActual] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [silenciado, setSilenciado] = useState(false);
  const [completa, setCompleta] = useState(false);

  useEffect(() => {
    if (!video) return;
    const poner = () => {
      setActual(Math.min(Math.max(video.currentTime - inicio, 0), largo));
      setReproduciendo(!video.paused);
      setSilenciado(video.muted);
    };
    const eventos = ["timeupdate", "play", "pause", "seeked", "volumechange", "loadedmetadata"];
    eventos.forEach((e) => video.addEventListener(e, poner));
    poner();
    return () => eventos.forEach((e) => video.removeEventListener(e, poner));
  }, [video, inicio, largo]);

  useEffect(() => {
    const cambio = () => setCompleta(document.fullscreenElement === marco.current);
    document.addEventListener("fullscreenchange", cambio);
    return () => document.removeEventListener("fullscreenchange", cambio);
  }, [marco]);

  const alternar = () => {
    if (!video) return;
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  };

  const pantallaCompleta = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void marco.current?.requestFullscreen?.();
  };

  const avance = (actual / largo) * 100;
  return (
    <div className="presentacion-barra video-tramo-barra">
      <div className="presentacion-barra-fila">
        <button
          type="button"
          className="presentacion-boton"
          onClick={alternar}
          aria-label={reproduciendo ? "Pausar" : actual >= largo - 0.5 ? "Ver de nuevo" : "Reproducir"}
        >
          {reproduciendo ? <Pause weight="fill" aria-hidden="true" /> : <Play weight="fill" aria-hidden="true" />}
        </button>
        <span className="presentacion-tiempo cifra">
          {reloj(actual)} / {reloj(largo)}
        </span>
        <span className="presentacion-barra-espacio" />
        <button
          type="button"
          className="presentacion-boton"
          onClick={() => video && (video.muted = !video.muted)}
          aria-label={silenciado ? "Activar sonido" : "Silenciar"}
        >
          {silenciado ? <SpeakerSlash aria-hidden="true" /> : <SpeakerHigh aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="presentacion-boton"
          onClick={pantallaCompleta}
          aria-label={completa ? "Salir de pantalla completa" : "Pantalla completa"}
        >
          {completa ? <CornersIn aria-hidden="true" /> : <CornersOut aria-hidden="true" />}
        </button>
      </div>
      <input
        type="range"
        className="presentacion-progreso"
        min={0}
        max={Math.round(largo * 10) / 10}
        step={0.1}
        value={Math.round(actual * 10) / 10}
        onChange={(e) => {
          if (video) video.currentTime = inicio + Number(e.target.value);
        }}
        aria-label="Avance de la lección"
        aria-valuetext={`${reloj(actual)} de ${reloj(largo)}`}
        style={{ "--avance": `${avance}%` } as CSSProperties}
      />
    </div>
  );
}
