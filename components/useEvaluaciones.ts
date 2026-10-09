"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/cliente";
import type { EvaluacionesPublicas } from "@/lib/tipos";
import { useApp } from "./Contexto";

// Las preguntas del repaso y del examen no cambian durante la visita: se
// piden una vez por curso y las comparten la lección, el examen y el índice.
const pendientes = new Map<string, Promise<EvaluacionesPublicas>>();

export function useEvaluaciones(): EvaluacionesPublicas | null {
  const { cursoId } = useApp();
  const [evaluaciones, setEvaluaciones] = useState<{ curso: string; datos: EvaluacionesPublicas } | null>(null);
  useEffect(() => {
    let vigente = true;
    let pendiente = pendientes.get(cursoId);
    if (!pendiente) {
      pendiente = api<EvaluacionesPublicas>(`/api/evaluaciones?curso=${encodeURIComponent(cursoId)}`).catch((e) => {
        pendientes.delete(cursoId); // se reintenta en la siguiente página
        throw e;
      });
      pendientes.set(cursoId, pendiente);
    }
    pendiente.then((datos) => vigente && setEvaluaciones({ curso: cursoId, datos })).catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [cursoId]);
  // Mientras llegan las del curso nuevo no se muestran las del anterior.
  return evaluaciones?.curso === cursoId ? evaluaciones.datos : null;
}
