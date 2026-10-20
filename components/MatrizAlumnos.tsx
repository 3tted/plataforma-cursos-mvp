"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ESTADO_ALUMNO, api, hace } from "@/lib/cliente";
import { MIN_RESPUESTAS, type EstadoAlumno, type Expediente, type MatrizAlumnos as Matriz } from "@/lib/tipos";
import { IconoBorrar, IconoDescargar } from "./Iconos";

const ESTADOS: EstadoAlumno[] = ["aprobado", "examen-pendiente", "en-curso", "requiere-apoyo"];

const porcentaje = (a: number, t: number) => (t ? `${Math.round((a / t) * 100)}%` : "");

function examenTexto(e: Expediente) {
  return e.examen.mejorPuntaje === null ? "" : `${e.examen.mejorPuntaje}%`;
}

// Descarga la matriz como CSV (con BOM para que Excel lea bien los acentos).
function descargarCsv(matriz: Matriz, alumnos: Expediente[]) {
  const celda = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  const encabezado = [
    "Alumno",
    ...matriz.modulos.map((m, i) => `Módulo ${i + 1}: ${m.titulo}`),
    "Repaso",
    "Examen final",
    "Intentos",
    "Estado",
    "Última actividad",
  ];
  const filas = alumnos.map((e) => [
    e.autor,
    ...e.porModulo.map((m) => `${m.hechas}/${m.total}`),
    porcentaje(e.repaso.aciertos, e.repaso.total),
    examenTexto(e),
    `${e.examen.intentos} de ${e.examen.intentosMaximos}`,
    ESTADO_ALUMNO[e.estado].texto,
    e.ultimaActividad ? new Date(e.ultimaActividad).toLocaleString("es-MX") : "",
  ]);
  const csv = "﻿" + [encabezado, ...filas].map((f) => f.map(celda).join(",")).join("\r\n");
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  enlace.download = `alumnos-${matriz.curso.id}-${new Date().toISOString().slice(0, 10)}.csv`;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

// La matriz del curso que la coach eligió arriba en su panel.
export default function MatrizAlumnos({ curso }: { curso: string }) {
  const [matriz, setMatriz] = useState<Matriz | null>(null);
  const [error, setError] = useState(false);
  const [filtro, setFiltro] = useState<EstadoAlumno | "todos">("todos");
  const [porQuitar, setPorQuitar] = useState<string | null>(null);
  const [errorQuitar, setErrorQuitar] = useState<string | null>(null);

  // Si la coach cambia de curso antes de que llegue la matriz anterior, esa ya no se muestra.
  const vigente = useRef(curso);
  const cargar = useCallback(() => {
    vigente.current = curso;
    setError(false);
    api<Matriz>(`/api/coach/alumnos?curso=${encodeURIComponent(curso)}`)
      .then((m) => vigente.current === curso && setMatriz(m))
      .catch(() => vigente.current === curso && setError(true));
  }, [curso]);

  // Al cambiar de curso, la matriz y los filtros empiezan de cero.
  useEffect(() => {
    setMatriz(null);
    setFiltro("todos");
    setPorQuitar(null);
    cargar();
  }, [cargar]);

  const quitar = async (autor: string) => {
    setErrorQuitar(null);
    try {
      await api(`/api/coach/alumnos?autor=${encodeURIComponent(autor)}`, { method: "DELETE" });
      setPorQuitar(null);
      cargar();
    } catch (e) {
      setErrorQuitar((e as Error).message);
    }
  };

  const conteo = useMemo(() => {
    const c = new Map<EstadoAlumno, number>();
    for (const a of matriz?.alumnos ?? []) c.set(a.estado, (c.get(a.estado) ?? 0) + 1);
    return c;
  }, [matriz]);

  const visibles = matriz?.alumnos.filter((a) => filtro === "todos" || a.estado === filtro) ?? [];
  const tituloDe = (id: string) => matriz?.titulos[id] ?? id;

  return (
    <section className="tarjeta matriz" aria-labelledby="matriz-titulo">
      <div className="matriz-cabecera">
        <div>
          <h2 id="matriz-titulo">Avance de tus alumnos</h2>
          <p className="texto-suave">
            Lecciones por módulo, repaso y examen final de cada alumno en este curso.
            {matriz && ` Se aprueba con ${matriz.aprobarCon}%.`}
          </p>
        </div>
        {matriz && matriz.alumnos.length > 0 && (
          <button type="button" className="boton boton-secundario boton-chico" onClick={() => descargarCsv(matriz, visibles)}>
            <IconoDescargar width={15} height={15} /> Descargar CSV
          </button>
        )}
      </div>

      {error && <p className="error">No pudimos cargar el avance de tus alumnos. Recarga la página.</p>}
      {!matriz && !error && <p className="texto-suave">Cargando…</p>}
      {matriz && matriz.alumnos.length === 0 && (
        <p className="vacio">
          Todavía no hay avance. Cuando un alumno complete una lección o responda un repaso, aparece aquí.
        </p>
      )}

      {matriz && matriz.alumnos.length > 0 && (
        <>
          <div className="filtros matriz-filtros" role="group" aria-label="Filtrar por estado">
            <button type="button" className="filtro" aria-pressed={filtro === "todos"} onClick={() => setFiltro("todos")}>
              Todos <span className="cifra">{matriz.alumnos.length}</span>
            </button>
            {ESTADOS.map((e) => (
              <button key={e} type="button" className="filtro" aria-pressed={filtro === e} onClick={() => setFiltro(e)}>
                {ESTADO_ALUMNO[e].texto} <span className="cifra">{conteo.get(e) ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="tabla-desplazable">
            <table className="tabla-pagos tabla-matriz">
              <thead>
                <tr>
                  <th scope="col">Alumno</th>
                  {matriz.modulos.map((m, i) => (
                    <th key={m.id} scope="col" title={m.titulo}>
                      Módulo {i + 1}
                    </th>
                  ))}
                  <th scope="col">Repaso</th>
                  <th scope="col">Examen final</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Última actividad</th>
                  <th scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((a) => (
                  <tr key={a.autor}>
                    <th scope="row">{a.autor}</th>
                    {a.porModulo.map((m) => (
                      <td key={m.id} className="numero" data-completo={m.total > 0 && m.hechas === m.total}>
                        {m.hechas}/{m.total}
                      </td>
                    ))}
                    <td className="numero">{porcentaje(a.repaso.aciertos, a.repaso.total) || "—"}</td>
                    <td className="numero">
                      {examenTexto(a) || "—"}
                      {a.examen.intentos > 0 && (
                        <span className="texto-suave">
                          {" "}
                          · {a.examen.intentos} de {a.examen.intentosMaximos}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={ESTADO_ALUMNO[a.estado].clase}>{ESTADO_ALUMNO[a.estado].texto}</span>
                    </td>
                    <td className="texto-suave">{a.ultimaActividad ? hace(a.ultimaActividad) : "—"}</td>
                    <td className="matriz-acciones">
                      {porQuitar === a.autor ? (
                        <span className="confirmacion" role="group" aria-label={`Confirmar que quitas a ${a.autor}`}>
                          ¿Quitar su avance de todos los cursos?
                          <button type="button" className="boton boton-chico" onClick={() => quitar(a.autor)}>
                            Sí, quitar
                          </button>
                          <button type="button" className="boton boton-chico boton-fantasma" onClick={() => setPorQuitar(null)}>
                            Cancelar
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="boton-icono boton-icono-chico"
                          onClick={() => setPorQuitar(a.autor)}
                          aria-label={`Quitar a ${a.autor} de la matriz`}
                          title="Quitar de la matriz"
                        >
                          <IconoBorrar width={15} height={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibles.length === 0 && <p className="vacio">Ningún alumno en este estado.</p>}
          {errorQuitar && (
            <p className="error" role="alert">
              {errorQuitar}
            </p>
          )}
        </>
      )}

      {matriz && matriz.masFalladas.length > 0 && (
        <div className="matriz-falladas">
          <h3>Las preguntas que más fallan</h3>
          <p className="texto-suave">
            Un tema con muchas fallas suele indicar una lección que conviene reforzar. El porcentaje aparece cuando una
            pregunta ya tiene {MIN_RESPUESTAS} respuestas o más.
          </p>
          <ul className="barras">
            {matriz.masFalladas.map((p) => (
              <li key={p.id}>
                <span className="barra-etiqueta matriz-pregunta">
                  <span className={p.tipo === "examen" ? "pastilla pastilla-marca" : "pastilla"}>
                    {p.tipo === "examen" ? "Examen" : "Repaso"}
                  </span>{" "}
                  <Link href={`/curso/${p.leccion}`} className="cita-id" title={tituloDe(p.leccion)}>
                    {p.leccion}
                  </Link>{" "}
                  {p.enunciado}
                </span>
                {p.respuestas >= MIN_RESPUESTAS ? (
                  <>
                    <span className="barra-pista">
                      <span className="barra-relleno" style={{ width: `${(p.fallas / p.respuestas) * 100}%` }} />
                    </span>
                    <span className="barra-valor" title={`${p.fallas} de ${p.respuestas} respuestas equivocadas`}>
                      {Math.round((p.fallas / p.respuestas) * 100)}%
                    </span>
                  </>
                ) : (
                  <span className="barra-conteo texto-suave">
                    <span className="cifra">{p.fallas}</span> de <span className="cifra">{p.respuestas}</span>{" "}
                    {p.fallas === 1 ? "falló" : "fallaron"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
