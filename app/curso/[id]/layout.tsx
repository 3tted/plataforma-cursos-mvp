import type { Metadata } from "next";
import { cursoDeLeccion } from "@/lib/curso";

// El título de la pestaña es el de la lección, desde el servidor.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const datos = await cursoDeLeccion(id).catch(() => null);
  const leccion = datos?.curso.modulos.flatMap((m) => m.lecciones).find((l) => l.id === id);
  return { title: leccion?.titulo ?? "Lección" };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
