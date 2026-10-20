"use client";

import { useRef, useState } from "react";
import { IconoSubir } from "../Iconos";
import PortadaTema from "../PortadaTema";

const LADO_MAXIMO = 1600;

// Reduce la foto en el navegador (lado mayor de 1600 px, JPEG): así sube
// rápido y cabe holgada en el servidor aunque venga directo del celular.
async function reducir(archivo: File): Promise<Blob> {
  const url = URL.createObjectURL(archivo);
  try {
    const imagen = new Image();
    imagen.src = url;
    await imagen.decode();
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.naturalWidth, imagen.naturalHeight));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(imagen.naturalWidth * escala);
    lienzo.height = Math.round(imagen.naturalHeight * escala);
    lienzo.getContext("2d")!.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise<Blob | null>((listo) => lienzo.toBlob(listo, "image/jpeg", 0.85));
    if (!blob) throw new Error();
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Foto de portada de una comunidad o un curso: subir, cambiar o quitar. Sin
// foto, la portada lleva el ícono de su tema.
export default function FotoPortada({
  de,
  id,
  tema,
  foto,
  alCambiar,
}: {
  de: "comunidad" | "curso";
  id: string;
  tema: string;
  foto: string | undefined;
  alCambiar: (foto: string | undefined) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ruta = `/api/fotos/${de}-${id}`;

  const subir = async (archivo: File) => {
    if (!archivo.type.startsWith("image/")) return setError("Ese archivo no es una foto.");
    setError(null);
    setSubiendo(true);
    try {
      const blob = await reducir(archivo).catch(() => {
        throw new Error("No pudimos abrir esa foto. Prueba con una JPG o PNG.");
      });
      const res = await fetch(ruta, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: blob });
      const datos = (await res.json().catch(() => ({}))) as { foto?: string; error?: string };
      if (!res.ok || !datos.foto) throw new Error(datos.error ?? "No se pudo subir la foto. Inténtalo de nuevo.");
      alCambiar(datos.foto);
    } catch (e) {
      setError(e instanceof TypeError ? "Se cortó la conexión mientras subía la foto." : (e as Error).message);
    } finally {
      setSubiendo(false);
    }
  };

  const quitar = async () => {
    setError(null);
    const res = await fetch(ruta, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return setError("No se pudo quitar la foto.");
    alCambiar(undefined);
  };

  return (
    <div className="foto-portada">
      <PortadaTema tema={tema} clave={id} foto={foto} className="foto-portada-vista" alt="Vista previa de la portada" />
      <div className="foto-portada-acciones">
        <p className="foto-portada-titulo">Foto de portada</p>
        <p className="nota">
          {foto
            ? "Se ve en las tarjetas y en la portada."
            : `Sin foto, la portada lleva el ícono de ${tema === "Otro" ? "su tema" : `«${tema}»`}.`}{" "}
          JPG, PNG o WebP; horizontal se ve mejor.
        </p>
        <input
          ref={entrada}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            e.target.value = "";
            if (archivo) void subir(archivo);
          }}
        />
        <div className="foto-portada-botones">
          <button
            type="button"
            className="boton boton-chico boton-fantasma-borde"
            onClick={() => entrada.current?.click()}
            disabled={subiendo}
          >
            <IconoSubir width={15} height={15} /> {subiendo ? "Subiendo…" : foto ? "Cambiar foto" : "Subir foto"}
          </button>
          {foto && !subiendo && (
            <button type="button" className="enlace enlace-discreto" onClick={() => void quitar()}>
              Quitar
            </button>
          )}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
