import type { CSSProperties } from "react";
import { iniciales, tonoDe } from "@/lib/cliente";

// La coach lleva el rojo de la marca y un anillo: se reconoce de un vistazo en el feed.
export default function Avatar({
  nombre,
  tamaño = 36,
  coach = false,
}: {
  nombre: string;
  tamaño?: number;
  coach?: boolean;
}) {
  const estilo = {
    "--tono": tonoDe(nombre),
    width: tamaño,
    height: tamaño,
    // Nunca menos de 11 px: en los avatares chicos (24 px) las iniciales se seguían leyendo mal.
    fontSize: Math.max(11, Math.round(tamaño * 0.38)),
  } as CSSProperties;
  return (
    <span className={coach ? "avatar avatar-coach" : "avatar"} style={estilo} aria-hidden="true">
      {iniciales(nombre)}
    </span>
  );
}
