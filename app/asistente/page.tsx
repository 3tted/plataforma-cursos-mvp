"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Avatar from "@/components/Avatar";
import { useApp, type MensajeChat } from "@/components/Contexto";
import { IconoAsistente, IconoAsistenteGeneral, IconoDetener, IconoEnviar } from "@/components/Iconos";
import Markdown from "@/components/Markdown";
import { useTitulo } from "@/components/useTitulo";
import { preguntarAlAsistente } from "@/lib/cliente";

// Asistente general de Merkatics: una IA para cualquier duda, separada del
// asistente del curso (que responde solo con las lecciones y las cita).
const SUGERENCIAS = [
  "Escríbeme un mensaje amable para cobrarle a un cliente que se atrasó",
  "Dame 5 ideas para promocionar mi negocio en redes sociales",
  "¿Cómo organizo mi semana si atiendo el negocio yo sola?",
];

export default function PaginaAsistenteGeneral() {
  const { usuario, estado, chatGeneral: chat, setChatGeneral: setChat } = useApp();
  const [entrada, setEntrada] = useState("");
  const [enCurso, setEnCurso] = useState(false);
  // Un solo aviso para lectores de pantalla, en vez de anunciar cada fragmento de la respuesta.
  const [anuncio, setAnuncio] = useState("");
  const control = useRef<AbortController | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  // "Empezar de nuevo" se puede deshacer unos segundos: borrar no pide confirmación.
  const [borrada, setBorrada] = useState<MensajeChat[] | null>(null);
  useTitulo("Asistente Merkatics");

  const actualizarUltimo = useCallback(
    (cambio: Partial<MensajeChat>) =>
      setChat((mensajes) => {
        const copia = [...mensajes];
        copia[copia.length - 1] = { ...copia[copia.length - 1], ...cambio };
        return copia;
      }),
    [setChat],
  );

  const enviar = useCallback(
    async (pregunta: string) => {
      const limpia = pregunta.trim();
      if (!limpia || enCurso) return;
      const historial = chat
        .filter((m) => m.estado !== "error" && m.content.trim())
        .map(({ role, content }) => ({ role, content }));
      setChat((m) => [
        ...m,
        { role: "user", content: limpia },
        { role: "assistant", content: "", estado: "escribiendo" },
      ]);
      setEntrada("");
      setEnCurso(true);
      setAnuncio("El asistente está respondiendo…");
      const abortar = new AbortController();
      control.current = abortar;
      let texto = "";
      try {
        const { modo } = await preguntarAlAsistente(
          { tipo: "general", pregunta: limpia, historial },
          abortar.signal,
          (parcial, modoParcial) => {
            texto = parcial;
            actualizarUltimo({ content: parcial, modo: modoParcial });
          },
        );
        actualizarUltimo({ content: texto, estado: "listo", modo });
        setAnuncio("Respuesta lista.");
      } catch (e) {
        if (abortar.signal.aborted) {
          actualizarUltimo({ content: texto, estado: "detenido" });
          setAnuncio("Respuesta detenida.");
        } else {
          const mensaje =
            e instanceof TypeError
              ? "No pudimos conectar con el asistente. Revisa tu conexión e inténtalo de nuevo."
              : (e as Error).message;
          actualizarUltimo({ content: mensaje, estado: "error" });
          setAnuncio(mensaje);
        }
      } finally {
        setEnCurso(false);
        control.current = null;
      }
    },
    [chat, enCurso, setChat, actualizarUltimo],
  );

  // Al preguntar, la pregunta sube al inicio de la vista y la respuesta se lee debajo.
  const cantidad = chat.length;
  useEffect(() => {
    const ultimaPregunta = chat.findLastIndex((m) => m.role === "user");
    if (ultimaPregunta < 0) return;
    document.getElementById(`mensaje-${ultimaPregunta}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Depende solo de la cantidad: corre al agregar una pregunta, no con cada fragmento.
  }, [cantidad]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!borrada) return;
    const t = setTimeout(() => setBorrada(null), 10000);
    return () => clearTimeout(t);
  }, [borrada]);

  const empezarDeNuevo = () => {
    setBorrada(chat);
    setChat([]);
    setAnuncio("Conversación borrada.");
    campo.current?.focus();
  };

  const deshacer = () => {
    if (borrada) setChat(borrada);
    setBorrada(null);
    setAnuncio("Conversación recuperada.");
  };

  const reintentar = (indiceError: number) => {
    const pregunta = chat[indiceError - 1]?.content;
    if (!pregunta) return;
    setChat((m) => m.slice(0, indiceError - 1));
    void enviar(pregunta);
  };

  const alEnviar = (e: FormEvent) => {
    e.preventDefault();
    void enviar(entrada);
  };

  const alTeclear = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void enviar(entrada);
    }
  };

  return (
    <div className="pagina-asistente">
      <header className="asistente-cabecera">
        <div className="cabecera-pagina">
          <h1>Asistente Merkatics</h1>
          <p className="texto-suave">Pregúntale lo que quieras: ideas, mensajes, explicaciones o cómo organizarte.</p>
          <p className="asistente-otro">
            ¿Tu duda es de una lección? <Link href="/curso/asistente">Vuelve al asistente del curso</Link>
          </p>
        </div>
        {estado && !estado.iaActiva && <span className="pastilla">IA sin conectar</span>}
      </header>

      <p className="sr-only" role="status" aria-live="polite">
        {anuncio}
      </p>

      <div className="conversacion">
        {chat.length === 0 && (
          <div className="chat-vacio">
            <span className="chat-vacio-icono">
              <IconoAsistenteGeneral width={28} height={28} />
            </span>
            <p>
              Soy una IA de uso general: te ayudo a redactar, a pensar ideas para tu negocio o a entender un tema. No
              uso el contenido de los cursos; para dudas de una lección está el asistente del curso, que responde con
              las lecciones y las cita.
            </p>
            <div className="sugerencias">
              {SUGERENCIAS.map((q) => (
                <button key={q} type="button" className="sugerencia" onClick={() => void enviar(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {chat.map((m, i) =>
          m.role === "user" ? (
            <div key={i} id={`mensaje-${i}`} className="mensaje mensaje-usuario">
              <p>{m.content}</p>
              <Avatar nombre={usuario?.nombre ?? "Tú"} tamaño={30} />
            </div>
          ) : (
            <div key={i} id={`mensaje-${i}`} className="mensaje mensaje-asistente" data-estado={m.estado}>
              <span className="mensaje-autor">
                <IconoAsistenteGeneral width={15} height={15} /> Asistente Merkatics
              </span>
              {m.estado === "escribiendo" && !m.content ? (
                <p className="pensando" aria-label="El asistente está pensando">
                  <span />
                  <span />
                  <span />
                </p>
              ) : m.estado === "error" ? (
                <div className="error chat-aviso">
                  <span>{m.content}</span>
                  {!enCurso && (
                    <button type="button" className="boton boton-chico boton-secundario" onClick={() => reintentar(i)}>
                      Reintentar
                    </button>
                  )}
                </div>
              ) : (
                <Markdown texto={m.content} className="prosa prosa-chat" conFuentes />
              )}
              {m.estado === "detenido" && <p className="nota">Respuesta detenida.</p>}
            </div>
          ),
        )}
      </div>

      <div className="chat-dock">
        <form className="chat-entrada" onSubmit={alEnviar}>
          <textarea
            id="chat-general-pregunta"
            ref={campo}
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={alTeclear}
            placeholder="Escribe lo que necesites…"
            maxLength={1000}
            rows={2}
            aria-label="Tu pregunta"
          />
          {enCurso ? (
            <button type="button" className="boton" onClick={() => control.current?.abort()}>
              <IconoDetener width={16} height={16} /> Detener
            </button>
          ) : (
            <button
              type="submit"
              className="boton"
              disabled={!entrada.trim()}
              title={entrada.trim() ? undefined : "Escribe una pregunta para enviarla"}
            >
              <IconoEnviar width={16} height={16} /> Enviar
            </button>
          )}
        </form>
      </div>
      {borrada && chat.length === 0 && (
        <p className="nota nota-centro">
          Conversación borrada.{" "}
          <button type="button" className="enlace" onClick={deshacer}>
            Deshacer
          </button>
        </p>
      )}
      {chat.length > 0 && !enCurso && (
        <p className="nota nota-centro">
          <button type="button" className="enlace" onClick={empezarDeNuevo}>
            Empezar una conversación nueva
          </button>
          {" · "}
          <Link href="/curso/asistente" className="enlace">
            <IconoAsistente width={14} height={14} /> Ir al asistente del curso
          </Link>
        </p>
      )}
    </div>
  );
}
