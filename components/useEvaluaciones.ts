"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/cliente";
import type { EvaluacionesPublicas } from "@/lib/tipos";

// Las preguntas del repaso y del examen no cambian durante la visita: se
// piden una vez y las comparten la lección, el examen y el índice del curso.
let pendiente: Promise<EvaluacionesPublicas> | null = null;

export function useEvaluaciones(): EvaluacionesPublicas | null {
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionesPublicas | null>(null);
  useEffect(() => {
    let vigente = true;
    pendiente ??= api<EvaluacionesPublicas>("/api/evaluaciones").catch((e) => {
      pendiente = null; // se reintenta en la siguiente página
      throw e;
    });
    pendiente.then((e) => vigente && setEvaluaciones(e)).catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, []);
  return evaluaciones;
}
