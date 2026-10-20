"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { preguntarAlAsistente } from "@/lib/cliente";
import { useApp, type MensajeChat } from "./Contexto";
import { IconoAsistente, IconoCerrar, IconoEnviar } from "./Iconos";
import Markdown from "./Markdown";

// Respuesta del asistente del curso en el mismo lugar donde surgió la duda
// (por ejemplo, debajo de una pregunta del repaso), sin salir de la lección.
// Empieza con `pregunta` y deja seguir preguntando. La conversación es solo
// de este recuadro; la pregunta sí queda registrada para la coach.
export default function AsistenteEnLinea({
  pregunta,
  resumen,
  leccion,
  alCerrar,
}: {
  pregunta: string;
  /** Cómo se muestra la primera pregunta (la completa lleva el contexto del repaso). */
  resumen: string;
  leccion: string;
  alCerrar: () => void;
}) {
  const { tieneAcceso, cursoId } = useApp();
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [entrada, setEntrada] = useState("");
  const [enCurso, setEnCurso] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  const control = useRef<AbortController | null>(null);
  const iniciada = useRef(false);

  const enviar = async (texto: string, historial: MensajeChat[]) => {
    const abortar = new AbortController();
    control.current = abortar;
    setEnCurso(true);
    setAnuncio("El asistente está respondiendo…");
    setMensajes([...historial, { role: "user", content: texto }, { role: "assistant", content: "", estado: "escribiendo" }]);
    const actualizar = (cambio: Partial<MensajeChat>) =>
      setMensajes((lista) => [...lista.slice(0, -1), { ...lista[lista.length - 1], ...cambio }]);
    try {
      const { texto: respuesta, modo } = await preguntarAlAsistente(
        {
          pregunta: texto,
          historial: historial.filter((m) => m.estado !== "error").map(({ role, content }) => ({ role, content })),
          leccion,
          miembro: tieneAcceso,
          curso: cursoId,
        },
        abortar.signal,
        (parcial, modoParcial) => actualizar({ content: parcial, modo: modoParcial }),
      );
      actualizar({ content: respuesta, estado: "listo", modo });
      setAnuncio("Respuesta lista.");
    } catch (e) {
      if (abortar.signal.aborted) return;
      const mensaje =
        e instanceof TypeError
          ? "No pudimos conectar con el asistente. Revisa tu conexión e inténtalo de nuevo."
          : (e as Error).message;
      actualizar({ content: mensaje, estado: "error" });
      setAnuncio(mensaje);
    } finally {
      setEnCurso(false);
      control.current = null;
    }
  };

  // La primera pregunta sale sola al abrir el recuadro (una vez, aunque React lo monte dos veces en desarrollo).
  useEffect(() => {
    if (iniciada.current) return;
    iniciada.current = true;
    void enviar(pregunta, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seguir = (e: FormEvent) => {
    e.preventDefault();
    const limpia = entrada.trim();
    if (!limpia || enCurso) return;
    setEntrada("");
    void enviar(limpia, mensajes);
  };

  const cerrar = () => {
    control.current?.abort();
    alCerrar();
  };

  return (
    <section className="asistente-en-linea" aria-label="Respuesta del asistente del curso">
      <div className="asistente-en-linea-cabecera">
        <p>
          <IconoAsistente width={16} height={16} /> Asistente del curso
        </p>
        <button type="button" className="boton-icono boton-icono-chico" onClick={cerrar} aria-label="Cerrar la respuesta del asistente">
          <IconoCerrar width={16} height={16} />
        </button>
      </div>

      <ol className="asistente-en-linea-mensajes">
        {mensajes.map((m, i) =>
          m.role === "user" ? (
            <li key={i} className="asistente-en-linea-pregunta">
              {i === 0 ? resumen : m.content}
            </li>
          ) : (
            <li key={i} className="asistente-en-linea-respuesta" data-estado={m.estado}>
              {m.estado === "error" ? (
                <p className="error">{m.content}</p>
              ) : m.content ? (
                <Markdown texto={m.content} className="prosa prosa-chat" conFuentes />
              ) : (
                <p className="texto-suave">Escribiendo…</p>
              )}
            </li>
          ),
        )}
      </ol>

      <form className="pregunta-rapida" onSubmit={seguir}>
        <input
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder="¿Otra duda sobre esto?"
          maxLength={1000}
          aria-label="Otra pregunta para el asistente"
          disabled={enCurso}
        />
        <button type="submit" className="boton-icono" aria-label="Preguntar" disabled={!entrada.trim() || enCurso}>
          <IconoEnviar />
        </button>
      </form>

      <p className="sr-only" role="status" aria-live="polite">
        {anuncio}
      </p>
    </section>
  );
}
