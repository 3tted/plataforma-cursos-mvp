"use client";

import { CornersIn, CornersOut, DotsThreeVertical, Pause, Play, SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { duracionDe, enMinutos, frasesDe, vozEnEspañol } from "@/lib/narracion";
import type { Diapositiva } from "@/lib/tipos";

// Presentación narrada de una lección: diapositivas de marca y la voz del
// dispositivo (Web Speech API) leyendo la narración de cada una, frase por
// frase (algunos navegadores cortan las frases largas). Si el dispositivo no
// tiene voz, avanza sola al ritmo de lectura con los subtítulos a la vista.
// Se maneja como un video: barra de avance, tiempo, volumen, pantalla
// completa y un menú con la velocidad y los subtítulos. El tiempo se calcula
// por las palabras de cada frase (la voz real puede variar un poco).
// Con `sinAdelantar`, el alumno puede regresar pero no saltar a una
// diapositiva que todavía no escuchó; `alTerminar` avisa al llegar al final.

const VELOCIDADES = [1, 1.25, 1.5, 2];

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
  const [silenciado, setSilenciado] = useState(false);
  const [menu, setMenu] = useState(false);
  const [completa, setCompleta] = useState(false);
  const escena = useRef<HTMLDivElement>(null);
  // Cuándo empezó la frase actual, para que la barra avance entre frase y frase.
  const marca = useRef(0);
  const [ahora, setAhora] = useState(0);

  // Cada arranque lleva un número: lo que avise una voz ya cancelada se ignora.
  const turno = useRef(0);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avisado = useRef(false);
  const estado = useRef({ indice, velocidad, sinVoz: sinVoz || silencio, silenciado });
  estado.current = { indice, velocidad, sinVoz: sinVoz || silencio, silenciado };

  // Duración calculada de cada frase y dónde empieza cada diapositiva.
  const tiempos = useMemo(() => {
    const frases = diapositivas.map((x) => frasesDe(x.narracion).map(duracionDe));
    const inicios: number[] = [];
    let suma = 0;
    for (const f of frases) {
      inicios.push(suma);
      suma += f.reduce((a, b) => a + b, 0);
    }
    return { frases, inicios, total: suma };
  }, [diapositivas]);

  const empezarFrase = useCallback((k: number) => {
    marca.current = Date.now();
    setAhora(marca.current);
    setFrase(k);
  }, []);

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
        empezarFrase(k);
        const palabras = frases[k].split(/\s+/).length;
        reloj.current = setTimeout(() => leer(k + 1), Math.max(1200, (palabras / 2.6 / v) * 1000));
      };
      if (sinV) return leer(desde);

      const voz = vozEnEspañol();
      const decir = (k: number) => {
        if (mio !== turno.current) return;
        if (k >= frases.length) return alAcabar();
        empezarFrase(k);
        const u = new SpeechSynthesisUtterance(frases[k]);
        u.lang = voz?.lang ?? "es-MX";
        if (voz) u.voice = voz;
        u.rate = v;
        // Silenciada sigue su ritmo, como un video sin sonido.
        u.volume = estado.current.silenciado ? 0 : 1;
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
    [detener, diapositivas, empezarFrase, terminar, total],
  );

  // Mientras se reproduce, la barra se mueve.
  useEffect(() => {
    if (!reproduciendo) return;
    const id = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(id);
  }, [reproduciendo]);

  // Pantalla completa: el ícono sigue lo que haga el navegador (también con Esc).
  useEffect(() => {
    const cambio = () => setCompleta(document.fullscreenElement === escena.current);
    document.addEventListener("fullscreenchange", cambio);
    return () => document.removeEventListener("fullscreenchange", cambio);
  }, []);

  // El menú se cierra al dar clic fuera o con Esc.
  useEffect(() => {
    if (!menu) return;
    const fuera = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest(".presentacion-menu, .presentacion-boton-menu")) setMenu(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [menu]);

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

  // Saltar a un momento de la barra: la diapositiva y la frase que tocan ahí.
  const buscar = (segundo: number) => {
    const finAlcanzada = tiempos.inicios[alcanzada] + tiempos.frases[alcanzada].reduce((a, b) => a + b, 0) - 0.01;
    const t = Math.max(0, Math.min(segundo, sinAdelantar ? finAlcanzada : tiempos.total));
    let i = 0;
    while (i < total - 1 && tiempos.inicios[i + 1] <= t) i++;
    let k = 0;
    let acumulado = tiempos.inicios[i];
    while (k < tiempos.frases[i].length - 1 && acumulado + tiempos.frases[i][k] <= t) acumulado += tiempos.frases[i][k++];
    setIndice(i);
    setTerminada(false);
    setEmpezo(true);
    if (reproduciendo) narrar(i, k);
    else {
      detener();
      empezarFrase(k);
    }
  };

  const cambiarSilencio = () => {
    const nuevo = !silenciado;
    setSilenciado(nuevo);
    estado.current.silenciado = nuevo;
    if (reproduciendo) narrar(indice, frase);
  };

  const pantallaCompleta = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void escena.current?.requestFullscreen?.();
  };

  const cambiarVelocidad = (v: number) => {
    setVelocidad(v);
    estado.current.velocidad = v;
    if (reproduciendo) narrar(indice, frase);
  };

  const d = diapositivas[indice];
  const frasesActuales = frasesDe(d.narracion);
  const conSonido = conVoz && !sinVoz;
  const duracionFrase = tiempos.frases[indice]?.[frase] ?? 0;
  const dentro = reproduciendo ? Math.min(duracionFrase, ((ahora - marca.current) / 1000) * velocidad) : 0;
  const transcurrido = terminada
    ? tiempos.total
    : tiempos.inicios[indice] + (tiempos.frases[indice]?.slice(0, frase).reduce((a, b) => a + b, 0) ?? 0) + dentro;
  const avance = tiempos.total ? (transcurrido / tiempos.total) * 100 : 0;

  return (
    <figure className="presentacion-leccion" aria-label="Presentación de la lección">
      <div className="presentacion-escena" ref={escena} data-completa={completa} data-cc={subtitulos && empezo}>
        <div className="presentacion-diapositiva" aria-live="polite">
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
        </div>
        <svg className="presentacion-escena-flecha" viewBox="0 0 120 80" aria-hidden="true" focusable="false">
          <polyline points="6,70 44,40 66,52 110,12" />
          <polyline points="88,12 110,12 110,34" />
        </svg>

        {subtitulos && empezo && (
          <p className="presentacion-cc" aria-hidden="true">
            <span>{frasesActuales[Math.min(frase, frasesActuales.length - 1)]}</span>
          </p>
        )}

        {!empezo && (
          <button type="button" className="presentacion-empezar" onClick={reproducir}>
            <Play weight="fill" aria-hidden="true" /> Reproducir presentación
          </button>
        )}

        {/* Controles como los de un video: arriba los botones, abajo la barra. */}
        <div className="presentacion-barra">
          <div className="presentacion-barra-fila">
            <button
              type="button"
              className="presentacion-boton"
              onClick={reproduciendo ? pausar : reproducir}
              aria-label={reproduciendo ? "Pausar" : terminada ? "Ver de nuevo" : "Reproducir"}
            >
              {reproduciendo ? <Pause weight="fill" aria-hidden="true" /> : <Play weight="fill" aria-hidden="true" />}
            </button>
            <span className="presentacion-tiempo cifra">
              {enMinutos(transcurrido)} / {enMinutos(tiempos.total)}
            </span>
            <span className="presentacion-barra-espacio" />
            {conSonido && (
              <button
                type="button"
                className="presentacion-boton"
                onClick={cambiarSilencio}
                aria-label={silenciado ? "Activar sonido" : "Silenciar"}
              >
                {silenciado ? <SpeakerSlash aria-hidden="true" /> : <SpeakerHigh aria-hidden="true" />}
              </button>
            )}
            <button
              type="button"
              className="presentacion-boton"
              onClick={pantallaCompleta}
              aria-label={completa ? "Salir de pantalla completa" : "Pantalla completa"}
            >
              {completa ? <CornersIn aria-hidden="true" /> : <CornersOut aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="presentacion-boton presentacion-boton-menu"
              onClick={() => setMenu(!menu)}
              aria-label="Más opciones"
              aria-expanded={menu}
            >
              <DotsThreeVertical weight="bold" aria-hidden="true" />
            </button>
          </div>
          <input
            type="range"
            className="presentacion-progreso"
            min={0}
            max={Math.max(1, Math.round(tiempos.total * 10) / 10)}
            step={0.1}
            value={Math.round(transcurrido * 10) / 10}
            onChange={(e) => buscar(Number(e.target.value))}
            aria-label="Avance de la presentación"
            aria-valuetext={`${enMinutos(transcurrido)} de ${enMinutos(tiempos.total)}`}
            style={{ "--avance": `${avance}%` } as CSSProperties}
          />
        </div>

        {menu && (
          <div className="presentacion-menu" role="group" aria-label="Opciones de la presentación">
            <p className="presentacion-menu-titulo">Velocidad</p>
            <div className="presentacion-menu-velocidades">
              {VELOCIDADES.map((v) => (
                <button key={v} type="button" aria-pressed={v === velocidad} onClick={() => cambiarVelocidad(v)}>
                  {v}x
                </button>
              ))}
            </div>
            <button
              type="button"
              className="presentacion-menu-opcion"
              aria-pressed={subtitulos}
              onClick={() => setSubtitulos(!subtitulos)}
            >
              Subtítulos <span>{subtitulos ? "Sí" : "No"}</span>
            </button>
          </div>
        )}
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
