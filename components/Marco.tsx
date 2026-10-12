"use client";

import type { ReactNode } from "react";
import { useApp } from "./Contexto";
import Encabezado from "./Encabezado";
import PaginaVisitantes from "./PaginaVisitantes";
import PiePagina from "./PiePagina";

// Con sesión se ve la plataforma (barra, página y pie); sin sesión, la página
// para visitantes, que explica qué es y abre la entrada desde sus botones.
export default function Marco({ children }: { children: ReactNode }) {
  const { listo, usuario } = useApp();
  if (!listo) return null;
  if (!usuario) return <PaginaVisitantes />;
  return (
    <>
      <a href="#contenido" className="saltar" data-app-fondo>
        Saltar al contenido
      </a>
      <Encabezado />
      <main id="contenido" tabIndex={-1} className="envoltura contenido" data-app-fondo>
        {children}
      </main>
      <PiePagina fondoApp />
    </>
  );
}
