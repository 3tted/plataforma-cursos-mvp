// Fotos de portada (en public/portadas), por id de curso o de comunidad. Lo que
// no tiene foto usa la ilustración de su tema (components/PortadaTema.tsx).
// "foco" es el punto de la foto que se conserva al recortarla (donde está la persona).
export type Foto = { src: string; foco: string };

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

export function fotoDePortada(clave: string): Foto | null {
  return FOTOS[clave] ?? null;
}
