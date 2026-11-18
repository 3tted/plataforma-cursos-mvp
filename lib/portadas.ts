// Fotos de portada (en public/portadas), por id de curso o de comunidad. Lo que
// no tiene foto usa la ilustración de su tema (components/PortadaTema.tsx).
// "foco" es el punto de la foto que se conserva al recortarla (donde está la persona).
// "fondo": la portada es un cartel con texto (no una foto): se muestra completa,
// sin recortar, sobre ese color, para que el texto no quede cortado.
export type Foto = { src: string; foco: string; fondo?: string };

const FINANZAS: Foto = { src: "/portadas/finanzas-negocio.jpg", foco: "72% 35%" };
const PRECIOS: Foto = { src: "/portadas/precios-servicios.jpg", foco: "68% 30%" };
const WHATSAPP: Foto = { src: "/portadas/ventas-whatsapp.jpg", foco: "50% 35%" };

const FOTOS: Record<string, Foto> = {
  "finanzas-negocio": FINANZAS,
  "precios-servicios": PRECIOS,
  "ventas-whatsapp": WHATSAPP,
  // Cada comunidad lleva la foto de su curso principal.
  "finanzas-claras": FINANZAS,
  "vende-por-whatsapp": WHATSAPP,
};

/** Portadas subidas que son un cartel con texto, con el color de su fondo. */
const CARTELES: Record<string, string> = {
  "/ejemplos/increase/portada-curso.webp": "#1b2f5a",
};

/** Una portada subida (o que viene con un curso de ejemplo). */
export function fotoSubida(src: string): Foto {
  return CARTELES[src] ? { src, foco: "50% 50%", fondo: CARTELES[src] } : { src, foco: "50% 50%" };
}

/** Cómo se acomoda la foto en su recuadro: recortada en su foco o, si es un cartel, completa. */
export const estiloDeFoto = (f: Foto) =>
  f.fondo ? { objectFit: "contain" as const, background: f.fondo } : { objectPosition: f.foco };

export function fotoDePortada(clave: string): Foto | null {
  return FOTOS[clave] ?? null;
}
