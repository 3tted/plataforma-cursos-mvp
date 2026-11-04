"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/cliente";
import type { MetodoPlan, PlanEmpresa } from "@/lib/tipos";
import { useApp } from "./Contexto";

export interface DatosPlan {
  plan: PlanEmpresa | null;
  administra: boolean;
  precio: { monto: number; moneda: string };
  diasPrueba: number;
  tarjetas: { id: string; marca: string; ultimos4: string; nota: string }[];
}

export const NOMBRE_METODO: Record<MetodoPlan, string> = {
  tarjeta: "Tarjeta",
  oxxo: "Efectivo en OXXO",
  spei: "Transferencia SPEI",
  mercadopago: "Mercado Pago",
};

export const AUTOMATICO = (m: MetodoPlan | undefined) => m === "tarjeta" || m === "mercadopago";

const DIA = 24 * 3_600_000;
/** Días que faltan para una fecha (1 si falta menos de un día). */
export const diasHasta = (fecha: string) => Math.max(0, Math.ceil((Date.parse(fecha) - Date.now()) / DIA));

export const fechaLarga = (fecha: string) =>
  new Date(fecha).toLocaleDateString("es-MX", { day: "numeric", month: "long" });

/** El plan de la empresa del coach con sesión (null mientras carga o si no es coach). */
export function usePlan() {
  const { usuario } = useApp();
  const [datos, setDatos] = useState<DatosPlan | null>(null);
  const esCoach = usuario?.rol === "coach";

  const recargar = useCallback(() => {
    if (!esCoach) return;
    api<DatosPlan>("/api/coach/plan")
      .then(setDatos)
      .catch(() => setDatos(null));
  }, [esCoach]);

  useEffect(recargar, [recargar]);

  const accion = useCallback(async (json: Record<string, unknown>) => {
    const r = await api<DatosPlan>("/api/coach/plan", { method: "POST", json });
    setDatos(r);
    return r;
  }, []);

  return { datos, recargar, accion };
}
