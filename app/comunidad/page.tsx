"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/components/Contexto";

// La dirección de antes (/comunidad o /comunidad?id=…) lleva a la propia de
// la comunidad (/c/<id>): la pedida o la que se estaba viendo.
export default function IrAComunidad() {
  const router = useRouter();
  const { datos, cursos, comunidadId } = useApp();
  const conocida = !!datos || cursos.length > 0;
  useEffect(() => {
    const pedida = new URLSearchParams(window.location.search).get("id");
    if (!pedida && !conocida) return;
    router.replace(`/c/${encodeURIComponent(pedida ?? comunidadId)}`);
  }, [router, conocida, comunidadId]);
  return <p className="texto-suave">Abriendo la comunidad…</p>;
}
