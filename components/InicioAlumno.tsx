"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, moneda } from "@/lib/cliente";
import { COMUNIDADES } from "@/lib/comunidades";
import type { Expediente } from "@/lib/tipos";
import Arcos from "./Arcos";
import { useApp } from "./Contexto";
import { IconoAsistente, IconoFlechaDer } from "./Iconos";
import PreguntaRapida from "./PreguntaRapida";
import PublicacionesRecientes from "./PublicacionesRecientes";
import TarjetaComunidad from "./TarjetaComunidad";

// Inicio del alumno: seguir su curso, resolver dudas y ver qué pasa en la comunidad.
export default function InicioAlumno() {
  const router = useRouter();
  const { usuario, datos, lecciones, completadas, tieneAcceso, setPreguntaPendiente, setLeccionContexto } = useApp();
  const [expediente, setExpediente] = useState<Expediente | null>(null);

  useEffect(() => {
    if (!usuario) return;
    api<Expediente>(`/api/expediente?autor=${encodeURIComponent(usuario.nombre)}`)
      .then(setExpediente)
      .catch(() => setExpediente(null));
  }, [usuario, completadas]);

  const base = lecciones.filter((l) => !l.deCoach);
  const hechas = base.filter((l) => completadas.includes(l.id)).length;
  const pendiente = base.find((l) => !completadas.includes(l.id));
  const bloqueada = !!pendiente && !pendiente.gratis && !tieneAcceso;
  const terminado = base.length > 0 && !pendiente;
  const numero = pendiente ? base.indexOf(pendiente) + 1 : base.length;
  const examen = expediente?.examen;
  const precio = moneda(datos?.comunidad.precio_mensual ?? 490);

  const preguntar = (pregunta: string) => {
    setLeccionContexto(null);
    setPreguntaPendiente(pregunta);
    router.push("/curso/asistente");
  };

  const tendencia = COMUNIDADES.filter((c) => c.estado === "proximamente").slice(0, 3);
  const nombre = usuario?.nombre.split(" ")[0] ?? "";

  return (
    <div className="inicio">
      <header className="inicio-saludo">
        <h1>Hola{nombre && `, ${nombre}`}</h1>
        <p className="texto-suave">
          {terminado
            ? `Terminaste las lecciones de ${datos?.curso.titulo ?? "tu curso"}.`
            : hechas === 0
              ? `Tu curso ${datos?.curso.titulo ?? ""} te espera. La primera lección dura pocos minutos.`
              : `Vas en la lección ${numero} de ${base.length} de ${datos?.curso.titulo ?? "tu curso"}.`}
        </p>
      </header>

      <div className="inicio-fila inicio-fila-principal">
        <section className="inicio-continuar" aria-labelledby="continuar-titulo">
          <Arcos />
          <p className="inicio-etiqueta">
            {terminado ? "Último paso" : hechas === 0 ? "Empieza aquí" : "Continúa donde te quedaste"}
          </p>
          {terminado ? (
            <>
              <h2 id="continuar-titulo">{examen?.aprobado ? "¡Aprobaste el curso!" : "Examen final"}</h2>
              <p className="texto-suave">
                {examen?.aprobado
                  ? `Tu mejor resultado: ${examen.mejorPuntaje}%. Queda en tu expediente.`
                  : "12 preguntas. Lo apruebas con 70%."}
              </p>
              <Link href={examen?.aprobado ? "/perfil" : "/curso/examen"} className="boton">
                {examen?.aprobado ? "Ver mi expediente" : "Presentar el examen"} <IconoFlechaDer width={16} height={16} />
              </Link>
            </>
          ) : pendiente ? (
            <>
              <h2 id="continuar-titulo">{pendiente.titulo}</h2>
              <p className="texto-suave">
                Lección <span className="cifra">{numero}</span> de <span className="cifra">{base.length}</span> ·{" "}
                <span className="cifra">{pendiente.duracion_min}</span> min
              </p>
              {bloqueada ? (
                <Link href="/membresia" className="boton">
                  Desbloquear por {precio} al mes <IconoFlechaDer width={16} height={16} />
                </Link>
              ) : (
                <Link href={`/curso/${pendiente.id}`} className="boton">
                  {hechas === 0 ? "Empezar" : "Continuar"} <IconoFlechaDer width={16} height={16} />
                </Link>
              )}
            </>
          ) : (
            <h2 id="continuar-titulo">Cargando tu curso…</h2>
          )}
        </section>

        <section className="tarjeta inicio-bloque inicio-avance" aria-labelledby="avance-titulo">
          <h2 id="avance-titulo">Tu avance</h2>
          <p className="inicio-avance-cifra">
            <span className="cifra">{hechas}</span>
            <span className="texto-suave">
              {" "}
              de <span className="cifra">{base.length || "…"}</span> lecciones
            </span>
          </p>
          <div
            className="progreso"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={base.length}
            aria-valuenow={hechas}
            aria-label="Lecciones completadas"
          >
            <span style={{ transform: `scaleX(${base.length ? hechas / base.length : 0})` }} />
          </div>
          <ul className="inicio-datos">
            <li>
              Repaso:{" "}
              <strong className="cifra">
                {expediente && expediente.repaso.total > 0
                  ? `${Math.round((expediente.repaso.aciertos / expediente.repaso.total) * 100)}%`
                  : "—"}
              </strong>
            </li>
            <li>
              Examen final:{" "}
              <strong>
                {examen?.aprobado
                  ? `Aprobado (${examen.mejorPuntaje}%)`
                  : examen && examen.intentos > 0
                    ? `${examen.intentos} de ${examen.intentosMaximos} intentos`
                    : terminado
                      ? "Disponible"
                      : "Al terminar las lecciones"}
              </strong>
            </li>
          </ul>
          <Link href="/perfil" className="enlace inicio-ver-todo">
            Ver mi expediente <IconoFlechaDer width={15} height={15} />
          </Link>
        </section>
      </div>

      <div className="inicio-fila">
        <section className="tarjeta-asistente inicio-asistente" aria-labelledby="asistente-inicio-titulo">
          <h2 id="asistente-inicio-titulo">
            <IconoAsistente width={18} height={18} /> Pregúntale al asistente
          </h2>
          <p>Responde con las lecciones de tu curso y te dice de qué lección sale cada respuesta.</p>
          <PreguntaRapida origen="inicio" />
          <div className="inicio-sugerencias">
            {datos?.curso.preguntas_sugeridas.slice(0, 2).map((p) => (
              <button key={p} type="button" className="sugerencia" onClick={() => preguntar(p)}>
                {p}
              </button>
            ))}
          </div>
        </section>

        <PublicacionesRecientes titulo="Conversaciones recientes" />
      </div>

      <section className="proximas" aria-labelledby="tendencia-titulo">
        <div className="inicio-bloque-cabecera">
          <div>
            <h2 id="tendencia-titulo">Comunidades en tendencia</h2>
            <p className="texto-suave">Comunidades de ejemplo que abren pronto.</p>
          </div>
          <Link href="/comunidades" className="enlace inicio-ver-todo">
            Ver todas <IconoFlechaDer width={15} height={15} />
          </Link>
        </div>
        <ul className="proximas-lista">
          {tendencia.map((c) => (
            <TarjetaComunidad key={c.id} comunidad={c} />
          ))}
        </ul>
      </section>
    </div>
  );
}
