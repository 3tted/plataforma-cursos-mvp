"use client";

import Link from "next/link";
import { useApp } from "./Contexto";
import { IconoEditar } from "./Iconos";

/** Los cursos que crean las coaches desde la plataforma tienen ids "c123". */
export const esCursoCreado = (id: string) => /^c\d+$/.test(id);

// Para las coaches de la empresa del curso (uno creado en la plataforma): el enlace a su editor.
export default function EnlaceEditarCurso({ texto = "Editar curso", className = "" }: { texto?: string; className?: string }) {
  const { datos, coachAqui } = useApp();
  if (!coachAqui || !datos || !esCursoCreado(datos.curso.id)) return null;
  return (
    <Link href={`/coach/curso/${datos.curso.id}`} className={`enlace enlace-editar ${className}`}>
      <IconoEditar width={15} height={15} /> {texto}
    </Link>
  );
}
