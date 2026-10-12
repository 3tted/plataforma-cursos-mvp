// Cuentas de la narración de una presentación con IA, para el reproductor y
// el editor: cómo se parte en frases, cuánto dura y qué voz la lee.

/** Palabras por segundo de la voz a velocidad normal. */
export const PALABRAS_POR_SEGUNDO = 2.6;

/** Parte la narración en frases para que la voz no se corte. */
export const frasesDe = (texto: string) =>
  texto
    .split(/(?<=[.!?…])\s+/)
    .map((f) => f.trim())
    .filter(Boolean);

export const palabrasDe = (texto: string) => texto.split(/\s+/).filter(Boolean).length;

/** Segundos que dura una frase a velocidad normal. */
export const duracionDe = (frase: string) => Math.max(1.2, palabrasDe(frase) / PALABRAS_POR_SEGUNDO);

/** Segundos que dura toda la narración de una diapositiva. */
export const duracionNarracion = (texto: string) => frasesDe(texto).reduce((s, f) => s + duracionDe(f), 0);

/** 75 → "1:15". */
export const enMinutos = (segundos: number) => {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Voz en español: primero de México, luego de EE. UU. (latina), luego cualquiera. */
export function vozEnEspañol(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voces = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("es"));
  const de = (lang: string) => voces.find((v) => v.lang.toLowerCase().replace("_", "-") === lang);
  return de("es-mx") ?? de("es-us") ?? de("es-419") ?? voces.find((v) => v.localService) ?? voces[0] ?? null;
}
