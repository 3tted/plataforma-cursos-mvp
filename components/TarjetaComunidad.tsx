"use client";

import Link from "next/link";
import Avatar from "@/components/Avatar";
import PortadaTema from "@/components/PortadaTema";
import type { ComunidadDirectorio } from "@/lib/comunidades";
import { useApp } from "./Contexto";

// Tarjeta de una comunidad en el directorio y en el inicio: portada por tema,
// curso(s), coach y tamaño. Las comunidades reales se abren; las de ejemplo
// solo se muestran.
export default function TarjetaComunidad({
  comunidad: c,
  alElegir,
}: {
  comunidad: ComunidadDirectorio;
  /** En vez de abrir la comunidad, hace esto (la página para visitantes pide entrar primero). */
  alElegir?: (id: string) => void;
}) {
  const { cursos, enLaComunidad, cambiarComunidad } = useApp();
  const real = c.estado === "activa";
  const suyos = cursos.filter((x) => x.comunidad === c.id);
  const lecciones = real ? suyos.reduce((s, x) => s + x.lecciones.length, 0) : c.lecciones;
  const minutos = real ? suyos.reduce((s, x) => s + x.minutos, 0) : c.minutos;
  const cursoTexto =
    real && suyos.length > 1 ? `${suyos.length} cursos: ${suyos.map((x) => x.titulo).join(" · ")}` : (suyos[0]?.titulo ?? c.curso);

  const cuerpo = (
    <>
      <PortadaTema tema={c.tema} clave={c.id} alt={c.nombre} />
      <span className="tarjeta-comunidad-cuerpo">
        <span className="ficha-nombre">{c.nombre}</span>
        <span className="tarjeta-comunidad-curso">{cursoTexto}</span>
        <span className="ficha-coach">
          <Avatar nombre={c.coach} tamaño={24} /> {c.coach}
        </span>
        <span className="tarjeta-comunidad-pie">
          {lecciones && minutos ? (
            <span className="cifra">
              {lecciones} lecciones · {minutos} min
            </span>
          ) : (
            <span />
          )}
          {real ? (
            <span className={enLaComunidad(c.id) ? "pastilla pastilla-ok" : "pastilla pastilla-marca"}>
              {enLaComunidad(c.id) ? "Eres parte" : "Abierta"}
            </span>
          ) : (
            <span className="pastilla pastilla-proximamente">Próximamente</span>
          )}
        </span>
      </span>
    </>
  );

  return (
    <li className="tarjeta-comunidad" data-real={real}>
      {real && alElegir ? (
        <button type="button" className="tarjeta-comunidad-enlace" onClick={() => alElegir(c.id)}>
          {cuerpo}
        </button>
      ) : real ? (
        <Link href="/comunidad" className="tarjeta-comunidad-enlace" onClick={() => cambiarComunidad(c.id)}>
          {cuerpo}
        </Link>
      ) : (
        cuerpo
      )}
    </li>
  );
}
