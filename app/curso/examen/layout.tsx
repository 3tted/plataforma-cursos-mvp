import type { Metadata } from "next";

// Título desde el servidor (la página es de cliente y no puede exportar metadata).
export const metadata: Metadata = { title: "Examen final" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
