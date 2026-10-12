"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useApp } from "@/components/Contexto";
import CamposComunidad, { type FormaComunidad } from "@/components/editor/CamposComunidad";
import FotoPortada from "@/components/editor/FotoPortada";
import { IconoFlechaDer, IconoFlechaIzq } from "@/components/Iconos";
import { useTitulo } from "@/components/useTitulo";
import { api } from "@/lib/cliente";
import type { ComunidadCreada } from "@/lib/tipos";

const formaDe = (c: ComunidadCreada): FormaComunidad => ({
  nombre: c.nombre,
  descripcion: c.descripcion,
  acerca: c.acerca ?? "",
  tema: c.tema,
  coach_titulo: c.coach_titulo,
  precio_mensual: String(c.precio_mensual),
});

// Editar una comunidad de la coach: su foto de portada y todo lo que se lee
// en su presentación (nombre, para quién es, "Acerca de", tema, precio y el
// título de la coach).
export default function EditarComunidad() {
  const { id } = useParams<{ id: string }>();
  const { usuario, recargarCatalogo, recargarCurso } = useApp();
  const [comunidad, setComunidad] = useState<ComunidadCreada | null>(null);
  const [forma, setForma] = useState<FormaComunidad | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useTitulo(comunidad ? `Editar ${comunidad.nombre}` : "Editar comunidad");

  const autor = usuario?.nombre ?? "";
  const sinGuardar = !!comunidad && !!forma && JSON.stringify(forma) !== JSON.stringify(formaDe(comunidad));

  useEffect(() => {
    if (!autor) return;
    api<{ comunidades: ComunidadCreada[] }>(`/api/coach/comunidades?autor=${encodeURIComponent(autor)}`, {
      headers: { "X-Rol": "coach" },
    })
      .then((d) => {
        const c = d.comunidades.find((x) => x.id === id);
        if (!c) return setError("No encontramos esa comunidad entre las tuyas.");
        setComunidad(c);
        setForma(formaDe(c));
      })
      .catch((e) => setError((e as Error).message));
  }, [id, autor]);

  // Avisa antes de salir si hay cambios sin guardar.
  useEffect(() => {
    if (!sinGuardar) return;
    const alSalir = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, [sinGuardar]);

  if (usuario?.rol !== "coach") {
    return (
      <div className="pagina-estrecha">
        <h1>Esta página es para coaches</h1>
      </div>
    );
  }

  const volver = (
    <Link href="/coach/comunidades" className="volver">
      <IconoFlechaIzq width={16} height={16} /> Mis comunidades y cursos
    </Link>
  );

  if (!comunidad || !forma) {
    return (
      <div className="pagina-estrecha">
        {volver}
        {error ? <p className="error">{error}</p> : <p className="texto-suave">Cargando la comunidad…</p>}
      </div>
    );
  }

  // Lo que se ve en la comunidad (presentación, directorio y cursos) se vuelve a pedir.
  const alGuardar = async () => {
    await recargarCatalogo();
    await recargarCurso();
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const nueva = await api<ComunidadCreada>("/api/coach/comunidades", {
        method: "PATCH",
        headers: { "X-Rol": "coach" },
        json: { autor, id: comunidad.id, ...forma, precio_mensual: Number(forma.precio_mensual) },
      });
      setComunidad(nueva);
      setForma(formaDe(nueva));
      setAviso("Cambios guardados.");
      await alGuardar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="pagina-estrecha editar-comunidad">
      {volver}
      <header className="cabecera-pagina">
        <h1>Editar comunidad</h1>
        <Link href={`/comunidad?id=${encodeURIComponent(comunidad.id)}`} className="enlace">
          Ver la comunidad <IconoFlechaDer width={15} height={15} />
        </Link>
      </header>

      <section className="tarjeta editar-comunidad-foto" aria-label="Foto de portada">
        <FotoPortada
          de="comunidad"
          id={comunidad.id}
          autor={autor}
          tema={forma.tema}
          foto={comunidad.foto}
          alCambiar={(foto) => {
            setComunidad({ ...comunidad, foto });
            void alGuardar();
          }}
        />
      </section>

      <form className="tarjeta forma-comunidad" onSubmit={guardar} noValidate>
        <CamposComunidad forma={forma} alCambiar={setForma} />
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
    </div>
  );
}
