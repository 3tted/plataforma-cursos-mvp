"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Avatar from "./Avatar";
import { useApp } from "./Contexto";
import { IconoAsistenteGeneral, IconoComunidad, IconoInicio, IconoPanel, IconoSalir } from "./Iconos";

export default function Encabezado() {
  const ruta = usePathname();
  const router = useRouter();
  const { usuario, cerrarSesion } = useApp();

  // El mismo menú para alumno y coach; la coach suma su panel.
  const enlaces = [
    { href: "/", texto: "Inicio", corto: "Inicio", Icono: IconoInicio, activo: ruta === "/" },
    {
      href: "/comunidades",
      texto: "Comunidades",
      corto: "Comunidades",
      Icono: IconoComunidad,
      // El curso vive dentro de su comunidad: también marca este enlace.
      activo: (ruta.startsWith("/comunidad") || ruta.startsWith("/curso")) && ruta !== "/curso/asistente",
    },
    // Abre el asistente del curso; el general queda enlazado desde ahí.
    {
      href: "/curso/asistente",
      texto: "Asistente",
      corto: "Asistente",
      Icono: IconoAsistenteGeneral,
      activo: ruta === "/curso/asistente" || ruta === "/asistente",
    },
    ...(usuario?.rol === "coach"
      ? [{ href: "/coach", texto: "Panel de coach", corto: "Panel", Icono: IconoPanel, activo: ruta === "/coach" }]
      : []),
  ];

  return (
    <header className="barra" data-app-fondo>
      <div className="envoltura barra-interior">
        {/* Imagotipo oficial, tomado del manual de identidad (página "Identidad Básica"). */}
        <Link href="/" className="marca" aria-label="Merkatics, inicio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="marca-logo"
            src="/merkatics-logo.png"
            alt=""
            width={2311}
            height={544}
          />
        </Link>

        <nav className="nav" aria-label="Secciones">
          {enlaces.map(({ href, texto, corto, Icono, activo }) => (
            <Link key={href} href={href} className="nav-enlace" aria-current={activo ? "page" : undefined}>
              <Icono />
              {texto === corto ? (
                <span>{texto}</span>
              ) : (
                <>
                  <span className="nav-texto-largo">{texto}</span>
                  <span className="nav-texto-corto">{corto}</span>
                </>
              )}
            </Link>
          ))}
        </nav>

        <div className="barra-acciones">
          {/* La barra es de toda la plataforma y la membresía es de cada comunidad:
              unirse, el pago pendiente y "miembro" viven en la comunidad, el curso y el perfil. */}
          {usuario && (
            <span className="cuenta">
              <Link
                href="/perfil"
                className="usuario"
                aria-current={ruta === "/perfil" ? "page" : undefined}
                aria-label={`Tu perfil: ${usuario.nombre}, ${usuario.rol === "coach" ? "coach" : "alumno"}`}
              >
                <Avatar nombre={usuario.nombre} tamaño={34} coach={usuario.rol === "coach"} />
                <span className="usuario-textos" aria-hidden="true">
                  <span className="usuario-nombre">{usuario.nombre}</span>
                  <span className="usuario-rol">{usuario.rol === "coach" ? "Coach" : "Alumno"}</span>
                </span>
              </Link>
              <button
                type="button"
                className="boton-icono boton-icono-chico salir"
                onClick={() => {
                  cerrarSesion();
                  router.push("/");
                }}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <IconoSalir width={20} height={20} />
              </button>
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
