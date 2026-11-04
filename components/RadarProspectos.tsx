"use client";

import { useEffect, useState } from "react";
import { api, hace } from "@/lib/cliente";
import { diagnostico as buscarDiagnostico } from "@/lib/diagnosticos";
import type { ProspectoDiagnostico } from "@/lib/tipos";
import { useApp } from "./Contexto";
import { IconoDescargar, IconoWhatsapp } from "./Iconos";

type Prospecto = Omit<ProspectoDiagnostico, "respuestas" | "empresa">;

// En el inicio del coach: la dirección de la página pública de su diagnóstico
// (/radar/<empresa>) para compartirla, y quienes lo respondieron ahí y dejaron
// sus datos, con su resultado, para darles seguimiento. Solo aparece si su
// empresa tiene un curso publicado con un diagnóstico.
export default function RadarProspectos() {
  const { usuario } = useApp();
  const empresa = usuario?.empresa;
  const [datos, setDatos] = useState<{ diagnostico: string; prospectos?: Prospecto[] } | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!empresa) return;
    api<{ diagnostico: string; prospectos?: Prospecto[] }>(`/api/radar/${encodeURIComponent(empresa)}`)
      .then(setDatos)
      .catch(() => setDatos(null));
  }, [empresa]);

  const d = datos ? buscarDiagnostico(datos.diagnostico) : undefined;
  if (!empresa || !datos?.prospectos || !d) return null;
  const prospectos = datos.prospectos;
  const direccion = `${window.location.origin}/radar/${empresa}`;
  const maximo = d.dimensiones.reduce((s, x) => s + x.afirmaciones.length, 0) * Math.max(...d.escala.map((e) => e.valor));
  const nombre = (id: string) => d.dimensiones.find((x) => x.id === id)?.nombre ?? id;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(direccion);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copia la dirección:", direccion);
    }
  };

  const descargar = () => {
    const celda = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
    const filas = [
      ["Nombre", "WhatsApp", "Correo", "Fecha", ...d.dimensiones.map((x) => x.nombre), "Total", "Dimensión más baja"],
      ...prospectos.map((p) => [
        p.nombre,
        p.whatsapp ? `+${p.whatsapp}` : "",
        p.correo ?? "",
        p.actualizadoEn.slice(0, 10),
        ...d.dimensiones.map((x) => p.puntos[x.id] ?? ""),
        p.total,
        p.masBajas.map(nombre).join(" y "),
      ]),
    ];
    const csv = "﻿" + filas.map((f) => f.map(celda).join(",")).join("\r\n");
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    enlace.download = `${d.id}-prospectos.csv`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  };

  return (
    <section className="tarjeta inicio-bloque radar-prospectos" aria-labelledby="radar-prospectos-titulo">
      <div className="inicio-bloque-cabecera">
        <h2 id="radar-prospectos-titulo">
          Tu página del Radar <span className="cifra">{prospectos.length}</span>
        </h2>
        {prospectos.length > 0 && (
          <button type="button" className="boton boton-fantasma" onClick={descargar}>
            <IconoDescargar width={16} height={16} /> Descargar en Excel (CSV)
          </button>
        )}
      </div>
      <p className="texto-suave">
        Compártela en tus redes o por WhatsApp: cualquiera responde el Radar sin cuenta, ve su resultado y te deja sus
        datos para agendar.
      </p>
      <div className="radar-prospectos-enlace">
        <a href={`/radar/${empresa}`} target="_blank" rel="noopener">
          {direccion.replace(/^https?:\/\//, "")}
        </a>
        <button type="button" className="boton boton-secundario" onClick={copiar}>
          {copiado ? "Copiada" : "Copiar dirección"}
        </button>
      </div>
      {prospectos.length === 0 ? (
        <p className="texto-suave">Todavía nadie deja sus datos. Aquí verás a cada persona con su resultado.</p>
      ) : (
        <ul className="inicio-lista">
          {prospectos.slice(0, 8).map((p) => (
            <li key={p.id} className="radar-prospecto">
              <span className="inicio-publicacion-texto">
                <span className="inicio-publicacion-titulo">{p.nombre}</span>
                <span className="texto-suave inicio-meta">
                  <span className="cifra">
                    {p.total}/{maximo}
                  </span>{" "}
                  · Más baja: {p.masBajas.map(nombre).join(" y ")} · {hace(p.actualizadoEn)}
                </span>
              </span>
              <span className="radar-prospecto-contacto">
                {p.whatsapp && (
                  <a
                    className="pastilla"
                    href={`https://wa.me/${p.whatsapp}?text=${encodeURIComponent(`Hola, ${p.nombre.split(" ")[0]}. Vi tu resultado del ${d.titulo}.`)}`}
                    target="_blank"
                    rel="noopener"
                  >
                    <IconoWhatsapp width={14} height={14} /> WhatsApp
                  </a>
                )}
                {p.correo && (
                  <a className="pastilla" href={`mailto:${p.correo}`}>
                    Correo
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
