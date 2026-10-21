"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { MAX_BYTES_VIDEO, reloj, tamañoLegible, tipoDeVideo } from "@/lib/reglas-video";
import { SubidaCancelada, medirDuracion, subirVideo, type SubidaDeVideo } from "@/lib/subir-video";
import type { CursoCreado } from "@/lib/tipos";
import { IconoAsistenteGeneral, IconoSubir } from "../Iconos";

/** Hasta dos horas: más que eso no cabe completo en lo que la IA puede ver y escribir de una vez. */
const MAX_SEGUNDOS = 2 * 60 * 60;
const BASE = "/api/coach/cursos/video";

type Paso = "elegir" | "subiendo" | "viendo" | "dividiendo" | "escribiendo" | "examen";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

// La coach sube una clase grabada y la IA arma el curso con ella: cada lección
// es un tramo del video, con sus apuntes y repaso. Al terminar
// abre el borrador en el editor. Si la IA falla, se reintenta sin volver a
// subir el video.
export default function CrearDesdeVideo({ comunidad, alCerrar }: { comunidad: string; alCerrar: () => void }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const subida = useRef<SubidaDeVideo | null>(null);
  const activo = useRef(true);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [duracion, setDuracion] = useState<number | null>(null);
  // El video ya subido (para reintentar sin volver a subirlo).
  const [fuente, setFuente] = useState<string | null>(null);
  const [indicaciones, setIndicaciones] = useState("");
  const [cantidades, setCantidades] = useState({ lecciones: "", repaso: "", examen: "" });
  const [paso, setPaso] = useState<Paso>("elegir");
  const [progreso, setProgreso] = useState(0);
  // Cuántas lecciones lleva escritas la IA.
  const [lecciones, setLecciones] = useState({ hechas: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    activo.current = true;
    return () => {
      activo.current = false;
      subida.current?.cancelar();
    };
  }, []);

  const soltar = (id: string | null) => {
    if (id) void fetch(`${BASE}?fuente=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  };

  const elegir = async (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!tipoDeVideo(f.name, f.type)) return setError("Ese archivo no es un video MP4, WebM o MOV.");
    if (f.size > MAX_BYTES_VIDEO) {
      return setError(`El video pesa ${tamañoLegible(f.size)} y el máximo es ${tamañoLegible(MAX_BYTES_VIDEO)}. Expórtalo en menor calidad.`);
    }
    const segundos = await medirDuracion(f);
    if (segundos !== null && segundos > MAX_SEGUNDOS) {
      return setError(`El video dura ${reloj(segundos)}. Para armar un curso, súbelo en partes de hasta 2 horas.`);
    }
    soltar(fuente);
    setFuente(null);
    setArchivo(f);
    setDuracion(segundos);
  };

  const cerrar = () => {
    subida.current?.cancelar();
    soltar(fuente);
    alCerrar();
  };

  /**
   * Llama hasta que el curso queda armado. Mientras tanto el servidor responde
   * 202 con lo que va: procesando el video, escribiendo las lecciones o el examen.
   */
  const armar = async (id: string) => {
    setPaso("viendo");
    let ultimo = "procesando";
    for (;;) {
      // Si una vuelta tarda justo después de procesar el video, es que ya está dividiendo la clase.
      const aviso = setTimeout(() => activo.current && ultimo === "procesando" && setPaso("dividiendo"), 12_000);
      const res = await fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fuente: id, comunidad, indicaciones, ...cantidades }),
      }).catch(() => null);
      clearTimeout(aviso);
      if (!activo.current) return;
      const datos = res
        ? ((await res.json().catch(() => ({}))) as Partial<CursoCreado> & {
            error?: string;
            aviso?: string | null;
            paso?: string;
            hechas?: number;
            total?: number;
          })
        : {};
      if (res?.status === 202) {
        ultimo = datos.paso ?? "procesando";
        if (ultimo === "procesando") {
          setPaso("viendo");
          await espera(5_000);
          if (!activo.current) return;
        } else {
          setLecciones({ hechas: datos.hechas ?? 0, total: datos.total ?? 0 });
          setPaso(ultimo === "examen" ? "examen" : "escribiendo");
        }
        continue;
      }
      if (!res?.ok || !datos.id) {
        setPaso("elegir");
        return setError(
          res ? (datos.error ?? "No se pudo armar el curso. Inténtalo de nuevo.") : "Se cortó la conexión mientras la IA trabajaba. Inténtalo de nuevo.",
        );
      }
      try {
        if (datos.aviso) sessionStorage.setItem(`fc.avisoIA.${datos.id}`, datos.aviso);
      } catch {
        // sin sessionStorage solo se pierde el aviso
      }
      router.push(`/coach/curso/${datos.id}`);
      return;
    }
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!archivo) return setError("Elige el video de tu clase.");
    for (const [clave, nombre, min, max] of [
      ["lecciones", "Las lecciones", 1, 30],
      ["repaso", "Las preguntas de repaso por lección", 0, 10],
      ["examen", "Las preguntas del examen", 1, 30],
    ] as const) {
      const v = cantidades[clave].trim();
      if (v === "") continue;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) return setError(`${nombre} van de ${min} a ${max}.`);
    }
    setError(null);
    if (fuente) return armar(fuente);

    const tipo = tipoDeVideo(archivo.name, archivo.type)!;
    setProgreso(0);
    setPaso("subiendo");
    const nueva = subirVideo({ base: BASE, enLaNube: "videos/fuente" }, archivo, tipo, setProgreso, duracion ?? undefined);
    subida.current = nueva;
    try {
      const { id } = (await nueva.listo) as { id: string };
      subida.current = null;
      if (!activo.current) return soltar(id);
      setFuente(id);
      await armar(id);
    } catch (err) {
      subida.current = null;
      if (!activo.current) return;
      setPaso("elegir");
      if (!(err instanceof SubidaCancelada)) setError((err as Error).message);
    }
  };

  if (paso !== "elegir") {
    const textos: Record<Exclude<Paso, "elegir">, string> = {
      subiendo: `Subiendo tu video… ${Math.round(progreso * 100)}%`,
      viendo: "La IA está viendo tu video…",
      dividiendo: "Dividiendo tu clase en lecciones…",
      escribiendo: `Escribiendo las lecciones: ${lecciones.hechas} de ${lecciones.total} listas…`,
      examen: "Armando el examen final…",
    };
    return (
      <div className="crear-ia crear-ia-trabajando" role="status" aria-live="polite">
        <IconoAsistenteGeneral width={26} height={26} />
        <p className="crear-ia-paso">{textos[paso]}</p>
        {paso === "subiendo" ? (
          <div className="progreso" aria-hidden="true">
            <span style={{ transform: `scaleX(${progreso})` }} />
          </div>
        ) : (
          <div className="progreso progreso-indeterminado" aria-hidden="true">
            <span />
          </div>
        )}
        <p className="nota">
          {paso === "subiendo"
            ? "No cierres esta página mientras sube."
            : "Un video de media hora suele tardar de 3 a 6 minutos. No cierres esta página: si algo falla, sigue donde se quedó."}
        </p>
        {paso === "subiendo" && (
          <button type="button" className="enlace enlace-discreto" onClick={() => subida.current?.cancelar()}>
            Cancelar subida
          </button>
        )}
      </div>
    );
  }

  return (
    <form className="crear-ia" onSubmit={enviar} noValidate>
      <div className="crear-ia-cabecera">
        <p className="agregar-curso-titulo">Crear un curso desde tu video</p>
        <button type="button" className="enlace enlace-discreto" onClick={cerrar}>
          Cancelar
        </button>
      </div>
      <p className="texto-suave">
        Sube una clase que grabaste. La IA la ve completa, la divide en lecciones (cada una con su tramo del video) y escribe
        los apuntes, el repaso y el examen. Tus alumnos te ven a ti explicando. Queda como borrador para que
        lo revises.
      </p>

      <div className="crear-ia-archivo">
        <input
          ref={entrada}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            void elegir(f);
          }}
        />
        <button type="button" className="boton boton-secundario" onClick={() => entrada.current?.click()}>
          <IconoSubir width={16} height={16} /> {archivo ? "Cambiar video" : "Elegir video"}
        </button>
        {archivo ? (
          <span className="crear-ia-nombre">
            {archivo.name}
            <span className="texto-suave cifra">
              {" "}
              · {duracion !== null ? `${reloj(duracion)} · ` : ""}
              {tamañoLegible(archivo.size)}
            </span>
          </span>
        ) : (
          <span className="nota">
            MP4, WebM o MOV, hasta {tamañoLegible(MAX_BYTES_VIDEO)} y 2 horas. Funciona mejor si hablas claro y vas tema por tema.
          </span>
        )}
      </div>

      <fieldset className="crear-ia-cantidades">
        <legend>¿Cuántas quieres? Déjalo vacío para que la IA lo decida según tu video.</legend>
        {(
          [
            ["lecciones", "Lecciones", 1, 30, "Auto"],
            ["repaso", "Preguntas de repaso por lección", 0, 10, "2"],
            ["examen", "Preguntas del examen", 1, 30, "Auto"],
          ] as const
        ).map(([clave, etiqueta, min, max, ejemplo]) => (
          <label key={clave} className="campo">
            <span>{etiqueta}</span>
            <input
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              value={cantidades[clave]}
              onChange={(e) => setCantidades({ ...cantidades, [clave]: e.target.value })}
              placeholder={ejemplo}
            />
          </label>
        ))}
      </fieldset>

      <label className="campo">
        <span>Otras indicaciones para la IA (opcional)</span>
        <input
          value={indicaciones}
          onChange={(e) => setIndicaciones(e.target.value)}
          maxLength={500}
          placeholder="Por ejemplo: deja fuera los primeros minutos de presentación"
        />
      </label>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="forma-acciones">
        <button type="submit" className="boton">
          <IconoAsistenteGeneral width={16} height={16} /> {fuente ? "Intentar de nuevo" : "Crear borrador con IA"}
        </button>
      </div>
    </form>
  );
}
