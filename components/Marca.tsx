"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { variablesDeMarca } from "@/lib/marca";
import type { MarcaEmpresa } from "@/lib/tipos";
import { useApp } from "./Contexto";

// La marca de la empresa se aplica en su página (/e/<id>), en la de su
// diagnóstico (/radar/<id>) y dentro de su
// comunidad: la comunidad, sus cursos, sus lecciones, su asistente y su
// membresía. El directorio, el inicio y el panel de coach siguen con la marca
// de Merkatics, porque reúnen a varias empresas.
const RUTAS_CON_MARCA = /^\/(c|comunidad|curso|membresia)(\/|$)/;
const RUTA_EMPRESA = /^\/(e|radar)\/[^/]+$/;

/** La marca de la comunidad (o de la empresa) que se está viendo, o null (marca de Merkatics). */
export function useMarcaActiva(): MarcaEmpresa | null {
  const ruta = usePathname();
  const { datos, marcaPagina } = useApp();
  if (RUTA_EMPRESA.test(ruta)) return marcaPagina;
  if (!RUTAS_CON_MARCA.test(ruta)) return null;
  return datos?.comunidad.marca ?? null;
}

/** Lo que va dentro del enlace al inicio: el logo de la empresa, su nombre o el de Merkatics. */
export function LogoDeMarca({ marca }: { marca: MarcaEmpresa | null }) {
  if (marca?.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="marca-logo marca-logo-empresa" src={marca.logo} alt="" />;
  }
  if (marca) return <span className="marca-nombre-empresa">{marca.nombre}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="marca-logo" src="/merkatics-logo.png" alt="" width={2311} height={544} />;
}

/** Pinta toda la página (barra incluida) con los colores de la marca activa. */
export function AplicarMarca() {
  const marca = useMarcaActiva();
  const color = marca?.color;
  const acento = marca?.acento;
  useLayoutEffect(() => {
    if (!color) return;
    const raiz = document.documentElement;
    const variables = variablesDeMarca(color, acento);
    for (const [nombre, valor] of Object.entries(variables)) raiz.style.setProperty(nombre, valor);
    return () => {
      for (const nombre of Object.keys(variables)) raiz.style.removeProperty(nombre);
    };
  }, [color, acento]);
  return null;
}
