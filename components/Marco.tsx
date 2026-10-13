"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useApp } from "./Contexto";
import Encabezado from "./Encabezado";
import PaginaVisitantes from "./PaginaVisitantes";
import PiePagina from "./PiePagina";

// Rutas de la plataforma. Cualquier otra es un 404: se muestra aunque no haya
// sesión (sin sesión, las rutas de la plataforma muestran la página para visitantes).
const RUTAS = [
  /^\/$/,
  /^\/comunidades$/,
  /^\/comunidad$/,
  /^\/cursos$/,
  /^\/curso(\/[^/]+)?$/,
  /^\/membresia$/,
  /^\/asistente$/,
  /^\/perfil$/,
  /^\/coach(\/comunidades|\/comunidad\/[^/]+|\/curso\/[^/]+)?$/,
];

// Con sesión se ve la plataforma (barra, página y pie); sin sesión, la página
// para visitantes, que explica qué es y abre la entrada desde sus botones.
export default function Marco({ children }: { children: ReactNode }) {
  const { listo, usuario } = useApp();
  const ruta = usePathname();
  const existe = RUTAS.some((r) => r.test(ruta));
  if (!listo) return null;
  if (!usuario && !existe) {
    return (
      <>
        <header className="visitantes-barra">
          <div className="envoltura visitantes-barra-interior">
            <Link href="/" className="marca" aria-label="Merkatics, inicio">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="marca-logo" src="/merkatics-logo.png" alt="" width={2311} height={544} />
            </Link>
          </div>
        </header>
        <main id="contenido" className="envoltura contenido">
          {children}
        </main>
        <PiePagina />
      </>
    );
  }
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
      <AvisoFlotante />
    </>
  );
}

// El aviso breve del contexto: abajo de la pantalla, se va solo a los 7 segundos.
function AvisoFlotante() {
  const { aviso, avisar } = useApp();
  useEffect(() => {
    if (!aviso) return;
    const id = setTimeout(() => avisar(null), 7000);
    return () => clearTimeout(id);
  }, [aviso, avisar]);
  return (
    <div className="aviso-flotante-zona" role="status" aria-live="polite">
      {aviso && (
        <p key={aviso.id} className="aviso-flotante">
          <span>{aviso.texto}</span>
          <button type="button" className="aviso-flotante-cerrar" onClick={() => avisar(null)} aria-label="Cerrar aviso">
            ×
          </button>
        </p>
      )}
    </div>
  );
}
