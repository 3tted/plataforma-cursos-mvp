"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import Arcos from "@/components/Arcos";
import { useApp } from "@/components/Contexto";
import { IconoFlechaDer, IconoFlechaIzq, IconoSubir } from "@/components/Iconos";
import { useTitulo } from "@/components/useTitulo";
import { api } from "@/lib/cliente";
import { COLOR_MERKATICS, normalizarColor, tonosDeMarca, variablesDeMarca } from "@/lib/marca";
import type { Empresa } from "@/lib/tipos";

type EmpresaVista = Omit<Empresa, "id" | "creadaEn" | "actualizadaEn"> & { id: string | null };

/** Colores para empezar; cualquier otro se elige con el selector. */
const SUGERIDOS = [
  { color: COLOR_MERKATICS, nombre: "Coral Merkatics" },
  { color: "#2563eb", nombre: "Azul" },
  { color: "#0f766e", nombre: "Verde azulado" },
  { color: "#15803d", nombre: "Verde" },
  { color: "#7c3aed", nombre: "Morado" },
  { color: "#db2777", nombre: "Rosa" },
  { color: "#ea580c", nombre: "Naranja" },
  { color: "#334155", nombre: "Pizarra" },
];

// Reduce el logo en el navegador sin perder la transparencia (PNG, máximo 800 × 240).
async function reducirLogo(archivo: File): Promise<Blob> {
  const url = URL.createObjectURL(archivo);
  try {
    const imagen = new Image();
    imagen.src = url;
    await imagen.decode();
    const escala = Math.min(1, 800 / imagen.naturalWidth, 240 / imagen.naturalHeight);
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.max(1, Math.round(imagen.naturalWidth * escala));
    lienzo.height = Math.max(1, Math.round(imagen.naturalHeight * escala));
    lienzo.getContext("2d")!.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise<Blob | null>((listo) => lienzo.toBlob(listo, "image/png"));
    if (!blob) throw new Error();
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// La empresa de la coach y su marca: nombre, color principal y logo. Se aplica
// en sus comunidades, cursos y lecciones; el directorio y el panel siguen con
// la marca de Merkatics. Por ahora cada coach es una empresa de una persona.
export default function PaginaMiEmpresa() {
  const { usuario, recargarCurso } = useApp();
  const autor = usuario?.nombre ?? "";
  const [empresa, setEmpresa] = useState<EmpresaVista | null>(null);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState(COLOR_MERKATICS);
  const [textoColor, setTextoColor] = useState(COLOR_MERKATICS);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comunidad, setComunidad] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  useTitulo("Mi empresa");

  useEffect(() => {
    if (!autor || usuario?.rol !== "coach") return;
    const cabeceras = { "X-Rol": "coach" };
    api<EmpresaVista>(`/api/coach/empresa?autor=${encodeURIComponent(autor)}`, { headers: cabeceras })
      .then((e) => {
        setEmpresa(e);
        setNombre(e.nombre);
        setColor(e.color);
        setTextoColor(e.color);
      })
      .catch((e) => setError((e as Error).message));
    api<{ comunidades: { id: string }[] }>(`/api/coach/comunidades?autor=${encodeURIComponent(autor)}`, { headers: cabeceras })
      .then((d) => setComunidad(d.comunidades[0]?.id ?? null))
      .catch(() => undefined);
  }, [autor, usuario?.rol]);

  if (usuario?.rol !== "coach") {
    return (
      <div className="pagina-estrecha">
        <h1>Esta página es para coaches</h1>
      </div>
    );
  }

  const tonos = tonosDeMarca(color);
  const sinGuardar = !!empresa && (empresa.id === null || nombre.trim() !== empresa.nombre || color !== empresa.color);

  const elegirColor = (valor: string) => {
    setTextoColor(valor);
    const normal = normalizarColor(valor);
    if (normal) setColor(normal);
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const guardada = await api<Empresa>("/api/coach/empresa", {
        method: "PUT",
        headers: { "X-Rol": "coach" },
        json: { autor, nombre, color },
      });
      setEmpresa(guardada);
      setAviso("Cambios guardados. Tus comunidades ya se ven con tu marca.");
      await recargarCurso();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const rutaLogo = empresa?.id ? `/api/fotos/empresa-${empresa.id}?autor=${encodeURIComponent(autor)}` : null;

  const subirLogo = async (archivo: File) => {
    if (!rutaLogo) return;
    if (!archivo.type.startsWith("image/")) return setError("Ese archivo no es una imagen.");
    setError(null);
    setSubiendo(true);
    try {
      const blob = await reducirLogo(archivo).catch(() => {
        throw new Error("No pudimos abrir esa imagen. Prueba con un PNG o JPG.");
      });
      const res = await fetch(rutaLogo, { method: "PUT", headers: { "Content-Type": "image/png", "X-Rol": "coach" }, body: blob });
      const datos = (await res.json().catch(() => ({}))) as { foto?: string; error?: string };
      if (!res.ok || !datos.foto) throw new Error(datos.error ?? "No se pudo subir el logo. Inténtalo de nuevo.");
      setEmpresa((e) => (e ? { ...e, logo: datos.foto } : e));
      await recargarCurso();
    } catch (err) {
      setError(err instanceof TypeError ? "Se cortó la conexión mientras subía el logo." : (err as Error).message);
    } finally {
      setSubiendo(false);
    }
  };

  const quitarLogo = async () => {
    if (!rutaLogo) return;
    const res = await fetch(rutaLogo, { method: "DELETE", headers: { "X-Rol": "coach" } }).catch(() => null);
    if (!res?.ok) return setError("No se pudo quitar el logo.");
    setEmpresa((e) => (e ? { ...e, logo: undefined } : e));
    await recargarCurso();
  };

  const nombreVisible = nombre.trim() || autor;

  return (
    <div className="mi-empresa">
      <Link href="/coach/comunidades" className="volver">
        <IconoFlechaIzq width={16} height={16} /> Mis comunidades y cursos
      </Link>
      <header className="cabecera-pagina mi-empresa-cabecera">
        <div>
          <h1>Mi empresa</h1>
          <p className="texto-suave">
            Tu marca: tus alumnos ven tus comunidades, cursos y lecciones con tu logo y tu color. El directorio y tu panel
            siguen con la marca de Merkatics.
          </p>
        </div>
        {comunidad && (
          <Link href={`/comunidad?id=${encodeURIComponent(comunidad)}`} className="enlace mi-empresa-ver">
            Ver mi comunidad <IconoFlechaDer width={15} height={15} />
          </Link>
        )}
      </header>

      {!empresa && !error && <p className="texto-suave">Cargando tu empresa…</p>}

      {empresa && (
        <div className="mi-empresa-rejilla">
          <div className="mi-empresa-ajustes">
            <form className="tarjeta forma-comunidad" onSubmit={guardar} noValidate>
              <h2>Nombre y color</h2>
              <label className="campo">
                <span>Nombre de tu empresa o marca</span>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} required />
              </label>

              <fieldset className="mi-empresa-colores">
                <legend>Color principal</legend>
                <div className="mi-empresa-sugeridos">
                  {SUGERIDOS.map((s) => (
                    <button
                      key={s.color}
                      type="button"
                      className="mi-empresa-muestra"
                      style={{ background: s.color }}
                      aria-pressed={color === s.color}
                      aria-label={s.nombre}
                      title={s.nombre}
                      onClick={() => elegirColor(s.color)}
                    />
                  ))}
                </div>
                <div className="mi-empresa-propio">
                  <label className="mi-empresa-selector">
                    <input type="color" value={color} onChange={(e) => elegirColor(e.target.value)} aria-label="Elegir otro color" />
                    <span>Otro color</span>
                  </label>
                  <label className="campo mi-empresa-hex">
                    <span className="sr-only">Código del color</span>
                    <input
                      value={textoColor}
                      onChange={(e) => elegirColor(e.target.value)}
                      maxLength={7}
                      spellCheck={false}
                      aria-invalid={!normalizarColor(textoColor)}
                    />
                  </label>
                </div>
              </fieldset>

              <div className={tonos.ajustado ? "mi-empresa-contraste mi-empresa-contraste-ajustado" : "mi-empresa-contraste"} role="status">
                {tonos.ajustado ? (
                  <p>
                    <b>Tu color es claro para poner texto blanco encima.</b> En botones y enlaces usamos un tono más oscuro
                    del mismo color para que se lean bien; en íconos y barras de avance se usa el tuyo.
                  </p>
                ) : (
                  <p>
                    <b>Se lee bien.</b> Tu color funciona con texto blanco en botones y enlaces.
                  </p>
                )}
                <ul className="mi-empresa-tonos">
                  <li>
                    <span style={{ background: tonos.botones }} /> Botones y enlaces <code>{tonos.botones}</code>
                  </li>
                  <li>
                    <span style={{ background: tonos.acento }} /> Íconos y avance <code>{tonos.acento}</code>
                  </li>
                  <li>
                    <span style={{ background: tonos.texto }} /> Texto destacado <code>{tonos.texto}</code>
                  </li>
                </ul>
                <p className="nota">El texto, los errores y los avisos no cambian de color, para que todo siga legible.</p>
              </div>

              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="forma-acciones">
                <button type="submit" className="boton" disabled={!sinGuardar || guardando}>
                  {guardando ? "Guardando…" : "Guardar cambios"}
                </button>
                <span className="texto-suave" role="status">
                  {sinGuardar ? "Cambios sin guardar" : aviso}
                </span>
              </div>
            </form>

            <section className="tarjeta mi-empresa-logo" aria-labelledby="logo-titulo">
              <h2 id="logo-titulo">Logo</h2>
              {empresa.id ? (
                <>
                  <div className="mi-empresa-logo-vista">
                    {empresa.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={empresa.logo} alt={`Logo de ${nombreVisible}`} />
                    ) : (
                      <span className="texto-suave">Sin logo: la barra muestra el nombre de tu empresa.</span>
                    )}
                  </div>
                  <p className="nota">PNG con fondo transparente y horizontal se ve mejor. Aparece en la barra de arriba.</p>
                  <input
                    ref={entrada}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    onChange={(e) => {
                      const archivo = e.target.files?.[0];
                      e.target.value = "";
                      if (archivo) void subirLogo(archivo);
                    }}
                  />
                  <div className="foto-portada-botones">
                    <button type="button" className="boton boton-chico boton-fantasma-borde" onClick={() => entrada.current?.click()} disabled={subiendo}>
                      <IconoSubir width={15} height={15} /> {subiendo ? "Subiendo…" : empresa.logo ? "Cambiar logo" : "Subir logo"}
                    </button>
                    {empresa.logo && !subiendo && (
                      <button type="button" className="enlace enlace-discreto" onClick={() => void quitarLogo()}>
                        Quitar
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="texto-suave">Guarda el nombre y el color de tu empresa para poder subir su logo.</p>
              )}
            </section>
          </div>

          {/* Vista previa con los colores elegidos, antes de guardar. */}
          <section className="mi-empresa-previa" aria-labelledby="previa-titulo" style={variablesDeMarca(color) as CSSProperties}>
            <h2 id="previa-titulo">Así lo verán tus alumnos</h2>
            <div className="previa-marco" aria-hidden="true">
              <div className="previa-barra">
                {empresa.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={empresa.logo} alt="" className="previa-logo" />
                ) : (
                  <span className="marca-nombre-empresa">{nombreVisible}</span>
                )}
                <span className="previa-nav previa-nav-activo">Comunidades</span>
                <span className="previa-nav">Asistente</span>
              </div>
              <div className="previa-cuerpo">
                <Arcos />
                <p className="previa-etiqueta">Lección 1 · Módulo 1</p>
                <p className="previa-titulo">Tu primer curso</p>
                <div className="progreso">
                  <span style={{ transform: "scaleX(0.4)" }} />
                </div>
                <p className="previa-meta">2 de 5 lecciones completadas</p>
                <div className="previa-acciones">
                  <span className="boton">Unirme gratis a la comunidad</span>
                  <span className="enlace">Ver el curso</span>
                </div>
                <p>
                  <span className="pastilla pastilla-marca">Coach</span> <span className="cita-id">L4</span>
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
