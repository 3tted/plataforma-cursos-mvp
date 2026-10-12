"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "./Contexto";

// Para la coach, en un curso suyo que está en la página pero sin publicar:
// solo ella lo ve. En la portada del curso lleva el botón para publicarlo; en
// las lecciones, una línea que lo recuerda.
export default function AvisoSinPublicar({ compacto = false }: { compacto?: boolean }) {
  const { datos, lecciones, usuario, recargarCurso, recargarCatalogo } = useApp();
  const [publicando, setPublicando] = useState(false);
  const [faltan, setFaltan] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [publicado, setPublicado] = useState(false);

  if (publicado) {
    return (
      <div className="aviso aviso-ok aviso-publicar" role="status">
        <p>
          <strong>¡Curso publicado!</strong> Tus alumnos ya lo ven en la comunidad.
        </p>
      </div>
    );
  }
  if (usuario?.rol !== "coach" || !datos?.curso.sinPublicar) return null;
  const id = datos.curso.id;

  if (compacto) {
    return (
      <p className="aviso-sin-publicar-linea">
        <span className="pastilla pastilla-pendiente">Sin publicar</span> Solo tú ves este curso.{" "}
        <Link href="/curso">Publícalo desde su portada</Link>
      </p>
    );
  }

  const base = lecciones.filter((l) => !l.deCoach);
  const conMaterial = base.filter((l) => l.video || l.presentacion).length;

  const publicar = async () => {
    setPublicando(true);
    setError(null);
    setFaltan([]);
    const res = await fetch(`/api/coach/cursos/${id}/publicar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Rol": "coach" },
      body: JSON.stringify({ autor: usuario.nombre, publicar: true }),
    }).catch(() => null);
    setPublicando(false);
    const respuesta = res ? ((await res.json().catch(() => ({}))) as { error?: string; faltan?: string[] }) : null;
    if (!res?.ok) {
      setError(respuesta?.error ?? "No se pudo publicar. Revisa tu conexión e inténtalo de nuevo.");
      setFaltan(respuesta?.faltan ?? []);
      return;
    }
    setPublicado(true);
    await Promise.all([recargarCurso(), recargarCatalogo()]);
  };

  return (
    <section className="aviso-publicar" aria-labelledby="sin-publicar-titulo">
      <div className="aviso-publicar-texto">
        <p className="pastilla pastilla-pendiente">Sin publicar</p>
        <h2 id="sin-publicar-titulo">Solo tú ves este curso</h2>
        <p className="texto-suave">
          Así lo verán tus alumnos. Entra a cada lección para subir su video o generar su presentación con IA (o déjala
          solo con texto), y publícalo cuando esté listo.
        </p>
        <p className="aviso-publicar-cuenta">
          <span className="cifra">{conMaterial}</span> de <span className="cifra">{base.length}</span>{" "}
          {base.length === 1 ? "lección tiene" : "lecciones tienen"} video o presentación
        </p>
      </div>
      <div className="aviso-publicar-acciones">
        <button type="button" className="boton" onClick={() => void publicar()} disabled={publicando}>
          {publicando ? "Publicando…" : "Publicar curso"}
        </button>
        <Link href={`/coach/curso/${id}`} className="enlace">
          Editar en el editor
        </Link>
      </div>
      {error && (
        <div className="error aviso-publicar-error" role="alert">
          <p>{error}</p>
          {faltan.length > 0 && (
            <ul>
              {faltan.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
