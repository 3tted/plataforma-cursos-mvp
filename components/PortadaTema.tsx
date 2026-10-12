import {
  CalendarBlank,
  ChartBar,
  Megaphone,
  PenNib,
  Sparkle,
  Storefront,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import { fotoDePortada } from "@/lib/portadas";

// Portada de un curso o una comunidad. Si tiene foto, se muestra la foto (con
// su punto de encuadre); si no, una hoja clara con el ícono de su tema en
// coral, al centro, como los íconos del manual de marca.

const ICONOS: Record<string, Icon> = {
  Finanzas: ChartBar,
  Ventas: Storefront,
  Marketing: Megaphone,
  Productividad: CalendarBlank,
  Diseño: PenNib,
  Liderazgo: UsersThree,
};

export default function PortadaTema({
  tema,
  clave,
  className = "",
  alt = "",
}: {
  tema: string;
  clave: string;
  className?: string;
  /** Nombre del curso o la comunidad, si la foto no es decorativa. */
  alt?: string;
  /** Ya no cambia nada: las portadas sin foto son siempre el ícono centrado. */
  encajar?: boolean;
}) {
  const foto = fotoDePortada(clave);
  if (foto) {
    return (
      <span className={`portada-tema portada-tema-con-foto ${className}`} data-tema={tema}>
        {/* eslint-disable-next-line @next/next/no-img-element -- fotos estáticas ya ligeras */}
        <img
          src={foto.src}
          alt={alt}
          aria-hidden={alt ? undefined : true}
          loading="lazy"
          decoding="async"
          className="portada-tema-foto"
          style={{ objectPosition: foto.foco }}
        />
        <span className="portada-tema-etiqueta">{tema}</span>
      </span>
    );
  }
  const Icono = ICONOS[tema] ?? Sparkle;
  return (
    <span className={`portada-tema portada-tema-sin-foto ${className}`} data-tema={tema}>
      <Icono className="portada-tema-icono" weight="regular" aria-hidden="true" focusable="false" />
      <span className="portada-tema-etiqueta">{tema}</span>
    </span>
  );
}
