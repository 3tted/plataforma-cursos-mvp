"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, moneda } from "@/lib/cliente";
import type { Expediente, ResumenCurso } from "@/lib/tipos";
import Arcos from "./Arcos";
import BotonInscribirse from "./BotonInscribirse";
import { useApp } from "./Contexto";
import { IconoAsistente, IconoFlechaDer } from "./Iconos";
import PortadaTema from "./PortadaTema";
import PreguntaRapida from "./PreguntaRapida";
import EnTendencia from "./EnTendencia";
import PublicacionesRecientes from "./PublicacionesRecientes";

// Inicio del alumno: seguir su curso, resolver dudas y ver qué pasa en la
// comunidad. Quien es nuevo primero se une a una comunidad y luego elige sus
// cursos; el inicio lo lleva paso a paso.
export default function InicioAlumno() {
  const router = useRouter();
  const {
    usuario,
    datos,
    lecciones,
    completadas,
    tieneAcceso,
    setPreguntaPendiente,
    setLeccionContexto,
    cursos,
    cursoId,
    cambiarCurso,
    inscripcionLista,
    enLaComunidad,
    inscritoEn,
    comunidades: COMUNIDADES,
    temaDe,
  } = useApp();
  const [expediente, setExpediente] = useState<Expediente | null>(null);

  // Comunidades reales y a cuáles pertenece; sus cursos son los que puede tomar.
  const reales = COMUNIDADES.filter((c) => c.estado === "activa");
  const unidas = reales.filter((c) => enLaComunidad(c.id));
  const cursosSuyos = cursos.filter((c) => enLaComunidad(c.comunidad));
  const inscritos = cursosSuyos.filter((c) => inscritoEn(c.id));
  const porInscribir = cursosSuyos.filter((c) => !inscritoEn(c.id));
  const nombreComunidad = (id: string) => reales.find((c) => c.id === id)?.nombre ?? "";
  const enCurso = inscritoEn(cursoId);

  useEffect(() => {
    if (!usuario || !enCurso) return;
    api<Expediente>(`/api/expediente?curso=${encodeURIComponent(cursoId)}`)
      .then(setExpediente)
      .catch(() => setExpediente(null));
  }, [usuario, completadas, cursoId, enCurso]);

  // El inicio sigue un curso en el que la persona está inscrita.
  const primerInscrito = inscritos[0]?.id;
  useEffect(() => {
    if (inscripcionLista && primerInscrito && !enCurso) cambiarCurso(primerInscrito);
  }, [inscripcionLista, primerInscrito, enCurso, cambiarCurso]);

  const base = lecciones.filter((l) => !l.deCoach);
  const hechas = base.filter((l) => completadas.includes(l.id)).length;
  const pendiente = base.find((l) => !completadas.includes(l.id));
  const bloqueada = !!pendiente && !pendiente.gratis && !tieneAcceso;
  const terminado = base.length > 0 && !pendiente;
  const numero = pendiente ? base.indexOf(pendiente) + 1 : base.length;
  const examen = expediente?.examen;
  const precio = moneda(datos?.comunidad.precio_mensual ?? 490);
  const comunidad = datos?.comunidad;

  const preguntar = (pregunta: string) => {
    setLeccionContexto(null);
    setPreguntaPendiente(pregunta);
    router.push("/curso/asistente");
  };

  const nombre = usuario?.nombre.split(" ")[0] ?? "";

  if (!inscripcionLista) return <p className="texto-suave">Cargando…</p>;

  const enTendencia = <EnTendencia />;

  // ---------------------------------------------------------------- paso 1: unirse a una comunidad
  if (unidas.length === 0) {
    return (
      <div className="inicio">
        <header className="inicio-saludo">
          <h1>Hola{nombre && `, ${nombre}`}</h1>
          <p className="texto-suave">Empieza por unirte a una comunidad. Unirte es gratis.</p>
        </header>
        <EnTendencia titulo="Para empezar" />
      </div>
    );
  }

  const tarjetaCurso = (c: ResumenCurso) => {
    const hechasCurso = c.lecciones.filter((id) => completadas.includes(id)).length;
    const portada = <PortadaTema tema={temaDe(c.comunidad)} clave={c.id} alt={`Portada del curso «${c.titulo}»`} />;
    const datosCurso = (
      <span className="texto-suave inicio-meta">
        {unidas.length > 1 && `${nombreComunidad(c.comunidad)} · `}
        <span className="cifra">{c.lecciones.length}</span> lecciones · <span className="cifra">{c.minutos}</span> min
      </span>
    );
    if (!inscritoEn(c.id)) {
      return (
        <li key={c.id} className="inicio-curso inicio-curso-alumno">
          {portada}
          <span className="inicio-curso-cuerpo">
            <span className="pastilla">Sin inscribir</span>
            <span className="ficha-nombre">{c.titulo}</span>
            {datosCurso}
            <span className="texto-suave inicio-meta">{c.subtitulo}</span>
            <BotonInscribirse curso={c.id} className="boton boton-chico" empezar />
          </span>
        </li>
      );
    }
    return (
      <li key={c.id}>
        <Link href="/curso" className="inicio-curso inicio-curso-alumno" onClick={() => cambiarCurso(c.id)}>
          {portada}
          <span className="inicio-curso-cuerpo">
            <span className="ficha-nombre">{c.titulo}</span>
            {datosCurso}
            <span className="progreso" aria-hidden="true">
              <span style={{ transform: `scaleX(${c.lecciones.length ? hechasCurso / c.lecciones.length : 0})` }} />
            </span>
            <span className="texto-suave inicio-meta">
              {hechasCurso === 0 ? "Sin empezar" : `${hechasCurso} de ${c.lecciones.length} lecciones completadas`}
            </span>
          </span>
        </Link>
      </li>
    );
  };

  const listaCursos = (
    <section className="inicio-bloque" aria-labelledby="tus-cursos-titulo">
      <div className="inicio-bloque-cabecera">
        <div>
          <h2 id="tus-cursos-titulo">
            {inscritos.length ? "Tus cursos" : unidas.length > 1 ? "Cursos de tus comunidades" : `Cursos de ${unidas[0].nombre}`}
          </h2>
          {porInscribir.length > 0 && (
            <p className="texto-suave">Inscríbete a un curso y toma gratis su módulo 1.</p>
          )}
        </div>
      </div>
      <ul className="inicio-cursos">{[...inscritos, ...porInscribir].map(tarjetaCurso)}</ul>
    </section>
  );

  // ---------------------------------------------------------------- paso 2: elegir el primer curso
  if (inscritos.length === 0) {
    return (
      <div className="inicio">
        <header className="inicio-saludo">
          <h1>Hola{nombre && `, ${nombre}`}</h1>
          <p className="texto-suave">
            Ya eres parte de {unidas.map((c) => c.nombre).join(" y ")}. Ahora elige tu primer curso.
          </p>
        </header>
        {listaCursos}
        <PublicacionesRecientes titulo="Conversaciones recientes" />
        {enTendencia}
      </div>
    );
  }

  // ---------------------------------------------------------------- inscrito: seguir aprendiendo
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
                  : "Preguntas de todo el curso. Lo apruebas con 70%."}
              </p>
              <Link href={examen?.aprobado ? "/perfil" : "/curso/examen"} className="boton">
                {examen?.aprobado ? "Ver mi expediente" : "Presentar el examen"} <IconoFlechaDer width={16} height={16} />
              </Link>
            </>
          ) : pendiente && enCurso ? (
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
          {cursosSuyos.length > 1 && <p className="texto-suave inicio-meta">{datos?.curso.titulo}</p>}
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

      {(cursosSuyos.length > 1 || porInscribir.length > 0) && listaCursos}

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

      {enTendencia}
    </div>
  );
}
