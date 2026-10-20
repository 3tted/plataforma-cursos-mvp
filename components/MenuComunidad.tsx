"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./Contexto";

// El menú propio de una comunidad: su página, su curso (o cursos), su
// asistente y su membresía. Va arriba de cada una de esas páginas para saber
// siempre en qué comunidad estás y moverte dentro de ella.
export default function MenuComunidad() {
  const ruta = usePathname();
  const { datos, usuario, coachAqui, cursosComunidad } = useApp();
  if (!datos) return null;
  const { id, nombre } = datos.comunidad;
  const enLaPagina = ruta.startsWith("/c/");
  const opciones = [
    { href: `/c/${id}`, texto: "Comunidad", activa: enLaPagina },
    // El temario pide cuenta: sin sesión, el curso se empieza desde la comunidad.
    ...(usuario
      ? [
          {
            href: "/curso",
            texto: cursosComunidad.length > 1 ? "Cursos" : "Curso",
            activa: ruta === "/curso" || ruta === "/curso/examen",
          },
        ]
      : []),
    { href: "/curso/asistente", texto: "Asistente", activa: ruta === "/curso/asistente" },
    ...(usuario && !coachAqui ? [{ href: "/membresia", texto: "Membresía", activa: ruta === "/membresia" }] : []),
  ];
  return (
    <nav className="menu-comunidad" aria-label={`Secciones de ${nombre}`}>
      {/* En la página de la comunidad su nombre ya es el título. */}
      {!enLaPagina && (
        <Link href={`/c/${id}`} className="menu-comunidad-nombre">
          {nombre}
        </Link>
      )}
      <span className="menu-comunidad-opciones">
        {opciones.map((o) => (
          <Link key={o.href} href={o.href} className="menu-comunidad-opcion" aria-current={o.activa ? "page" : undefined}>
            {o.texto}
          </Link>
        ))}
      </span>
    </nav>
  );
}
