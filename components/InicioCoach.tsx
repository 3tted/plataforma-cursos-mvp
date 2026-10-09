"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ESTADO_ALUMNO, api, hace } from "@/lib/cliente";
import { temaDe } from "@/lib/comunidades";
import { agrupar, sinResolver } from "@/lib/preguntas";
import type { MatrizAlumnos, ResumenCoach } from "@/lib/tipos";
import Avatar from "./Avatar";
import { useApp } from "./Contexto";
import { IconoComunidad, IconoFlechaDer } from "./Iconos";
import PortadaTema from "./PortadaTema";
import PublicacionesRecientes from "./PublicacionesRecientes";

// Primero quien necesita ayuda, luego quien está por presentar el examen.
const PRIORIDAD = { "requiere-apoyo": 0, "examen-pendiente": 1, "en-curso": 2, "sin-iniciar": 3, aprobado: 4 } as const;

// Inicio de la coach: sus cursos, sus alumnos y lo que le toca contestar.
export default function InicioCoach() {
  const router = useRouter();
  const { usuario, datos, setBorrador, cursos, cambiarCurso } = useApp();
  const [resumen, setResumen] = useState<ResumenCoach | null>(null);
  const [matrices, setMatrices] = useState<MatrizAlumnos[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api<ResumenCoach>("/api/coach/resumen")
      .then(setResumen)
      .catch(() => setError(true));
  }, []);

  // Una matriz por curso; aquí se juntan para ver de un vistazo quién necesita apoyo.
  useEffect(() => {
    if (cursos.length === 0) return;
    Promise.all(cursos.map((c) => api<MatrizAlumnos>(`/api/coach/alumnos?curso=${encodeURIComponent(c.id)}`)))
      .then(setMatrices)
      .catch(() => setError(true));
  }, [cursos]);

  const pendientes = useMemo(() => sinResolver(agrupar(resumen?.preguntas ?? [])).slice(0, 4), [resumen]);
  const filas = useMemo(
    () => matrices?.flatMap((m) => m.alumnos.map((a) => ({ ...a, curso: m.curso }))) ?? [],
    [matrices],
  );
  const alumnos = useMemo(
    () =>
      [...filas]
        .sort(
          (a, b) =>
            PRIORIDAD[a.estado] - PRIORIDAD[b.estado] || (b.ultimaActividad ?? "").localeCompare(a.ultimaActividad ?? ""),
        )
        .slice(0, 5),
    [filas],
  );
  const apoyo = matrices ? filas.filter((a) => a.estado === "requiere-apoyo").length : undefined;
  const nombre = usuario?.nombre.split(" ")[0] ?? "";

  const responder = (pregunta: string, veces: number) => {
    setBorrador({
      categoria: "Dudas",
      titulo: pregunta.length > 140 ? pregunta.slice(0, 137) + "…" : pregunta,
      cuerpo: `${veces > 1 ? `Esta pregunta me la hicieron ${veces} veces en el asistente.` : "Me hicieron esta pregunta en el asistente."} Mi respuesta:\n\n`,
    });
    router.push("/comunidad");
  };

  return (
    <div className="inicio">
      <header className="inicio-saludo">
        <h1>Hola{nombre && `, ${nombre}`}</h1>
        <p className="texto-suave">Esto pasa hoy en {datos?.comunidad.nombre ?? "tu comunidad"}.</p>
      </header>

      {error && (
        <p className="error" role="alert">
          No pudimos cargar el resumen de tu comunidad. Recarga la página para intentarlo de nuevo.
        </p>
      )}

      <dl className="datos-coach">
        <div>
          <dt>Miembros activos</dt>
          <dd className="cifra">{resumen?.miembros ?? "…"}</dd>
        </div>
        <div>
          <dt>Preguntas al asistente (7 días)</dt>
          <dd className="cifra">{resumen?.preguntasSemana ?? "…"}</dd>
        </div>
        <div>
          <dt>Preguntas sin resolver</dt>
          <dd className="cifra">{resumen ? sinResolver(agrupar(resumen.preguntas)).length : "…"}</dd>
        </div>
        <div>
          <dt>Alumnos que requieren apoyo</dt>
          <dd className="cifra">{apoyo ?? "…"}</dd>
        </div>
      </dl>

      <section className="inicio-bloque" aria-labelledby="mis-cursos-titulo">
        <div className="inicio-bloque-cabecera">
          <h2 id="mis-cursos-titulo">Mis cursos</h2>
        </div>
        <ul className="inicio-cursos">
          {cursos.map((c) => {
            const enMatriz = matrices?.find((m) => m.curso.id === c.id)?.alumnos.length;
            return (
              <li key={c.id}>
                <Link href="/curso" className="inicio-curso" onClick={() => cambiarCurso(c.id)}>
                  <PortadaTema tema={temaDe(c.comunidad)} clave={c.id} />
                  <span className="inicio-curso-cuerpo">
                    <span className="pastilla pastilla-ok">Publicado</span>
                    <span className="ficha-nombre">{c.titulo}</span>
                    <span className="texto-suave inicio-meta">
                      <span className="cifra">{c.lecciones.length}</span> lecciones · <span className="cifra">{c.minutos}</span>{" "}
                      min · <span className="cifra">{enMatriz ?? "…"}</span> {enMatriz === 1 ? "alumno" : "alumnos"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="inicio-curso inicio-curso-nuevo">
            <span className="inicio-curso-cuerpo">
              <span className="pastilla">Próximamente</span>
              <span className="ficha-nombre">Crear un curso con IA</span>
              <span className="texto-suave">
                Sube tus documentos y la IA te propone módulos, lecciones y preguntas de repaso. Tú lo revisas antes de
                publicarlo.
              </span>
            </span>
          </li>
        </ul>
      </section>

      <div className="inicio-fila">
        <section className="tarjeta inicio-bloque" aria-labelledby="alumnos-titulo">
          <div className="inicio-bloque-cabecera">
            <h2 id="alumnos-titulo">Tus alumnos</h2>
            <Link href="/coach" className="enlace inicio-ver-todo">
              Ver la matriz <IconoFlechaDer width={15} height={15} />
            </Link>
          </div>
          {matrices && alumnos.length === 0 && (
            <p className="vacio">Todavía no hay avance. Cuando un alumno complete una lección, aparece aquí.</p>
          )}
          <ul className="inicio-lista">
            {alumnos.map((a) => (
              <li key={`${a.curso.id}-${a.autor}`} className="inicio-alumno">
                <Avatar nombre={a.autor} tamaño={34} />
                <span className="inicio-publicacion-texto">
                  <span className="inicio-publicacion-titulo">{a.autor}</span>
                  <span className="texto-suave inicio-meta">
                    <span className="cifra">
                      {a.leccionesHechas} de {a.leccionesTotal}
                    </span>{" "}
                    lecciones de {a.curso.titulo}
                    {a.ultimaActividad && ` · ${hace(a.ultimaActividad)}`}
                  </span>
                </span>
                <span className={ESTADO_ALUMNO[a.estado].clase}>{ESTADO_ALUMNO[a.estado].texto}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="tarjeta inicio-bloque" aria-labelledby="sin-resolver-titulo">
          <div className="inicio-bloque-cabecera">
            <h2 id="sin-resolver-titulo">Preguntas sin resolver</h2>
            <Link href="/coach" className="enlace inicio-ver-todo">
              Ver todas <IconoFlechaDer width={15} height={15} />
            </Link>
          </div>
          <p className="texto-suave">Lo que el asistente no encontró en tus lecciones. Contéstalo tú o haz una lección.</p>
          {resumen && pendientes.length === 0 && (
            <p className="vacio">Nada pendiente: el asistente pudo responder todo con tus lecciones.</p>
          )}
          <ul className="inicio-lista">
            {pendientes.map((g) => (
              <li key={g.clave} className="inicio-pregunta">
                <p className="inicio-publicacion-titulo">{g.pregunta}</p>
                <p className="texto-suave inicio-meta">
                  {g.personas === 1 ? g.ultima.autor : `${g.personas} personas`} ·{" "}
                  <span className="cifra">{g.veces}</span> {g.veces === 1 ? "vez" : "veces"} · {hace(g.ultima.creadaEn)}
                </p>
                <button type="button" className="accion" onClick={() => responder(g.pregunta, g.veces)}>
                  <IconoComunidad width={15} height={15} /> Responder en la comunidad
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <PublicacionesRecientes titulo="Lo último en tu comunidad" />
    </div>
  );
}
