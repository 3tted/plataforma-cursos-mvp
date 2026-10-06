"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ESTADO_ALUMNO, api } from "@/lib/cliente";
import type { Expediente } from "@/lib/tipos";
import { useApp } from "./Contexto";
import { IconoAprobado, IconoExamen } from "./Iconos";

// Expediente del alumno en su perfil: avance por módulo, repaso, examen
// final y estado, con el siguiente paso que le toca.
export default function ExpedienteCurso({ autor }: { autor: string }) {
  const { datos, completadas } = useApp();
  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [error, setError] = useState(false);

  // Se vuelve a pedir cuando cambian las lecciones completadas en este navegador.
  useEffect(() => {
    api<Expediente>(`/api/expediente?autor=${encodeURIComponent(autor)}`)
      .then((e) => {
        setExpediente(e);
        setError(false);
      })
      .catch(() => setError(true));
  }, [autor, completadas]);

  if (error) return <p className="error">No pudimos cargar tu expediente. Revisa tu conexión y recarga la página.</p>;
  if (!expediente) return <p className="texto-suave">Cargando tu expediente…</p>;

  const { estado, porModulo, repaso, examen, leccionesHechas, leccionesTotal } = expediente;
  const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="tarjeta expediente">
      <div className="expediente-cabecera">
        <div>
          <p className="expediente-curso">{datos?.curso.titulo ?? "Curso"}</p>
          <p className="texto-suave">
            <span className="cifra">
              {leccionesHechas} de {leccionesTotal}
            </span>{" "}
            lecciones completadas
          </p>
        </div>
        <span className={ESTADO_ALUMNO[estado].clase}>{ESTADO_ALUMNO[estado].texto}</span>
      </div>

      <ul className="barras expediente-modulos" aria-label="Avance por módulo">
        {porModulo.map((m, i) => (
          <li key={m.id}>
            <span className="barra-etiqueta">
              Módulo {i + 1}: {m.titulo}
            </span>
            <span className="barra-pista">
              <span className="barra-relleno" style={{ width: `${m.total ? (m.hechas / m.total) * 100 : 0}%` }} />
            </span>
            <span className="barra-valor">
              {m.hechas}/{m.total}
            </span>
          </li>
        ))}
      </ul>

      <dl className="expediente-datos">
        <div>
          <dt>Repaso</dt>
          <dd>
            {repaso.total ? (
              <>
                <span className="cifra">{Math.round((repaso.aciertos / repaso.total) * 100)}%</span>
                <span className="texto-suave">
                  {" "}
                  en {repaso.lecciones} {repaso.lecciones === 1 ? "lección" : "lecciones"}
                </span>
              </>
            ) : (
              <span className="texto-suave">Sin responder</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Examen final</dt>
          <dd>
            {examen.mejorPuntaje !== null ? (
              <span className="cifra">{examen.mejorPuntaje}%</span>
            ) : (
              <span className="texto-suave">Sin presentar</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Intentos</dt>
          <dd>
            <span className="cifra">
              {examen.intentos} de {examen.intentosMaximos}
            </span>
          </dd>
        </div>
      </dl>

      <div className="expediente-siguiente">
        {estado === "aprobado" && examen.aprobadoEn ? (
          <p>
            <IconoAprobado width={18} height={18} /> Aprobaste el curso el {fecha(examen.aprobadoEn)}.
          </p>
        ) : estado === "examen-pendiente" ? (
          <Link href="/curso/examen" className="boton boton-chico">
            <IconoExamen width={15} height={15} /> Presentar el examen final
          </Link>
        ) : estado === "requiere-apoyo" ? (
          <>
            <p className="texto-suave">Usaste tus intentos. Tu coach puede ayudarte a repasar.</p>
            <Link href="/comunidad" className="boton boton-chico boton-secundario">
              Pedir apoyo en la comunidad
            </Link>
          </>
        ) : (
          <Link href="/curso" className="boton boton-chico boton-secundario">
            {leccionesHechas ? "Continuar el curso" : "Empezar el curso"}
          </Link>
        )}
      </div>
    </div>
  );
}
