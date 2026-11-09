"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useApp } from "@/components/Contexto";
import { IconoFlechaDer, IconoSubir } from "@/components/Iconos";
import EquipoEmpresa from "@/components/EquipoEmpresa";
import NavCoach from "@/components/NavCoach";
import { useTitulo } from "@/components/useTitulo";
import { api } from "@/lib/cliente";
import { COLOR_MERKATICS, normalizarColor, tonosDeMarca, variablesDeMarca } from "@/lib/marca";
import type { Empresa } from "@/lib/tipos";

type EmpresaVista = Empresa & {
  color: string;
  /** Ya eligió su color: sus comunidades se ven con su marca. */
  conMarca: boolean;
  /** El dueño y los administradores cambian la marca. */
  puedeEditar: boolean;
};

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
// en sus comunidades, cursos y lecciones y en su página (/e/<id>); el
// directorio y el panel siguen con la marca de Merkatics. Todas sus coaches la
// ven; solo la dueña la cambia e invita coaches.
export default function PaginaMiEmpresa() {
  const { usuario, recargarCurso } = useApp();
  const [empresa, setEmpresa] = useState<EmpresaVista | null>(null);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState(COLOR_MERKATICS);
  const [textoColor, setTextoColor] = useState(COLOR_MERKATICS);
  // Segundo color (opcional).
  const [acento, setAcento] = useState<string | null>(null);
  const [textoAcento, setTextoAcento] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comunidad, setComunidad] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  useTitulo("Mi empresa");

  useEffect(() => {
    if (usuario?.rol !== "coach") return;
    api<EmpresaVista>("/api/coach/empresa")
      .then((e) => {
        setEmpresa(e);
        setNombre(e.nombre);
        setColor(e.color);
        setTextoColor(e.color);
        setAcento(e.colorAcento ?? null);
        setTextoAcento(e.colorAcento ?? "");
      })
      .catch((e) => setError((e as Error).message));
    api<{ comunidades: { id: string }[] }>("/api/coach/comunidades")
      .then((d) => setComunidad(d.comunidades[0]?.id ?? null))
      .catch(() => undefined);
  }, [usuario?.rol, usuario?.empresa]);

  if (usuario?.rol !== "coach") {
    return (
      <div className="pagina-estrecha">
        <h1>Esta página es para coaches</h1>
      </div>
    );
  }

  const tonos = tonosDeMarca(color);
  const puedeEditar = empresa?.puedeEditar === true;
  const sinGuardar =
    puedeEditar &&
    !!empresa &&
    (!empresa.conMarca ||
      nombre.trim() !== empresa.nombre ||
      color !== empresa.color ||
      (acento ?? null) !== (empresa.colorAcento ?? null));

  const elegirColor = (valor: string) => {
    setTextoColor(valor);
    const normal = normalizarColor(valor);
    if (normal) setColor(normal);
  };
  const elegirAcento = (valor: string) => {
    setTextoAcento(valor);
    const normal = normalizarColor(valor);
    if (normal) setAcento(normal);
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const guardada = await api<EmpresaVista>("/api/coach/empresa", { method: "PUT", json: { nombre, color, acento } });
      setEmpresa(guardada);
      setAviso("Cambios guardados. Tus comunidades ya se ven con tu marca.");
      await recargarCurso();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const rutaLogo = empresa && puedeEditar ? `/api/fotos/empresa-${empresa.id}` : null;

  const subirLogo = async (archivo: File) => {
    if (!rutaLogo) return;
    if (!archivo.type.startsWith("image/")) return setError("Ese archivo no es una imagen.");
    setError(null);
    setSubiendo(true);
    try {
      const blob = await reducirLogo(archivo).catch(() => {
        throw new Error("No pudimos abrir esa imagen. Prueba con un PNG o JPG.");
      });
      const res = await fetch(rutaLogo, { method: "PUT", headers: { "Content-Type": "image/png" }, body: blob });
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
    const res = await fetch(rutaLogo, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return setError("No se pudo quitar el logo.");
    setEmpresa((e) => (e ? { ...e, logo: undefined } : e));
    await recargarCurso();
  };

  const nombreVisible = nombre.trim() || empresa?.nombre || "";
  // Sin logo propio, la barra lleva el nombre de la empresa; Merkatics, su logo de siempre.
  const logoVisible = empresa?.logo ?? (empresa?.id === "merkatics" ? "/merkatics-logo.png" : undefined);

  return (
    <div className="mi-empresa">
      <NavCoach />
      <header className="cabecera-pagina mi-empresa-cabecera">
        <div>
          <h1>Mi empresa</h1>
          <p className="texto-suave">
            Tu marca: tus alumnos ven tus comunidades, cursos y lecciones con tu logo y tu color. El directorio y tu panel
            siguen con la marca de Merkatics.
          </p>
        </div>
        {comunidad && (
          <Link href={`/c/${comunidad}`} className="enlace mi-empresa-ver">
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
              {!puedeEditar && (
                <p className="nota">El nombre, el color y el logo los cambian el dueño ({empresa.dueno}) y los administradores.</p>
              )}
              <fieldset className="mi-empresa-campos" disabled={!puedeEditar}>
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

                <fieldset className="mi-empresa-acento">
                  <legend>Color de acento (opcional)</legend>
                  <label className="casilla">
                    <input
                      type="checkbox"
                      checked={acento !== null}
                      onChange={(e) => {
                        const nuevo = e.target.checked ? normalizarColor(textoAcento) ?? "#f17c12" : null;
                        setAcento(nuevo);
                        if (nuevo) setTextoAcento(nuevo);
                      }}
                    />
                    Usar un segundo color en íconos, barras de avance, gráficas y etiquetas
                  </label>
                  {acento !== null && (
                    <div className="mi-empresa-propio">
                      <label className="mi-empresa-selector">
                        <input type="color" value={acento} onChange={(e) => elegirAcento(e.target.value)} aria-label="Elegir el color de acento" />
                        <span>Color de acento</span>
                      </label>
                      <label className="campo mi-empresa-hex">
                        <span className="sr-only">Código del color de acento</span>
                        <input
                          value={textoAcento}
                          onChange={(e) => elegirAcento(e.target.value)}
                          maxLength={7}
                          spellCheck={false}
                          aria-invalid={!normalizarColor(textoAcento)}
                        />
                      </label>
                    </div>
                  )}
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
                      <span style={{ background: acento ? tonosDeMarca(acento).acento : tonos.acento }} /> Íconos y avance{" "}
                      <code>{acento ? tonosDeMarca(acento).acento : tonos.acento}</code>
                    </li>
                    <li>
                      <span style={{ background: tonos.texto }} /> Texto destacado <code>{tonos.texto}</code>
                    </li>
                  </ul>
                  <p className="nota">El texto, los errores y los avisos no cambian de color, para que todo siga legible.</p>
                </div>
              </fieldset>

              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              {puedeEditar && (
                <div className="forma-acciones">
                  <button type="submit" className="boton" disabled={!sinGuardar || guardando}>
                    {guardando ? "Guardando…" : empresa.conMarca ? "Guardar cambios" : "Usar mi marca"}
                  </button>
                  <span className="texto-suave" role="status">
                    {!empresa.conMarca
                      ? "Mientras no la guardes, tus comunidades se ven con la marca de Merkatics."
                      : sinGuardar
                        ? "Cambios sin guardar"
                        : aviso}
                  </span>
                </div>
              )}
            </form>

            <section className="tarjeta mi-empresa-logo" aria-labelledby="logo-titulo">
              <h2 id="logo-titulo">Logo</h2>
              <div className="mi-empresa-logo-vista">
                {logoVisible ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoVisible} alt={`Logo de ${nombreVisible}`} />
                ) : (
                  <span className="texto-suave">Sin logo: la barra muestra el nombre de tu empresa.</span>
                )}
              </div>
              {puedeEditar && (
                <>
                  <p className="nota">
                    PNG con fondo transparente y horizontal se ve mejor. Aparece en la barra de arriba
                    {empresa.conMarca ? "." : " en cuanto guardes tu color."}
                  </p>
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
                      <IconoSubir width={15} height={15} /> {subiendo ? "Subiendo…" : logoVisible ? "Cambiar logo" : "Subir logo"}
                    </button>
                    {empresa.logo && !subiendo && (
                      <button type="button" className="enlace enlace-discreto" onClick={() => void quitarLogo()}>
                        Quitar
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>

          {/* Vista previa con los colores elegidos, antes de guardar. */}
          <section
            className="mi-empresa-previa"
            aria-labelledby="previa-titulo"
            style={variablesDeMarca(color, acento) as CSSProperties}
          >
            <h2 id="previa-titulo">Así lo verán tus alumnos</h2>
            <div className="previa-marco" aria-hidden="true">
              <div className="previa-barra">
                {logoVisible ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoVisible} alt="" className="previa-logo" />
                ) : (
                  <span className="marca-nombre-empresa">{nombreVisible}</span>
                )}
                <span className="previa-nav previa-nav-activo">Comunidades</span>
                <span className="previa-nav">Asistente</span>
              </div>
              <div className="previa-cuerpo">
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

      {empresa && <EquipoEmpresa empresa={empresa.id} administra={puedeEditar} />}
    </div>
  );
}
