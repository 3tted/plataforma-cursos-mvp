// Marca de cada empresa: a partir de un solo color, la plataforma calcula los
// tonos que usa la interfaz y cuida el contraste. Si el color no se lee bien
// con texto blanco (un amarillo claro, por ejemplo), lo oscurece lo justo en
// botones y enlaces. El texto, los errores y los avisos no cambian de color.

/** El coral del manual de Merkatics: la marca por defecto. */
export const COLOR_MERKATICS = "#e2554f";

const BLANCO = "#ffffff";
/** Fondo de página (--light-2): donde se lee el texto de acento. */
const FONDO = "#f1f1f1";

/** "#ABC", "abc123" o "#AbC123" → "#aabbcc" / "#abc123"; null si no es un color. */
export function normalizarColor(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const v = valor.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(v)) return `#${v.split("").map((c) => c + c).join("")}`;
  if (/^[0-9a-f]{6}$/.test(v)) return `#${v}`;
  return null;
}

const aRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const aHex = (rgb: number[]) => `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")}`;

function luminancia(hex: string): number {
  const [r, g, b] = aRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste WCAG entre dos colores (de 1 a 21). */
export function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Mezcla el color con negro: 0 lo deja igual, 1 es negro. */
const oscurecer = (hex: string, cuanto: number) => aHex(aRgb(hex).map((c) => c * (1 - cuanto)));

/** Lo oscurece poco a poco hasta alcanzar el contraste pedido contra el fondo. */
function hastaContraste(hex: string, fondo: string, objetivo: number): string {
  let color = hex;
  for (let i = 0; i < 40 && contraste(color, fondo) < objetivo; i++) color = oscurecer(color, 0.04);
  return color;
}

export interface TonosDeMarca {
  /** Íconos, progreso, gráficas y arcos (al menos 3:1 sobre blanco). */
  acento: string;
  /** Botones principales, enlaces y estados activos (texto blanco legible, 4.5:1). */
  botones: string;
  /** Hover y texto de acento sobre el fondo claro (4.5:1). */
  texto: string;
  /** El color elegido no alcanzaba y se oscureció para botones y enlaces. */
  ajustado: boolean;
}

export function tonosDeMarca(color: string): TonosDeMarca {
  const base = normalizarColor(color) ?? COLOR_MERKATICS;
  const acento = hastaContraste(base, BLANCO, 3);
  const botones = hastaContraste(base, BLANCO, 4.5);
  const texto = hastaContraste(oscurecer(botones, 0.15), FONDO, 4.5);
  return { acento, botones, texto, ajustado: botones !== base };
}

/**
 * Variables de CSS que pinta la marca. Van completas (también los alias como
 * --acento) porque una variable heredada llega ya resuelta: cambiar solo
 * --coral-dark en un contenedor no cambiaría el --acento que hereda.
 */
export function variablesDeMarca(color: string, acento?: string | null): Record<string, string> {
  const t = tonosDeMarca(color);
  // Con color de acento: íconos, avance, gráficas y etiquetas van con él (legible sobre blanco, 3:1).
  const segundo = acento && normalizarColor(acento) ? tonosDeMarca(acento).acento : t.acento;
  return {
    "--coral": segundo,
    "--coral-dark": t.botones,
    "--coral-darker": t.texto,
    "--acento": t.botones,
    "--acento-hover": t.texto,
    "--acento-texto": t.texto,
    "--progreso": segundo,
    "--arco-1": segundo,
    "--arco-2": t.botones,
    "--exito": t.botones,
  };
}

/** Las letras para los títulos que puede elegir una empresa. */
export const TITULOS_MARCA = [
  { id: "clasica", nombre: "Clásica", detalle: "La de Merkatics: moderna y clara." },
  { id: "condensada", nombre: "Condensada", detalle: "Alta y en mayúsculas: fuerte y ejecutiva." },
  { id: "elegante", nombre: "Elegante", detalle: "Con remates: sobria y editorial." },
] as const;

export const esTitulos = (v: unknown): v is "clasica" | "condensada" | "elegante" =>
  v === "clasica" || v === "condensada" || v === "elegante";

/** Mezcla el color con blanco: 0 lo deja igual, 1 es blanco. */
const aclarar = (hex: string, cuanto: number) => aHex(aRgb(hex).map((c) => c + (255 - c) * cuanto));

/** Tono del color para usarlo sobre fondo grafito (pósters de video): se aclara hasta leerse (3:1). */
export function acentoSobreOscuro(color: string | undefined): string {
  const base = normalizarColor(color) ?? COLOR_MERKATICS;
  let tono = base;
  for (let i = 0; i < 40 && contraste(tono, "#111111") < 3; i++) tono = aclarar(tono, 0.05);
  return tono;
}
