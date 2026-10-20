"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useApp } from "./Contexto";
import Encabezado from "./Encabezado";
import { AplicarMarca, LogoDeMarca, useMarcaActiva } from "./Marca";
import PaginaVisitantes from "./PaginaVisitantes";
import PiePagina from "./PiePagina";

// Rutas de la plataforma. Sin sesión muestran la página para visitantes;
// cualquier otra (un 404, una invitación o la página de una empresa) se ve
// aunque no haya sesión, con una barra sencilla.
const RUTAS = [
  /^\/$/,
  /^\/comunidades$/,
  /^\/comunidad$/,
  /^\/cursos$/,
  /^\/curso(\/[^/]+)?$/,
  /^\/membresia$/,
  /^\/asistente$/,
  /^\/perfil$/,
  /^\/coach(\/comunidades|\/comunidad\/[^/]+|\/curso\/[^/]+|\/empresa)?$/,
];

// Con sesión se ve la plataforma (barra, página y pie); sin sesión, la página
// para visitantes, que explica qué es y abre la entrada desde sus botones.
export default function Marco({ children }: { children: ReactNode }) {
  const { listo, usuario } = useApp();
  const marca = useMarcaActiva();
  const ruta = usePathname();
  const existe = RUTAS.some((r) => r.test(ruta));
  if (!listo) return <Esqueleto />;
  if (!usuario && !existe) {
    return (
      <>
        <AplicarMarca />
        <header className="visitantes-barra">
          <div className="envoltura visitantes-barra-interior">
            <Link href="/" className="marca" aria-label={marca ? `${marca.nombre}, inicio` : "Merkatics, inicio"}>
              <LogoDeMarca marca={marca} />
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
      <AplicarMarca />
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

// Mientras se sabe quién entró (la sesión llega del servidor), la página ya
// muestra su forma: la barra con el logo y bloques del tamaño del contenido.
function Esqueleto() {
  return (
    <div className="esqueleto-pagina" aria-busy="true" aria-label="Cargando">
      <header className="visitantes-barra">
        <div className="envoltura visitantes-barra-interior">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="marca-logo" src="/merkatics-logo.png" alt="" width={2311} height={544} />
        </div>
      </header>
      <main className="envoltura contenido esqueleto-contenido">
        <span className="esqueleto esqueleto-titulo" />
        <span className="esqueleto esqueleto-linea" />
        <span className="esqueleto esqueleto-linea esqueleto-corta" />
        <div className="esqueleto-tarjetas">
          <span className="esqueleto esqueleto-tarjeta" />
          <span className="esqueleto esqueleto-tarjeta" />
          <span className="esqueleto esqueleto-tarjeta" />
        </div>
      </main>
    </div>
  );
}
