// Portada (poster) de los videos: fondo grafito, una etiqueta en coral y el
// título en blanco, como las piezas oscuras del manual de marca. Sustituye al
// primer cuadro del video, que en los de muestra es texto difícil de leer.

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Parte el título en renglones de ~26 caracteres (máximo 3). */
function renglones(titulo: string): string[] {
  const palabras = titulo.split(/\s+/);
  const lista: string[] = [];
  let actual = "";
  for (const p of palabras) {
    if ((actual + " " + p).trim().length > 26 && actual) {
      lista.push(actual);
      actual = p;
    } else actual = (actual + " " + p).trim();
  }
  if (actual) lista.push(actual);
  if (lista.length > 3) lista.splice(2, lista.length - 2, lista.slice(2).join(" ").slice(0, 24) + "…");
  return lista;
}

/** acento: color de la etiqueta y la flecha (el de la marca de la empresa, si tiene). */
export function posterDeVideo(etiqueta: string, titulo: string, acento = "#e2554f"): string {
  const lineas = renglones(titulo);
  const y0 = 360 - ((lineas.length - 1) * 70) / 2;
  const texto = lineas
    .map((l, i) => `<text x="96" y="${y0 + i * 70}" font-size="60" font-weight="700" fill="#ffffff">${escapar(l)}</text>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" font-family="Montserrat, Arial, Helvetica, sans-serif">
<rect width="1280" height="720" fill="#111111"/>
<polyline points="760,600 900,520 990,560 1180,330" fill="none" stroke="${acento}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<polyline points="1130,330 1180,330 1180,380" fill="none" stroke="${acento}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<text x="96" y="${y0 - 100}" font-size="30" font-weight="700" letter-spacing="3" fill="${acento}">${escapar(etiqueta.toUpperCase())}</text>
${texto}
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
