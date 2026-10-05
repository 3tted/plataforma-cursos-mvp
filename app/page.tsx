"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Arcos from "@/components/Arcos";
import Avatar from "@/components/Avatar";
import { useApp } from "@/components/Contexto";
import { IconoFlechaDer } from "@/components/Iconos";
import { useTitulo } from "@/components/useTitulo";
import { api } from "@/lib/cliente";
import { COMUNIDADES } from "@/lib/comunidades";
import type { ResumenComunidad } from "@/lib/tipos";

// Directorio: la alumna elige a qué comunidad entrar.
export default function PaginaComunidades() {
  const { lecciones } = useApp();
  const [miembros, setMiembros] = useState<number | null>(null);
  useTitulo("Comunidades");

  useEffect(() => {
    api<ResumenComunidad>("/api/comunidad")
      .then((r) => setMiembros(r.miembros))
      .catch(() => setMiembros(null));
  }, []);

  const activa = COMUNIDADES.find((c) => c.estado === "activa")!;
  const proximas = COMUNIDADES.filter((c) => c.estado === "proximamente");
  const totalLecciones = lecciones.filter((l) => !l.deCoach).length;

  return (
    <div className="directorio">
      <header className="cabecera-pagina">
        <h1>Comunidades</h1>
        <p className="texto-suave">Elige la comunidad a la que quieres entrar. Cada una tiene su coach, su curso y su asistente.</p>
      </header>

      <Link href="/comunidad" className="ficha-comunidad ficha-activa">
        <span className="ficha-portada">
          <Arcos />
          <span className="ficha-sello" aria-hidden="true">
            FC
          </span>
        </span>
        <span className="ficha-cuerpo">
          <span className="pastilla pastilla-marca">{activa.tema}</span>
          <span className="ficha-nombre">{activa.nombre}</span>
          <span className="ficha-coach">
            <Avatar nombre={activa.coach} tamaño={28} /> con {activa.coach}
          </span>
          <span className="ficha-descripcion">{activa.descripcion}</span>
          <span className="dir-datos">
            <span>
              <strong className="cifra">{miembros ?? "…"}</strong> miembros activos
            </span>
            <span>
              <strong className="cifra">{totalLecciones || "…"}</strong> lecciones
            </span>
          </span>
          <span className="boton ficha-boton">
            Entrar a la comunidad <IconoFlechaDer width={16} height={16} />
          </span>
        </span>
      </Link>

      <section aria-labelledby="proximas-titulo" className="proximas">
        <h2 id="proximas-titulo">Próximamente</h2>
        <ul className="proximas-lista">
          {proximas.map((c) => (
            <li key={c.id} className="ficha-comunidad ficha-proxima">
              <span className="ficha-cuerpo">
                <span className="pastilla">{c.tema}</span>
                <span className="ficha-nombre">{c.nombre}</span>
                <span className="ficha-coach">
                  <Avatar nombre={c.coach} tamaño={28} /> con {c.coach}
                </span>
                <span className="ficha-descripcion">{c.descripcion}</span>
                <span className="nota">Comunidad de ejemplo: todavía no abre.</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
