"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { useApp } from "./Contexto";
import { IconoBillete } from "./Iconos";

// Renderiza el subconjunto de Markdown que usan las lecciones y el asistente:
// párrafos, **negritas**, _cursivas_, listas, citas (>), subtítulos (##),
// tablas simples y referencias a lecciones como [L4]. Todo se construye como
// elementos de React, nunca como HTML crudo. Los montos y porcentajes se
// escriben en letra monoespaciada, como en una libreta de cuentas. En las
// respuestas del asistente (fuentes) las referencias no se repiten en cada
// párrafo: se juntan una sola vez en "Fuentes", al final.

// Grupos: 1 negritas, 2 referencias, 3 cursivas con _, 4 montos, 5 cursivas con *.
const PATRON_EN_LINEA =
  /(\*\*[^*]+\*\*)|(\[(?:[LPWKC]\d+)(?:\s*,\s*[LPWKC]\d+)*\])|((?<=^|[\s(])_[^_\n]+_(?=$|[\s.,;:!?)]))|(\$\d[\d,]*(?:\.\d+)?|(?<![\w$.,])\d+(?:\.\d+)?\s?%)|((?<![*\w])\*(?![\s*])[^*\n]+?(?<![\s*])\*(?![*\w]))/g;

function Cita({ id }: { id: string }) {
  const { lecciones, tieneAcceso } = useApp();
  const leccion = lecciones.find((l) => l.id === id);
  if (!leccion) return <span className="cita cita-desconocida">{id}</span>;
  const bloqueada = !leccion.gratis && !tieneAcceso;
  return (
    <Link
      className="cita"
      href={`/curso/${id}`}
      title={bloqueada ? `${leccion.titulo} (lección para miembros)` : leccion.titulo}
      data-bloqueada={bloqueada}
    >
      <span className="cita-id">{id}</span>
      {bloqueada && (
        <span className="cita-candado">
          <IconoBillete width={13} height={13} />
          <span className="sr-only">Lección para miembros:</span>
        </span>
      )}
      <span className="cita-titulo">{leccion.titulo}</span>
    </Link>
  );
}

/** Si llega, las referencias se guardan aquí en vez de dibujarse en el texto. */
type Fuentes = string[] | undefined;

function enLinea(texto: string, fuentes?: Fuentes): ReactNode[] {
  const nodos: ReactNode[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(PATRON_EN_LINEA)) {
    const inicio = m.index ?? 0;
    if (inicio > ultimo) nodos.push(texto.slice(ultimo, inicio));
    if (m[1]) nodos.push(<strong key={inicio}>{enLinea(m[1].slice(2, -2), fuentes)}</strong>);
    else if (m[4])
      nodos.push(
        <span key={inicio} className="cifra">
          {m[4]}
        </span>,
      );
    else if (m[2] && fuentes) {
      for (const id of m[2]
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim()))
        if (!fuentes.includes(id)) fuentes.push(id);
      // Sin la referencia, que no quede un espacio suelto antes del punto.
      const previo = nodos.at(-1);
      if (typeof previo === "string") nodos[nodos.length - 1] = previo.replace(/\s+$/, "");
    } else if (m[2]) {
      const ids = m[2]
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim());
      nodos.push(
        <span key={inicio} className="citas">
          {ids.map((id) => (
            <Cita key={id} id={id} />
          ))}
        </span>,
      );
    } else if (m[3]) nodos.push(<em key={inicio}>{m[3].slice(1, -1)}</em>);
    else if (m[5]) nodos.push(<em key={inicio}>{enLinea(m[5].slice(1, -1), fuentes)}</em>);
    ultimo = inicio + m[0].length;
  }
  if (ultimo < texto.length) nodos.push(texto.slice(ultimo));
  return nodos;
}

type Bloque =
  | { tipo: "p" | "h" | "cita"; texto: string }
  | { tipo: "ul" | "ol"; items: string[] }
  | { tipo: "tabla"; filas: string[][] };

function bloques(texto: string): Bloque[] {
  const lineas = texto.replace(/\r\n/g, "\n").split("\n");
  const lista: Bloque[] = [];
  let i = 0;
  while (i < lineas.length) {
    const linea = lineas[i].trim();
    if (!linea) {
      i++;
      continue;
    }
    if (/^#{1,6}\s/.test(linea)) {
      lista.push({ tipo: "h", texto: linea.replace(/^#+\s*/, "") });
      i++;
    } else if (/^[-*]\s/.test(linea) || /^\d+\.\s/.test(linea)) {
      const ordenada = /^\d+\.\s/.test(linea);
      const items: string[] = [];
      while (i < lineas.length && (ordenada ? /^\d+\.\s/ : /^[-*]\s/).test(lineas[i].trim())) {
        items.push(lineas[i].trim().replace(/^(?:[-*]|\d+\.)\s+/, ""));
        i++;
      }
      lista.push({ tipo: ordenada ? "ol" : "ul", items });
    } else if (linea.startsWith(">")) {
      const partes: string[] = [];
      while (i < lineas.length && lineas[i].trim().startsWith(">")) {
        partes.push(lineas[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      // Cada renglón de la cita conserva su salto: así las operaciones no salen corridas.
      lista.push({ tipo: "cita", texto: partes.join("\n") });
    } else if (linea.startsWith("|")) {
      const filas: string[][] = [];
      while (i < lineas.length && lineas[i].trim().startsWith("|")) {
        const celdas = lineas[i]
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
        if (!celdas.every((c) => /^:?-{2,}:?$/.test(c))) filas.push(celdas);
        i++;
      }
      lista.push({ tipo: "tabla", filas });
    } else {
      const partes: string[] = [];
      while (i < lineas.length) {
        const l = lineas[i].trim();
        if (!l || /^(#{1,6}\s|[-*]\s|\d+\.\s|>|\|)/.test(l)) break;
        partes.push(l);
        i++;
      }
      lista.push({ tipo: "p", texto: partes.join(" ") });
    }
  }
  return lista;
}

export default function Markdown({
  texto,
  className,
  nivelTitulos = 3,
  conFuentes = false,
}: {
  texto: string;
  className?: string;
  /** Nivel de los subtítulos (##): 2 dentro de una página cuyo h1 es la lección. */
  nivelTitulos?: 2 | 3;
  /** Respuestas del asistente: las referencias van una sola vez en "Fuentes", al final. */
  conFuentes?: boolean;
}) {
  const Titulo = nivelTitulos === 2 ? "h2" : "h3";
  const fuentes: Fuentes = conFuentes ? [] : undefined;
  const enLinea2 = (t: string) => enLinea(t, fuentes);
  const contenido = bloques(texto).map((b, i) => {
    switch (b.tipo) {
      case "h":
        return <Titulo key={i}>{enLinea2(b.texto)}</Titulo>;
      case "p":
        return <p key={i}>{enLinea2(b.texto)}</p>;
      case "cita":
        return (
          <blockquote key={i}>
            {b.texto.split("\n").map((renglon, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {enLinea2(renglon)}
              </Fragment>
            ))}
          </blockquote>
        );
      case "ul":
      case "ol": {
        const Lista = b.tipo;
        return (
          <Lista key={i}>
            {b.items.map((item, j) => (
              <li key={j}>{enLinea2(item)}</li>
            ))}
          </Lista>
        );
      }
      case "tabla":
        return (
          <div key={i} className="tabla-desplazable">
            <table>
              <tbody>
                {b.filas.map((fila, j) => (
                  <tr key={j}>
                    {fila.map((celda, k) => {
                      const Celda = j === 0 ? "th" : "td";
                      return <Celda key={k}>{enLinea2(celda)}</Celda>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default:
        return <Fragment key={i} />;
    }
  });
  return (
    <div className={className ?? "prosa"}>
      {contenido}
      {fuentes && fuentes.length > 0 && (
        <div className="fuentes">
          <p className="fuentes-titulo">Fuentes</p>
          <div className="citas">
            {fuentes.map((id) => (
              <Cita key={id} id={id} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
