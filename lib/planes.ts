import plan7Dias from "@/data/planes/plan-7-dias.json";

// Planes por días que una lección puede incrustar con <!-- plan:id --> (por
// ejemplo, el plan de 7 días de INCREASE): el alumno marca cada día al
// terminarlo y anota su evidencia; el equipo de la empresa ve el avance.

export interface DiaPlan {
  titulo: string;
  accion: string;
  evidencia: string;
}

export interface PlanPorDias {
  id: string;
  titulo: string;
  instrucciones: string;
  dias: DiaPlan[];
}

/** Lo que lleva el alumno en cada día. */
export interface DiaHecho {
  hecho: boolean;
  evidencia: string;
}

const PLANES: Record<string, PlanPorDias> = {
  [plan7Dias.id]: plan7Dias,
};

export const planPorDias = (id: string): PlanPorDias | undefined => PLANES[id];

export const MAX_EVIDENCIA = 1500;

/** Revisa lo que manda el navegador: un día por cada día del plan. null si no vale. */
export function diasValidos(plan: PlanPorDias, valor: unknown): DiaHecho[] | null {
  if (!Array.isArray(valor) || valor.length !== plan.dias.length) return null;
  const dias: DiaHecho[] = [];
  for (const v of valor) {
    if (!v || typeof v !== "object") return null;
    const d = v as Record<string, unknown>;
    const evidencia = typeof d.evidencia === "string" ? d.evidencia.trim() : "";
    if (evidencia.length > MAX_EVIDENCIA) return null;
    dias.push({ hecho: d.hecho === true, evidencia });
  }
  return dias;
}
