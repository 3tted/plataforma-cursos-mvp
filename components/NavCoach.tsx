"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Las tres partes del área de coach, con las mismas pestañas arriba de cada
// una: el resumen de lo que pasa, lo que crea (comunidades y cursos) y su
// empresa (marca, equipo e invitaciones).
const PESTANAS = [
  { href: "/coach", texto: "Resumen", activa: (r: string) => r === "/coach" },
  {
    href: "/coach/comunidades",
    texto: "Comunidades y cursos",
    activa: (r: string) => r === "/coach/comunidades" || r.startsWith("/coach/comunidad/") || r.startsWith("/coach/curso/"),
  },
  { href: "/coach/empresa", texto: "Mi empresa", activa: (r: string) => r === "/coach/empresa" },
];

export default function NavCoach() {
  const ruta = usePathname();
  return (
    <nav className="nav-coach" aria-label="Área de coach">
      {PESTANAS.map((p) => (
        <Link key={p.href} href={p.href} className="nav-coach-enlace" aria-current={p.activa(ruta) ? "page" : undefined}>
          {p.texto}
        </Link>
      ))}
    </nav>
  );
}
