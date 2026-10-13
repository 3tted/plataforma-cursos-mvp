"use client";

import { useEffect } from "react";

// Cada página nombra su pestaña: el historial y los lectores de pantalla
// distinguen "Punto de equilibrio" de "Membresía" en vez de repetir la comunidad.
// Next.js vuelve a poner el título por defecto después de montar la página
// (por ejemplo, en el Inicio), así que si algo lo cambia se vuelve a poner.
export function useTitulo(titulo: string | null | undefined) {
  useEffect(() => {
    if (!titulo) return;
    const deseado = `${titulo} · Merkatics`;
    const poner = () => {
      if (document.title !== deseado) document.title = deseado;
    };
    poner();
    const observador = new MutationObserver(poner);
    observador.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observador.disconnect();
  }, [titulo]);
}
