"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { variablesDeMarca } from "@/lib/marca";
import type { MarcaEmpresa } from "@/lib/tipos";
import { useApp } from "./Contexto";

// La marca de la empresa se aplica dentro de su comunidad: la comunidad, sus
// cursos, sus lecciones, su asistente y su membresía. El directorio, el inicio
// y el panel de coach siguen con la marca de Merkatics, porque reúnen a
// varias empresas.
const RUTAS_CON_MARCA = /^\/(comunidad|curso|membresia)(\/|$)/;

/** La marca de la comunidad que se está viendo, o null (marca de Merkatics). */
export function useMarcaActiva(): MarcaEmpresa | null {
  const ruta = usePathname();
  const { datos } = useApp();
  if (!RUTAS_CON_MARCA.test(ruta)) return null;
  return datos?.comunidad.marca ?? null;
}

/** Pinta toda la página (barra incluida) con los colores de la marca activa. */
export function AplicarMarca() {
  const marca = useMarcaActiva();
  const color = marca?.color;
  useLayoutEffect(() => {
    if (!color) return;
    const raiz = document.documentElement;
    const variables = variablesDeMarca(color);
    for (const [nombre, valor] of Object.entries(variables)) raiz.style.setProperty(nombre, valor);
    return () => {
      for (const nombre of Object.keys(variables)) raiz.style.removeProperty(nombre);
    };
  }, [color]);
  return null;
}
