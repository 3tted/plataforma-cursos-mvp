import Avatar from "@/components/Avatar";
import PortadaTema from "@/components/PortadaTema";
import type { ComunidadDirectorio } from "@/lib/comunidades";

// Tarjeta de una comunidad de ejemplo ("Próximamente"): portada por tema,
// curso, coach y tamaño del curso. Se usa en el directorio y en el inicio.
export default function TarjetaComunidad({ comunidad: c }: { comunidad: ComunidadDirectorio }) {
  return (
    <li className="tarjeta-comunidad">
      <PortadaTema tema={c.tema} clave={c.id} />
      <span className="tarjeta-comunidad-cuerpo">
        <span className="ficha-nombre">{c.nombre}</span>
        <span className="tarjeta-comunidad-curso">{c.curso}</span>
        <span className="ficha-coach">
          <Avatar nombre={c.coach} tamaño={24} /> {c.coach}
        </span>
        <span className="tarjeta-comunidad-pie">
          {c.lecciones && c.minutos ? (
            <span className="cifra">
              {c.lecciones} lecciones · {c.minutos} min
            </span>
          ) : (
            <span />
          )}
          <span className="pastilla">Próximamente</span>
        </span>
      </span>
    </li>
  );
}
