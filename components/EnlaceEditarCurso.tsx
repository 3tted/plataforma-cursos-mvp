"use client";

import Link from "next/link";
import { useApp } from "./Contexto";
import { IconoEditar } from "./Iconos";

/** Los cursos que crean las coaches desde la plataforma tienen ids "c123". */
export const esCursoCreado = (id: string) => /^c\d+$/.test(id);

// Para la coach, en un curso que ella creó: el enlace a su editor.
export default function EnlaceEditarCurso({ texto = "Editar curso", className = "" }: { texto?: string; className?: string }) {
  const { datos, usuario } = useApp();
  if (usuario?.rol !== "coach" || !datos || !esCursoCreado(datos.curso.id)) return null;
  if (datos.comunidad.coach !== usuario.nombre) return null;
  return (
    <Link href={`/coach/curso/${datos.curso.id}`} className={`enlace enlace-editar ${className}`}>
      <IconoEditar width={15} height={15} /> {texto}
    </Link>
  );
}
