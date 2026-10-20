"use client";

import { useParams } from "next/navigation";
import PaginaComunidad from "@/components/PaginaComunidad";

// La dirección propia de cada comunidad: /c/finanzas-claras. Se puede
// compartir y guardar, y se ve aunque no haya sesión.
export default function PaginaComunidadPorId() {
  const { id } = useParams<{ id: string }>();
  return <PaginaComunidad id={decodeURIComponent(id)} />;
}
