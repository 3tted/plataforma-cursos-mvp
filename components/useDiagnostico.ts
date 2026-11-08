"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/cliente";
import { diagnostico as delProyecto, type Diagnostico } from "@/lib/diagnosticos";

// La definición de un diagnóstico para dibujarlo: la de uno que viaja con el
// proyecto está a la mano; la de uno creado por un coach se pide al servidor
// (una vez por página).
const cache = new Map<string, Promise<Diagnostico | null>>();

function pedir(id: string): Promise<Diagnostico | null> {
  let p = cache.get(id);
  if (!p) {
    p = api<Diagnostico>(`/api/diagnosticos/${encodeURIComponent(id)}`).catch(() => {
      cache.delete(id);
      return null;
    });
    cache.set(id, p);
  }
  return p;
}

/** Olvida la copia guardada (después de que el coach lo edita). */
export const olvidarDiagnostico = (id: string) => cache.delete(id);

/** undefined: cargando; null: no existe. */
export function useDiagnostico(id: string | null | undefined): Diagnostico | null | undefined {
  const fijo = id ? delProyecto(id) : undefined;
  const [pedido, setPedido] = useState<{ id: string; d: Diagnostico | null } | null>(null);
  useEffect(() => {
    if (!id || fijo) return;
    let vigente = true;
    void pedir(id).then((d) => vigente && setPedido({ id, d }));
    return () => {
      vigente = false;
    };
  }, [id, fijo]);
  if (!id) return null;
  if (fijo) return fijo;
  return pedido?.id === id ? pedido.d : undefined;
}
