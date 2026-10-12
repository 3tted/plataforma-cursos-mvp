// Código de barras Code 128 (juego B) dibujado en SVG a partir de un texto.
// En la demostración la referencia es ficticia, pero el código sí corresponde
// a ella: un lector lo leería igual que la referencia escrita.

// Anchos de barra y espacio de cada símbolo (0–105) y el de alto (106).
const PATRONES = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];
const INICIO_B = 104;
const ALTO = 106;

function simbolos(texto: string): number[] {
  const valores = [...texto].map((c) => Math.min(Math.max(c.charCodeAt(0) - 32, 0), 94));
  const suma = valores.reduce((s, v, i) => s + v * (i + 1), INICIO_B);
  return [INICIO_B, ...valores, suma % 103, ALTO];
}

export default function CodigoBarras({ texto, alto = 64 }: { texto: string; alto?: number }) {
  const barras: { x: number; ancho: number }[] = [];
  let x = 10; // zona en blanco a los lados
  for (const s of simbolos(texto)) {
    [...PATRONES[s]].forEach((w, i) => {
      const ancho = Number(w);
      if (i % 2 === 0) barras.push({ x, ancho });
      x += ancho;
    });
  }
  const total = x + 10;
  return (
    <svg
      className="codigo-barras"
      viewBox={`0 0 ${total} ${alto}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Código de barras de la referencia ${texto}`}
    >
      <rect width={total} height={alto} fill="#ffffff" />
      {barras.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.ancho} height={alto} fill="#111111" />
      ))}
    </svg>
  );
}
