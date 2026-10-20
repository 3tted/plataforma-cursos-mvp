"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Avatar from "@/components/Avatar";
import { useApp, type MensajeChat } from "@/components/Contexto";
import { IconoAsistente, IconoCerrar, IconoComunidad, IconoDetener, IconoEnviar } from "@/components/Iconos";
import Markdown from "@/components/Markdown";
import { useTitulo } from "@/components/useTitulo";
import { preguntarAlAsistente } from "@/lib/cliente";

export default function PaginaAsistenteCurso() {
  const router = useRouter();
  const {
    datos,
    lecciones,
    usuario,
    estado,
    chat,
    setChat,
    leccionContexto,
    setLeccionContexto,
    preguntaPendiente,
    setPreguntaPendiente,
    setBorrador,
    tieneAcceso,
    cursoId,
    comunidadId,
  } = useApp();
  const [entrada, setEntrada] = useState("");
  const [enCurso, setEnCurso] = useState(false);
  // Un solo aviso para lectores de pantalla, en vez de anunciar cada fragmento de la respuesta.
  const [anuncio, setAnuncio] = useState("");
  const control = useRef<AbortController | null>(null);
  const ultimaPendiente = useRef<string | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  // "Empezar de nuevo" se puede deshacer unos segundos: borrar no pide confirmación.
  const [borrada, setBorrada] = useState<MensajeChat[] | null>(null);
  useTitulo("Asistente del curso");

  const leccion = lecciones.find((l) => l.id === leccionContexto);

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
        { role: "user", content: limpia, leccion: leccionContexto },
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
          { pregunta: limpia, historial, leccion: leccionContexto, miembro: tieneAcceso, curso: cursoId },
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
          // Un fallo de red llega como TypeError: se explica en palabras del alumno.
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
    [chat, enCurso, leccionContexto, usuario, tieneAcceso, cursoId, setChat, actualizarUltimo],
  );

  // Pregunta que llega desde otra página (una lección o la comunidad).
  useEffect(() => {
    if (!preguntaPendiente || !datos || ultimaPendiente.current === preguntaPendiente) return;
    ultimaPendiente.current = preguntaPendiente;
    setPreguntaPendiente(null);
    void enviar(preguntaPendiente);
  }, [preguntaPendiente, datos, enviar, setPreguntaPendiente]);

  // Al preguntar, la pregunta sube al inicio de la vista y la respuesta se lee debajo,
  // en vez de perseguir el final del texto mientras llega.
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

  const llevarAComunidad = (pregunta: string) => {
    setBorrador({
      categoria: "Dudas",
      titulo: pregunta.length > 140 ? pregunta.slice(0, 137) + "…" : pregunta,
      cuerpo: `${pregunta}\n\n(Se lo pregunté al asistente del curso, pero me gustaría la opinión de la coach y de la comunidad.)`,
    });
    router.push(`/c/${comunidadId}`);
  };

  // Sin membresía, las sugerencias salen de las lecciones gratis: así la primera
  // pregunta de prueba recibe una respuesta completa, no un "es para miembros".
  const sugerenciasGratis = lecciones
    .filter((l) => l.gratis && !l.deCoach)
    .map((l) => l.preguntas_sugeridas[0])
    .filter(Boolean);
  const sugerencias = leccion?.preguntas_sugeridas.length
    ? leccion.preguntas_sugeridas
    : tieneAcceso
      ? (datos?.curso.preguntas_sugeridas ?? [])
      : sugerenciasGratis;

  return (
    <div className="pagina-asistente">
      <header className="asistente-cabecera">
        <div className="cabecera-pagina">
          <h1>Asistente del curso</h1>
          <p className="texto-suave">
            Pregunta lo que quieras sobre las lecciones.
            {estado && !estado.iaActiva && " En esta demostración responde con fragmentos del curso, sin redactar."}
          </p>
          <p className="asistente-otro">
            ¿Tu duda no es del curso? <Link href="/asistente">Usa el asistente general</Link>
          </p>
        </div>
        {estado && !estado.iaActiva && <span className="pastilla">Modo demostración</span>}
      </header>

      <p className="sr-only" role="status" aria-live="polite">
        {anuncio}
      </p>

      {leccion && (
        <div className="contexto-leccion">
          <span>
            Preguntando sobre <span className="cita-id">{leccion.id}</span> <strong>{leccion.titulo}</strong>
          </span>
          <button
            type="button"
            className="boton-icono boton-icono-chico"
            onClick={() => setLeccionContexto(null)}
            aria-label="Preguntar sobre todo el curso"
            title="Preguntar sobre todo el curso"
          >
            <IconoCerrar width={16} height={16} />
          </button>
        </div>
      )}

      <div className="conversacion">
        {chat.length === 0 && (
          <div className="chat-vacio">
            <span className="chat-vacio-icono">
              <IconoAsistente width={28} height={28} />
            </span>
            <p>
              Respondo con el contenido de las lecciones de <strong>{datos?.curso.titulo ?? "este curso"}</strong> y te
              digo de qué lección sale cada respuesta. Si algo no está en el curso, te lo digo y puedes llevar la
              pregunta a la comunidad.
            </p>
            <div className="sugerencias">
              {sugerencias.map((q) => (
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
                <IconoAsistente width={15} height={15} /> Asistente
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
              {(m.estado === "listo" || m.estado === "detenido") && chat[i - 1] && (
                <div className="mensaje-acciones">
                  <button
                    type="button"
                    className="accion"
                    onClick={() => llevarAComunidad(chat[i - 1].content)}
                  >
                    <IconoComunidad width={15} height={15} />
                    Llevar esta pregunta a la comunidad
                  </button>
                </div>
              )}
            </div>
          ),
        )}
      </div>

      <div className="chat-dock">
      <form className="chat-entrada" onSubmit={alEnviar}>
        <textarea
          id="chat-pregunta"
          ref={campo}
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          onKeyDown={alTeclear}
          placeholder={leccion ? `Pregunta sobre "${leccion.titulo}"…` : "Escribe tu pregunta…"}
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
          <Link href={leccion ? `/curso/${leccion.id}` : "/curso"} className="enlace">
            {leccion ? `Volver a «${leccion.titulo}»` : "Volver al curso"}
          </Link>
        </p>
      )}
    </div>
  );
}
