"use client";

import { CaretLeft, CaretRight, ClosedCaptioning, Pause, Play } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Diapositiva } from "@/lib/tipos";

// Presentación narrada de una lección: diapositivas de marca y la voz del
// dispositivo (Web Speech API) leyendo la narración de cada una, frase por
// frase (algunos navegadores cortan las frases largas). Si el dispositivo no
// tiene voz, avanza sola al ritmo de lectura con los subtítulos a la vista.
// Con `sinAdelantar`, el alumno puede regresar pero no saltar a una
// diapositiva que todavía no escuchó; `alTerminar` avisa al llegar al final.

const VELOCIDADES = [1, 1.25, 1.5, 2];

/** Parte la narración en frases para que la voz no se corte. */
const frasesDe = (texto: string) =>
  texto
    .split(/(?<=[.!?…])\s+/)
    .map((f) => f.trim())
    .filter(Boolean);

/** Voz en español: primero de México, luego de EE. UU. (latina), luego cualquiera. */
function vozEnEspañol(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voces = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("es"));
  const de = (lang: string) => voces.find((v) => v.lang.toLowerCase().replace("_", "-") === lang);
  return de("es-mx") ?? de("es-us") ?? de("es-419") ?? voces.find((v) => v.localService) ?? voces[0] ?? null;
}

export default function PresentacionLeccion({
  idLeccion,
  numero,
  diapositivas,
  conVoz = true,
  sinAdelantar = false,
  alTerminar,
}: {
  idLeccion: string;
  /** Número de la lección en el curso, para la etiqueta ("Lección 2 · 1 de 4"). */
  numero?: number;
  diapositivas: Diapositiva[];
  /** La coach decide si la presentación lleva voz; sin voz avanza al ritmo de lectura. */
  conVoz?: boolean;
  sinAdelantar?: boolean;
  alTerminar?: () => void;
}) {
  const total = diapositivas.length;
  const [indice, setIndice] = useState(0);
  // Hasta qué diapositiva ya se escuchó (no se puede saltar más allá).
  const [alcanzada, setAlcanzada] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [empezo, setEmpezo] = useState(false);
  const [terminada, setTerminada] = useState(false);
  const [velocidad, setVelocidad] = useState(1);
  const [subtitulos, setSubtitulos] = useState(true);
  const [sinVoz, setSinVoz] = useState(false);
  const silencio = !conVoz;
  const [frase, setFrase] = useState(0);

  // Cada arranque lleva un número: lo que avise una voz ya cancelada se ignora.
  const turno = useRef(0);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avisado = useRef(false);
  const estado = useRef({ indice, velocidad, sinVoz: sinVoz || silencio });
  estado.current = { indice, velocidad, sinVoz: sinVoz || silencio };

  const detener = useCallback(() => {
    turno.current++;
    if (reloj.current) clearTimeout(reloj.current);
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  // Al salir de la lección (o cambiar de presentación) se calla.
  useEffect(() => detener, [detener, idLeccion]);
  useEffect(() => {
    setIndice(0);
    setAlcanzada(0);
    setReproduciendo(false);
    setEmpezo(false);
    setTerminada(false);
    setFrase(0);
    avisado.current = false;
  }, [idLeccion]);

  // Cargar las voces (en Chrome llegan después del primer momento).
  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      setSinVoz(true);
      return;
    }
    const revisar = () => window.speechSynthesis.getVoices();
    revisar();
    window.speechSynthesis.addEventListener?.("voiceschanged", revisar);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", revisar);
  }, []);

  const terminar = useCallback(() => {
    setReproduciendo(false);
    setTerminada(true);
    setAlcanzada(total - 1);
    if (!avisado.current) {
      avisado.current = true;
      alTerminar?.();
    }
  }, [alTerminar, total]);

  // Narra la diapositiva `i` desde la frase `desde`; al acabar pasa a la siguiente.
  const narrar = useCallback(
    (i: number, desde = 0) => {
      detener();
      const mio = ++turno.current;
      const frases = frasesDe(diapositivas[i].narracion);
      const { velocidad: v, sinVoz: sinV } = estado.current;

      const alAcabar = () => {
        if (mio !== turno.current) return;
        if (i < total - 1) {
          setIndice(i + 1);
          setAlcanzada((a) => Math.max(a, i + 1));
          setFrase(0);
          narrar(i + 1, 0);
        } else terminar();
      };

      // Sin voz: avanza al ritmo de lectura (~2.6 palabras por segundo).
      const leer = (k: number) => {
        if (mio !== turno.current) return;
        if (k >= frases.length) return alAcabar();
        setFrase(k);
        const palabras = frases[k].split(/\s+/).length;
        reloj.current = setTimeout(() => leer(k + 1), Math.max(1200, (palabras / 2.6 / v) * 1000));
      };
      if (sinV) return leer(desde);

      const voz = vozEnEspañol();
      const decir = (k: number) => {
        if (mio !== turno.current) return;
        if (k >= frases.length) return alAcabar();
        setFrase(k);
        const u = new SpeechSynthesisUtterance(frases[k]);
        u.lang = voz?.lang ?? "es-MX";
        if (voz) u.voice = voz;
        u.rate = v;
        let arranco = false;
        u.onstart = () => {
          arranco = true;
        };
        u.onend = () => decir(k + 1);
        u.onerror = (e) => {
          if (e.error === "interrupted" || e.error === "canceled") return;
          decir(k + 1);
        };
        window.speechSynthesis.speak(u);
        // Si la voz no arranca (dispositivo sin voces), se sigue al ritmo de lectura.
        reloj.current = setTimeout(() => {
          if (!arranco && mio === turno.current) {
            window.speechSynthesis.cancel();
            setSinVoz(true);
            estado.current.sinVoz = true;
            leer(k);
          }
        }, 2500);
      };
      decir(desde);
    },
    [detener, diapositivas, terminar, total],
  );

  // Si la coach cambia la voz mientras se reproduce, sigue desde la misma frase.
  const conVozAntes = useRef(conVoz);
  useEffect(() => {
    if (conVozAntes.current === conVoz) return;
    conVozAntes.current = conVoz;
    if (conVoz === false) setSubtitulos(true);
    if (reproduciendo) narrar(indice, frase);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar la voz
  }, [conVoz]);

  const reproducir = () => {
    setEmpezo(true);
    if (terminada) {
      setTerminada(false);
      setIndice(0);
      setFrase(0);
      setReproduciendo(true);
      return narrar(0, 0);
    }
    setReproduciendo(true);
    narrar(indice, frase);
  };

  const pausar = () => {
    detener();
    setReproduciendo(false);
  };

  const ir = (i: number) => {
    if (i < 0 || i >= total) return;
    if (sinAdelantar && i > alcanzada) return;
    setIndice(i);
    setFrase(0);
    setTerminada(false);
    if (reproduciendo) narrar(i, 0);
    else detener();
  };

  const cambiarVelocidad = (v: number) => {
    setVelocidad(v);
    estado.current.velocidad = v;
    if (reproduciendo) narrar(indice, frase);
  };

  const d = diapositivas[indice];
  const frasesActuales = frasesDe(d.narracion);
  const puedeSiguiente = indice < total - 1 && (!sinAdelantar || indice < alcanzada);

  return (
    <figure className="presentacion-leccion" aria-label="Presentación de la lección">
      <div className="presentacion-escena" aria-live="polite">
        <p className="presentacion-escena-etiqueta">
          {numero ? (
            <>
              Lección <span className="cifra">{numero}</span> ·{" "}
            </>
          ) : null}
          <span className="cifra">{indice + 1}</span> de <span className="cifra">{total}</span>
        </p>
        <h3 className="presentacion-escena-titulo">{d.titulo}</h3>
        {d.puntos.length > 0 && (
          <ul className="presentacion-escena-puntos">
            {d.puntos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <svg className="presentacion-escena-flecha" viewBox="0 0 120 80" aria-hidden="true" focusable="false">
          <polyline points="6,70 44,40 66,52 110,12" />
          <polyline points="88,12 110,12 110,34" />
        </svg>
        {!empezo && (
          <button type="button" className="presentacion-empezar" onClick={reproducir}>
            <Play weight="fill" aria-hidden="true" /> Reproducir presentación
          </button>
        )}
      </div>

      {subtitulos && empezo && (
        <p className="presentacion-subtitulo" aria-hidden="true">
          {frasesActuales[Math.min(frase, frasesActuales.length - 1)]}
        </p>
      )}

      <div className="presentacion-controles">
        <button
          type="button"
          className="presentacion-control"
          onClick={() => ir(indice - 1)}
          disabled={indice === 0}
          aria-label="Diapositiva anterior"
        >
          <CaretLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          className="presentacion-control presentacion-control-principal"
          onClick={reproduciendo ? pausar : reproducir}
          aria-label={reproduciendo ? "Pausar" : terminada ? "Ver de nuevo" : "Reproducir"}
        >
          {reproduciendo ? <Pause weight="fill" aria-hidden="true" /> : <Play weight="fill" aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="presentacion-control"
          onClick={() => ir(indice + 1)}
          disabled={!puedeSiguiente}
          aria-label="Diapositiva siguiente"
          title={sinAdelantar && !puedeSiguiente && indice < total - 1 ? "Escucha esta diapositiva para seguir" : undefined}
        >
          <CaretRight aria-hidden="true" />
        </button>

        <div className="presentacion-avance" role="group" aria-label="Diapositivas">
          {diapositivas.map((x, i) => (
            <button
              key={i}
              type="button"
              className="presentacion-punto"
              aria-current={i === indice ? "step" : undefined}
              data-vista={i <= alcanzada}
              disabled={sinAdelantar && i > alcanzada}
              onClick={() => ir(i)}
              aria-label={`Diapositiva ${i + 1}: ${x.titulo}`}
            />
          ))}
        </div>

        <label className="presentacion-velocidad">
          <span className="sr-only">Velocidad</span>
          <select value={velocidad} onChange={(e) => cambiarVelocidad(Number(e.target.value))}>
            {VELOCIDADES.map((v) => (
              <option key={v} value={v}>
                {v}x
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="presentacion-control"
          aria-pressed={subtitulos}
          onClick={() => setSubtitulos(!subtitulos)}
          aria-label="Subtítulos"
          title="Subtítulos"
        >
          <ClosedCaptioning aria-hidden="true" />
        </button>
      </div>

      <figcaption className="presentacion-nota texto-suave">
        {sinVoz
          ? "Tu dispositivo no tiene voz en español: la presentación avanza sola al ritmo de lectura."
          : silencio
            ? "Presentación sin voz: avanza sola al ritmo de lectura."
            : "Narrada con la voz de tu dispositivo."}
        {sinAdelantar &&
          !terminada &&
          (sinVoz || silencio ? " Mírala completa para desbloquear el repaso." : " Escúchala completa para desbloquear el repaso.")}
      </figcaption>

      {/* Para lectores de pantalla: la narración completa de la diapositiva actual. */}
      <p className="sr-only">{d.narracion}</p>
    </figure>
  );
}
