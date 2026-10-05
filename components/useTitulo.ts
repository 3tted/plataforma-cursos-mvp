"use client";

import { useEffect } from "react";

// Cada página nombra su pestaña: el historial y los lectores de pantalla
// distinguen "Punto de equilibrio" de "Membresía" en vez de repetir la comunidad.
export function useTitulo(titulo: string | null | undefined) {
  useEffect(() => {
    if (!titulo) return;
    document.title = `${titulo} · Merkatics`;
  }, [titulo]);
}
