// Utilidades de la interfaz (se ejecutan en el navegador).

export async function api<T>(ruta: string, opciones?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...resto } = opciones ?? {};
  const res = await fetch(ruta, {
    ...resto,
    headers: json !== undefined ? { "Content-Type": "application/json" } : resto.headers,
    body: json !== undefined ? JSON.stringify(json) : resto.body,
  });
  if (!res.ok) {
    const cuerpo = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(cuerpo?.error ?? `La solicitud falló (${res.status}).`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

// localStorage puede fallar (modo privado, almacenamiento bloqueado): la app
// debe funcionar igual, solo sin recordar al usuario.
export function leerLocal<T>(clave: string): T | null {
  try {
    const valor = window.localStorage.getItem(clave);
    return valor ? (JSON.parse(valor) as T) : null;
  } catch {
    return null;
  }
}

export function guardarLocal(clave: string, valor: unknown): void {
  try {
    if (valor === null) window.localStorage.removeItem(clave);
    else window.localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // sin almacenamiento: se ignora
  }
}

// sessionStorage: lo que debe sobrevivir a una recarga o a cambiar de app,
// pero no quedarse en un equipo compartido (la conversación con el asistente).
export function leerSesion<T>(clave: string): T | null {
  try {
    const valor = window.sessionStorage.getItem(clave);
    return valor ? (JSON.parse(valor) as T) : null;
  } catch {
    return null;
  }
}

export function guardarSesion(clave: string, valor: unknown): void {
  try {
    if (valor === null) window.sessionStorage.removeItem(clave);
    else window.sessionStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // sin almacenamiento: se ignora
  }
}

const formatoMoneda = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export function moneda(monto: number): string {
  return formatoMoneda.format(monto);
}

const relativo = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });

export function hace(fechaIso: string): string {
  const segundos = (Date.parse(fechaIso) - Date.now()) / 1000;
  const unidades: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unidad, tamaño] of unidades) {
    if (Math.abs(segundos) >= tamaño) return relativo.format(Math.round(segundos / tamaño), unidad);
  }
  return "hace un momento";
}

export function fechaCorta(fechaIso: string): string {
  return new Date(fechaIso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

// Color estable por nombre, dentro de una paleta que se lee bien en ambos temas.
const TONOS = [162, 28, 205, 340, 95, 262, 190, 12];
export function tonoDe(nombre: string): number {
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONOS[h % TONOS.length];
}

export function agrupar(texto: string, cada: number): string {
  return texto.replace(new RegExp(`(.{${cada}})(?=.)`, "g"), "$1 ");
}
