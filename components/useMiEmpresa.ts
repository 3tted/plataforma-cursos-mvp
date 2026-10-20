"use client";

import { useEffect, useMemo } from "react";
import { useApp } from "./Contexto";

/**
 * Los cursos de la empresa de la coach. Su inicio y su panel solo muestran
 * lo de su empresa: si el curso activo es de otra (por ejemplo, porque estuvo
 * viendo otra comunidad), se pasa al primero de los suyos.
 */
export function useCursosDeMiEmpresa() {
  const { usuario, cursos, cursoId, cambiarCurso } = useApp();
  const empresa = usuario?.empresa;
  const mios = useMemo(() => cursos.filter((c) => c.empresa === empresa), [cursos, empresa]);
  const activoEsMio = mios.some((c) => c.id === cursoId);
  useEffect(() => {
    if (!activoEsMio && mios.length > 0) cambiarCurso(mios[0].id);
  }, [activoEsMio, mios, cambiarCurso]);
  return { mios, activoEsMio };
}
