"use client";

import { useEffect, useRef, useState } from "react";
import { api, fechaCorta } from "@/lib/cliente";
import { ACEPTA_PRACTICA, extensionAceptada, MAX_BYTES_PRACTICA, MAX_TEXTO_PRACTICA } from "@/lib/reglas-practica";
import { tamañoLegible } from "@/lib/reglas-video";
import type { EntregaVista, Leccion } from "@/lib/tipos";
import { useApp } from "./Contexto";
import { IconoSubir } from "./Iconos";

// Práctica de una lección, solo si la coach la activó: el alumno escribe sus
// notas o respuestas y, si la lección lo permite, sube un archivo. El equipo
// de la empresa ve aquí las entregas de sus alumnos. `alCambiar` avisa si ya
// hay entrega (para las prácticas obligatorias).
export default function PracticaLeccion({
  leccion,
  alCambiar,
}: {
  leccion: Leccion & { practica: NonNullable<Leccion["practica"]> };
  alCambiar?: (entregada: boolean) => void;
}) {
  const { usuario, pedirEntrada } = useApp();
  const { practica } = leccion;
  const [cargando, setCargando] = useState(true);
  const [equipo, setEquipo] = useState(false);
  const [entregas, setEntregas] = useState<EntregaVista[]>([]);
  const [entrega, setEntrega] = useState<EntregaVista | null>(null);
  const [notas, setNotas] = useState("");
  const [ocupado, setOcupado] = useState<"notas" | "archivo" | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const selector = useRef<HTMLInputElement>(null);
  const avisar = useRef(alCambiar);
  avisar.current = alCambiar;

  useEffect(() => {
    if (!usuario) {
      setCargando(false);
      return;
    }
    let vigente = true;
    setCargando(true);
    api<{ equipo: boolean; entregas?: EntregaVista[]; entrega?: EntregaVista | null }>(
      `/api/practica?leccion=${encodeURIComponent(leccion.id)}`,
    )
      .then((r) => {
        if (!vigente) return;
        setEquipo(r.equipo);
        setEntregas(r.entregas ?? []);
        setEntrega(r.entrega ?? null);
        setNotas(r.entrega?.texto ?? "");
      })
      .catch((e: Error) => vigente && setMensaje({ tipo: "error", texto: e.message }))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [leccion.id, usuario]);

  useEffect(() => {
    if (!cargando && !equipo) avisar.current?.(!!entrega);
  }, [cargando, equipo, entrega]);

  const guardarNotas = async () => {
    setMensaje(null);
    setOcupado("notas");
    try {
      const r = await api<{ entrega: EntregaVista }>("/api/practica", {
        method: "POST",
        json: { leccion: leccion.id, texto: notas },
      });
      setEntrega(r.entrega);
      setMensaje({ tipo: "ok", texto: "Tu práctica quedó guardada." });
    } catch (e) {
      setMensaje({ tipo: "error", texto: (e as Error).message });
    } finally {
      setOcupado(null);
    }
  };

  const subir = async (archivo: File) => {
    setMensaje(null);
    if (!extensionAceptada(archivo.name)) {
      setMensaje({ tipo: "error", texto: "Sube un PDF, Word, Excel, PowerPoint, JPG o PNG." });
      return;
    }
    if (archivo.size > MAX_BYTES_PRACTICA) {
      setMensaje({ tipo: "error", texto: `El archivo pesa ${tamañoLegible(archivo.size)}; el máximo es 4 MB.` });
      return;
    }
    setOcupado("archivo");
    try {
      const r = await api<{ entrega: EntregaVista }>(`/api/practica?leccion=${encodeURIComponent(leccion.id)}`, {
        method: "PUT",
        headers: { "x-nombre-archivo": encodeURIComponent(archivo.name) },
        body: archivo,
      });
      setEntrega(r.entrega);
      setMensaje({ tipo: "ok", texto: "Tu archivo quedó guardado." });
    } catch (e) {
      setMensaje({ tipo: "error", texto: (e as Error).message });
    } finally {
      setOcupado(null);
      if (selector.current) selector.current.value = "";
    }
  };

  const quitarArchivo = async () => {
    if (!window.confirm("¿Quitar tu archivo de la práctica?")) return;
    setMensaje(null);
    setOcupado("archivo");
    try {
      const r = await api<{ entrega: EntregaVista | null }>(`/api/practica?leccion=${encodeURIComponent(leccion.id)}`, {
        method: "DELETE",
      });
      setEntrega(r.entrega);
    } catch (e) {
      setMensaje({ tipo: "error", texto: (e as Error).message });
    } finally {
      setOcupado(null);
    }
  };

  const encabezado = (
    <header className="practica-encabezado">
      <h2>
        Práctica{practica.obligatoria && <span className="practica-etiqueta">Para completar la lección</span>}
      </h2>
      <p>{practica.instrucciones}</p>
    </header>
  );

  if (!usuario) {
    return (
      <section className="practica" aria-label="Práctica de la lección">
        {encabezado}
        <p className="texto-suave">
          <button type="button" className="enlace" onClick={() => pedirEntrada("alumno")}>
            Entra a tu cuenta
          </button>{" "}
          para entregar tu práctica.
        </p>
      </section>
    );
  }

  if (cargando) {
    return (
      <section className="practica" aria-label="Práctica de la lección" aria-busy="true">
        {encabezado}
        <p className="texto-suave">Cargando tu práctica…</p>
      </section>
    );
  }

  // ---------------------------------------------------------------- equipo de la empresa
  if (equipo) {
    return (
      <section className="practica" aria-label="Prácticas de tus alumnos">
        {encabezado}
        <h3 className="practica-subtitulo">
          Entregas de tus alumnos <span className="cifra">{entregas.length}</span>
        </h3>
        {entregas.length === 0 ? (
          <p className="texto-suave">Todavía nadie entrega esta práctica.</p>
        ) : (
          <ul className="practica-entregas">
            {entregas.map((e) => (
              <li key={e.id}>
                <p className="practica-autor">
                  <strong>{e.autor}</strong> <span className="texto-suave">· {fechaCorta(e.actualizadaEn)}</span>
                  {e.porRevisar && <span className="practica-etiqueta">Por revisar</span>}
                </p>
                {e.texto && <p className="practica-texto">{e.texto}</p>}
                {e.archivo && <ArchivoEntregado archivo={e.archivo} />}
                <ComentarEntrega
                  entrega={e}
                  alGuardar={(nueva) => setEntregas((lista) => lista.map((x) => (x.id === nueva.id ? nueva : x)))}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  // ---------------------------------------------------------------- alumno
  const cambiada = notas.trim() !== (entrega?.texto ?? "");
  return (
    <section className="practica" aria-label="Práctica de la lección">
      {encabezado}
      <label className="campo">
        <span>Tus notas o respuestas</span>
        <textarea
          rows={6}
          value={notas}
          maxLength={MAX_TEXTO_PRACTICA}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Escribe aquí tu práctica."
        />
      </label>

      {practica.archivo && (
        <div className="practica-archivo">
          {entrega?.archivo ? (
            <>
              <ArchivoEntregado archivo={entrega.archivo} />
              <button type="button" className="enlace" onClick={quitarArchivo} disabled={!!ocupado}>
                Quitar
              </button>
            </>
          ) : (
            <span className="texto-suave">Puedes adjuntar un PDF, Word, Excel, PowerPoint o foto (hasta 4 MB).</span>
          )}
          <input
            ref={selector}
            type="file"
            accept={ACEPTA_PRACTICA}
            hidden
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) void subir(archivo);
            }}
          />
          <button type="button" className="boton boton-fantasma" onClick={() => selector.current?.click()} disabled={!!ocupado}>
            <IconoSubir width={16} height={16} />
            {ocupado === "archivo" ? "Subiendo…" : entrega?.archivo ? "Cambiar archivo" : "Subir archivo"}
          </button>
        </div>
      )}

      <div className="practica-acciones">
        <button type="button" className="boton" onClick={guardarNotas} disabled={!!ocupado || !cambiada || !notas.trim()}>
          {ocupado === "notas" ? "Guardando…" : entrega ? "Guardar cambios" : "Entregar práctica"}
        </button>
        {entrega && (
          <span className="texto-suave practica-estado">Entregada · última vez {fechaCorta(entrega.actualizadaEn)}</span>
        )}
      </div>
      {mensaje && (
        <p className={mensaje.tipo === "error" ? "error" : "practica-ok"} role={mensaje.tipo === "error" ? "alert" : "status"}>
          {mensaje.texto}
        </p>
      )}
      {entrega?.respuesta && (
        <div className="practica-respuesta">
          <p className="practica-autor">
            <strong>Comentario de {entrega.respuesta.autor}</strong>{" "}
            <span className="texto-suave">· {fechaCorta(entrega.respuesta.fecha)}</span>
          </p>
          <p className="practica-texto">{entrega.respuesta.texto}</p>
        </div>
      )}
    </section>
  );
}

// El comentario del equipo a una entrega: se escribe y se guarda ahí mismo.
function ComentarEntrega({ entrega, alGuardar }: { entrega: EntregaVista; alGuardar: (e: EntregaVista) => void }) {
  const [texto, setTexto] = useState(entrega.respuesta?.texto ?? "");
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

  const guardar = async () => {
    setError("");
    setOcupado(true);
    try {
      const r = await api<{ entrega: EntregaVista }>("/api/practica", { method: "PATCH", json: { id: entrega.id, respuesta: texto } });
      alGuardar(r.entrega);
      setAbierto(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  if (!abierto) {
    return (
      <div className="practica-respuesta">
        {entrega.respuesta && (
          <>
            <p className="practica-autor">
              <strong>Tu comentario</strong> <span className="texto-suave">· {fechaCorta(entrega.respuesta.fecha)}</span>
            </p>
            <p className="practica-texto">{entrega.respuesta.texto}</p>
          </>
        )}
        <button type="button" className="enlace" onClick={() => setAbierto(true)}>
          {entrega.respuesta ? "Cambiar mi comentario" : "Comentarle"}
        </button>
      </div>
    );
  }
  return (
    <div className="practica-respuesta">
      <label className="campo">
        <span>Tu comentario para {entrega.autor}</span>
        <textarea rows={3} value={texto} maxLength={2000} onChange={(e) => setTexto(e.target.value)} />
      </label>
      <div className="practica-acciones">
        <button type="button" className="boton" onClick={guardar} disabled={ocupado || !texto.trim()}>
          {ocupado ? "Guardando…" : "Enviar comentario"}
        </button>
        <button type="button" className="enlace" onClick={() => setAbierto(false)} disabled={ocupado}>
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

function ArchivoEntregado({ archivo }: { archivo: NonNullable<EntregaVista["archivo"]> }) {
  return (
    <a className="practica-descarga" href={archivo.url} target="_blank" rel="noopener">
      {archivo.nombre} <span className="texto-suave">({tamañoLegible(archivo.bytes)})</span>
    </a>
  );
}
