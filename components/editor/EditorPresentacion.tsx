"use client";

import { ArrowDown, ArrowUp, Plus, SpeakerHigh, Stop, Trash, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { duracionNarracion, enMinutos, frasesDe, palabrasDe, vozEnEspañol } from "@/lib/narracion";
import type { Diapositiva } from "@/lib/tipos";
import { IconoAsistenteGeneral } from "../Iconos";

const MAX_DIAPOSITIVAS = 12;

// Así se edita: los puntos van como texto, un renglón por punto (si fueran
// lista, el Enter para empezar un renglón nuevo se perdería al escribir).
type Borrador = { clave: string; titulo: string; puntos: string; narracion: string };

let siguienteClave = 0;
const nuevaClave = () => `d${++siguienteClave}`;

const aBorrador = (d: Diapositiva): Borrador => ({
  clave: nuevaClave(),
  titulo: d.titulo,
  puntos: d.puntos.join("\n"),
  narracion: d.narracion,
});

const aDiapositiva = (b: Borrador): Diapositiva => ({
  titulo: b.titulo.trim(),
  puntos: b.puntos
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 4),
  narracion: b.narracion.trim(),
});

// Editor de la presentación con IA de una lección: a la izquierda las
// diapositivas (con su duración), a la derecha cómo se ve la elegida y sus
// campos. Se puede reordenar, agregar, borrar, escuchar cada diapositiva y
// rehacer una sola con la IA. Nada se guarda hasta "Guardar cambios".
export default function EditorPresentacion({
  leccion,
  inicial,
  alCerrar,
  alGuardar,
}: {
  leccion: string;
  inicial: Diapositiva[];
  alCerrar: () => void;
  alGuardar: () => void | Promise<void>;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [lista, setLista] = useState<Borrador[]>(() => inicial.map(aBorrador));
  const [original] = useState(() => JSON.stringify(inicial));
  const [elegida, setElegida] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [indicacion, setIndicacion] = useState("");
  const [rehaciendo, setRehaciendo] = useState(false);
  const [escuchando, setEscuchando] = useState(false);

  const d = lista[Math.min(elegida, lista.length - 1)];
  const cambiado = JSON.stringify(lista.map(aDiapositiva)) !== original;
  const total = lista.reduce((s, b) => s + duracionNarracion(b.narracion), 0);

  useEffect(() => {
    const el = dialogo.current;
    if (el && !el.open) el.showModal();
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const callar = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setEscuchando(false);
  };

  const cerrar = () => {
    if (cambiado && !window.confirm("Tienes cambios sin guardar en la presentación. ¿Salir sin guardarlos?")) return;
    callar();
    alCerrar();
  };

  const cambiar = (campo: keyof Omit<Borrador, "clave">, valor: string) =>
    setLista((l) => l.map((b, i) => (i === elegida ? { ...b, [campo]: valor } : b)));

  const elegir = (i: number) => {
    callar();
    setElegida(i);
    setIndicacion("");
    setError(null);
  };

  const mover = (paso: -1 | 1) => {
    const destino = elegida + paso;
    if (destino < 0 || destino >= lista.length) return;
    setLista((l) => {
      const copia = [...l];
      [copia[elegida], copia[destino]] = [copia[destino], copia[elegida]];
      return copia;
    });
    setElegida(destino);
  };

  const agregar = () => {
    if (lista.length >= MAX_DIAPOSITIVAS) return;
    const nueva: Borrador = { clave: nuevaClave(), titulo: "Nueva diapositiva", puntos: "", narracion: "" };
    setLista((l) => [...l.slice(0, elegida + 1), nueva, ...l.slice(elegida + 1)]);
    elegir(elegida + 1);
  };

  const borrar = () => {
    if (lista.length <= 1) return;
    if (!window.confirm(`¿Borrar la diapositiva ${elegida + 1}, «${d.titulo || "sin título"}»?`)) return;
    callar();
    setLista((l) => l.filter((_, i) => i !== elegida));
    setElegida((i) => Math.max(0, Math.min(i, lista.length - 2)));
  };

  // Escuchar la diapositiva con la misma voz que oirán los alumnos, frase por frase.
  const escuchar = () => {
    if (escuchando) return callar();
    if (!("speechSynthesis" in window)) return setError("Este navegador no tiene voz para escucharla.");
    const frases = frasesDe(d.narracion);
    if (frases.length === 0) return;
    const voz = vozEnEspañol();
    window.speechSynthesis.cancel();
    frases.forEach((f, k) => {
      const u = new SpeechSynthesisUtterance(f);
      u.lang = voz?.lang ?? "es-MX";
      if (voz) u.voice = voz;
      if (k === frases.length - 1) u.onend = () => setEscuchando(false);
      u.onerror = (e) => {
        if (e.error !== "interrupted" && e.error !== "canceled") setEscuchando(false);
      };
      window.speechSynthesis.speak(u);
    });
    setEscuchando(true);
  };

  const rehacer = async () => {
    callar();
    setRehaciendo(true);
    setError(null);
    const res = await fetch(`/api/presentaciones/${leccion}/diapositiva`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diapositivas: lista.map(aDiapositiva), indice: elegida, indicacion }),
    }).catch(() => null);
    setRehaciendo(false);
    const datos = res ? ((await res.json().catch(() => ({}))) as { diapositiva?: Diapositiva; error?: string }) : null;
    if (!res?.ok || !datos?.diapositiva) {
      return setError(datos?.error ?? "No se pudo rehacer la diapositiva. Revisa tu conexión e inténtalo de nuevo.");
    }
    const nueva = aBorrador(datos.diapositiva);
    setLista((l) => l.map((b, i) => (i === elegida ? { ...nueva, clave: b.clave } : b)));
    setIndicacion("");
  };

  const guardar = async () => {
    const faltan = lista.flatMap((b, i) => [
      ...(b.titulo.trim() ? [] : [`La diapositiva ${i + 1} necesita un título.`]),
      ...(b.narracion.trim() ? [] : [`La diapositiva ${i + 1} necesita lo que dice la voz.`]),
    ]);
    if (faltan.length) return setError(faltan.join(" "));
    callar();
    setGuardando(true);
    setError(null);
    const res = await fetch(`/api/presentaciones/${leccion}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diapositivas: lista.map(aDiapositiva) }),
    }).catch(() => null);
    if (!res?.ok) {
      setGuardando(false);
      const datos = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
      return setError(datos.error ?? "No se pudieron guardar los cambios. Revisa tu conexión e inténtalo de nuevo.");
    }
    await alGuardar();
    setGuardando(false);
    alCerrar();
  };

  const vista = aDiapositiva(d);
  const palabras = palabrasDe(d.narracion);

  return (
    <dialog
      ref={dialogo}
      className="editor-presentacion"
      aria-labelledby="editor-presentacion-titulo"
      onCancel={(e) => {
        e.preventDefault();
        cerrar();
      }}
    >
      <header className="editor-presentacion-cabecera">
        <div>
          <h2 id="editor-presentacion-titulo">Editar presentación</h2>
          <p className="texto-suave">
            <span className="cifra">{lista.length}</span> {lista.length === 1 ? "diapositiva" : "diapositivas"} ·{" "}
            <span className="cifra">{enMinutos(total)}</span> en total
          </p>
        </div>
        <div className="editor-presentacion-acciones">
          <button type="button" className="boton boton-chico boton-fantasma" onClick={cerrar} disabled={guardando}>
            Cancelar
          </button>
          <button type="button" className="boton boton-chico" onClick={() => void guardar()} disabled={!cambiado || guardando || rehaciendo}>
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
          <button type="button" className="editor-presentacion-cerrar" onClick={cerrar} aria-label="Cerrar">
            <X aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="editor-presentacion-cuerpo">
        <nav className="editor-presentacion-lista" aria-label="Diapositivas">
          <ol>
            {lista.map((b, i) => (
              <li key={b.clave}>
                <button type="button" aria-current={i === elegida ? "true" : undefined} onClick={() => elegir(i)}>
                  <span className="editor-presentacion-numero cifra">{i + 1}</span>
                  <span className="editor-presentacion-nombre">{b.titulo.trim() || "Sin título"}</span>
                  <span className="editor-presentacion-dura cifra">{enMinutos(duracionNarracion(b.narracion))}</span>
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="editor-presentacion-agregar" onClick={agregar} disabled={lista.length >= MAX_DIAPOSITIVAS}>
            <Plus aria-hidden="true" /> Agregar diapositiva
          </button>
        </nav>

        <section className="editor-presentacion-detalle" aria-label={`Diapositiva ${elegida + 1}`}>
          {/* Cómo se ve: la misma escena del reproductor, sin controles. */}
          <div className="presentacion-escena editor-presentacion-vista" aria-hidden="true">
            <div className="presentacion-diapositiva">
              <p className="presentacion-escena-etiqueta">
                <span className="cifra">{elegida + 1}</span> de <span className="cifra">{lista.length}</span>
              </p>
              <h3 className="presentacion-escena-titulo">{vista.titulo || "Sin título"}</h3>
              {vista.puntos.length > 0 && (
                <ul className="presentacion-escena-puntos">
                  {vista.puntos.map((p, k) => (
                    <li key={k}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="editor-presentacion-herramientas">
            <button type="button" className="boton boton-chico boton-fantasma-borde" onClick={escuchar} disabled={!d.narracion.trim()}>
              {escuchando ? <Stop aria-hidden="true" /> : <SpeakerHigh aria-hidden="true" />} {escuchando ? "Detener" : "Escuchar"}
            </button>
            <span className="editor-presentacion-espacio" />
            <button type="button" className="editor-presentacion-icono" onClick={() => mover(-1)} disabled={elegida === 0} aria-label="Subir diapositiva">
              <ArrowUp aria-hidden="true" />
            </button>
            <button
              type="button"
              className="editor-presentacion-icono"
              onClick={() => mover(1)}
              disabled={elegida === lista.length - 1}
              aria-label="Bajar diapositiva"
            >
              <ArrowDown aria-hidden="true" />
            </button>
            <button
              type="button"
              className="editor-presentacion-icono"
              onClick={borrar}
              disabled={lista.length <= 1}
              aria-label="Borrar diapositiva"
            >
              <Trash aria-hidden="true" />
            </button>
          </div>

          <label className="campo">
            <span>Título</span>
            <input value={d.titulo} maxLength={80} onChange={(e) => cambiar("titulo", e.target.value)} />
          </label>
          <label className="campo">
            <span>Puntos en pantalla (uno por renglón, hasta 4)</span>
            <textarea rows={4} value={d.puntos} onChange={(e) => cambiar("puntos", e.target.value)} />
          </label>
          <label className="campo">
            <span>Lo que dice la voz</span>
            <textarea rows={7} maxLength={2000} value={d.narracion} onChange={(e) => cambiar("narracion", e.target.value)} />
            <span className="nota cifra">
              {palabras} {palabras === 1 ? "palabra" : "palabras"} · dura {enMinutos(duracionNarracion(d.narracion))}
            </span>
          </label>

          <div className="editor-presentacion-rehacer">
            <label className="campo">
              <span>Rehacer esta diapositiva con IA</span>
              <input
                value={indicacion}
                maxLength={500}
                onChange={(e) => setIndicacion(e.target.value)}
                placeholder="Opcional: más corta, con el ejemplo del menú, más motivadora…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!rehaciendo) void rehacer();
                  }
                }}
              />
            </label>
            <button type="button" className="boton boton-chico boton-secundario" onClick={() => void rehacer()} disabled={rehaciendo}>
              <IconoAsistenteGeneral width={16} height={16} /> {rehaciendo ? "Rehaciendo…" : "Rehacer"}
            </button>
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
    </dialog>
  );
}
