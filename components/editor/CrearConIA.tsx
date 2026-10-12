"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CursoCreado } from "@/lib/tipos";
import { IconoAsistenteGeneral, IconoSubir } from "../Iconos";

const MAX_BYTES = 4 * 1024 * 1024;
const ACEPTA = ".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

// Pasos que se muestran mientras la IA trabaja (es una sola petición; solo
// orientan a la coach sobre lo que está pasando).
const PASOS = ["Leyendo tu documento…", "Ordenando los temas en módulos…", "Escribiendo las lecciones…", "Armando el repaso y el examen…"];

// Formulario para que la IA proponga un curso a partir de un documento de la
// coach. Al terminar abre el borrador en el editor.
export default function CrearConIA({ autor, comunidad, alCerrar }: { autor: string; comunidad: string; alCerrar: () => void }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [pegar, setPegar] = useState(false);
  const [texto, setTexto] = useState("");
  const [indicaciones, setIndicaciones] = useState("");
  // Vacío = que la IA lo decida según el documento.
  const [cantidades, setCantidades] = useState({ lecciones: "", repaso: "", examen: "" });
  const [trabajando, setTrabajando] = useState(false);
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!trabajando) return;
    setPaso(0);
    const reloj = setInterval(() => setPaso((p) => Math.min(p + 1, PASOS.length - 1)), 12_000);
    return () => clearInterval(reloj);
  }, [trabajando]);

  const elegir = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!/\.(pdf|docx|txt|md)$/i.test(f.name)) {
      setArchivo(null);
      return setError(/\.doc$/i.test(f.name) ? "Los Word antiguos (.doc) no se pueden leer. Guárdalo como .docx o PDF." : "Sube un PDF, un Word (.docx) o un archivo de texto.");
    }
    if (f.size > MAX_BYTES) {
      setArchivo(null);
      return setError("El documento pesa más de 4 MB. Prueba con uno más ligero o pega el texto.");
    }
    setArchivo(f);
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (pegar ? texto.trim().length < 200 : !archivo) {
      return setError(pegar ? "Pega al menos un par de párrafos de tu material." : "Elige el documento con tu material.");
    }
    // Las cantidades se revisan aquí (con un mensaje claro) y no con el globito del navegador.
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
    const forma = new FormData();
    forma.set("autor", autor);
    forma.set("comunidad", comunidad);
    forma.set("indicaciones", indicaciones);
    for (const [k, v] of Object.entries(cantidades)) if (v.trim()) forma.set(k, v.trim());
    if (pegar) forma.set("texto", texto);
    else if (archivo) forma.set("archivo", archivo);

    setTrabajando(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/cursos/ia", { method: "POST", headers: { "X-Rol": "coach" }, body: forma });
      const datos = (await res.json().catch(() => ({}))) as Partial<CursoCreado> & { error?: string; aviso?: string | null };
      if (!res.ok || !datos.id) {
        setError(
          res.status === 413
            ? "El documento es demasiado pesado para el servidor. Prueba con uno de menos de 4 MB."
            : (datos.error ?? "No se pudo crear el curso. Inténtalo de nuevo."),
        );
        setTrabajando(false);
        return;
      }
      // Si la IA no juntó todo lo pedido, el editor lo avisa al abrir el borrador.
      try {
        if (datos.aviso) sessionStorage.setItem(`fc.avisoIA.${datos.id}`, datos.aviso);
      } catch {
        // sin sessionStorage solo se pierde el aviso
      }
      router.push(`/coach/curso/${datos.id}`);
    } catch {
      setError("Se cortó la conexión mientras la IA trabajaba. Inténtalo de nuevo.");
      setTrabajando(false);
    }
  };

  if (trabajando) {
    return (
      <div className="crear-ia crear-ia-trabajando" role="status" aria-live="polite">
        <IconoAsistenteGeneral width={26} height={26} />
        <p className="crear-ia-paso">{PASOS[paso]}</p>
        <div className="progreso progreso-indeterminado" aria-hidden="true">
          <span />
        </div>
        <p className="nota">Suele tardar menos de un minuto; un curso largo puede tardar un poco más. No cierres esta página.</p>
      </div>
    );
  }

  return (
    <form className="crear-ia" onSubmit={enviar} noValidate>
      <div className="crear-ia-cabecera">
        <p className="agregar-curso-titulo">Crear un curso con IA</p>
        <button type="button" className="enlace enlace-discreto" onClick={alCerrar}>
          Cancelar
        </button>
      </div>
      <p className="texto-suave">
        Sube tu material (un manual, tus notas, una presentación exportada) y la IA te propone módulos, lecciones,
        repaso y examen. Queda como borrador para que lo revises.
      </p>

      {pegar ? (
        <label className="campo">
          <span>Tu material</span>
          <textarea rows={8} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={150_000} placeholder="Pega aquí el texto de tu material." />
        </label>
      ) : (
        <div className="crear-ia-archivo">
          <input ref={entrada} type="file" accept={ACEPTA} hidden onChange={(e) => elegir(e.target.files?.[0])} />
          <button type="button" className="boton boton-secundario" onClick={() => entrada.current?.click()}>
            <IconoSubir width={16} height={16} /> {archivo ? "Cambiar documento" : "Elegir documento"}
          </button>
          {archivo ? (
            <span className="crear-ia-nombre">{archivo.name}</span>
          ) : (
            <span className="nota">PDF, Word (.docx) o texto, hasta 4 MB. Si tiene tablas, imágenes o es escaneado, mejor en PDF.</span>
          )}
        </div>
      )}
      <button
        type="button"
        className="enlace crear-ia-alternar"
        onClick={() => {
          setPegar(!pegar);
          setError(null);
        }}
      >
        {pegar ? "Mejor subo un documento" : "Prefiero pegar el texto"}
      </button>

      <fieldset className="crear-ia-cantidades">
        <legend>¿Cuántas quieres? Déjalo vacío para que la IA lo decida según tu material.</legend>
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
          placeholder="Por ejemplo: para quien apenas empieza, con ejemplos de tiendas pequeñas"
        />
      </label>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="forma-acciones">
        <button type="submit" className="boton">
          <IconoAsistenteGeneral width={16} height={16} /> Crear borrador con IA
        </button>
      </div>
    </form>
  );
}
