import type { ReactNode } from "react";

// Portada ilustrada de una comunidad según su tema: figuras simples con los
// rojos y la tinta de la marca, sin fotos de banco. Cada comunidad varía un
// poco la figura (alturas, posición) para que dos del mismo tema no se vean
// iguales. Los colores son variables, así que también sirve en modo oscuro.

const R1 = "var(--acento)";
const R2 = "var(--arco-1)";
const R3 = "var(--arco-3)";
const TI = "var(--tinta)";
const SU = "var(--superficie)";
const VACIO = "var(--superficie-2)";

// Número estable por texto: la misma comunidad siempre dibuja lo mismo.
function semilla(texto: string): number {
  let h = 7;
  for (const ch of texto) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function figura(tema: string, clave: string): ReactNode {
  const v = (n: string) => (semilla(clave + n) % 100) / 100;
  const dx = Math.round(v("x") * 40) - 20;
  switch (tema) {
    case "Finanzas": {
      const h = [0.35, 0.55, 0.8, 0.65].map((k, i) => Math.round((k + v("b" + i) * 0.2) * 90));
      return (
        <g transform={`translate(${170 + dx} 0)`}>
          {h.map((alto, i) => (
            <rect key={i} x={i * 30} y={150 - alto} width="20" height={alto} rx="4" fill={i === 2 ? R1 : i === 3 ? R2 : R3} />
          ))}
          <path
            d={`M-10 ${150 - h[0] - 10} L28 ${150 - h[1] - 14} L58 ${150 - h[2] - 18} L95 ${150 - h[3] - 30}`}
            fill="none"
            stroke={TI}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="95" cy={150 - h[3] - 30} r="6" fill={TI} />
        </g>
      );
    }
    case "Ventas":
      return (
        <g transform={`translate(${160 + dx} ${20 + Math.round(v("y") * 10)})`}>
          <rect x="0" y="10" width="110" height="64" rx="16" fill={R1} />
          <path d="M18 74 l-8 18 l26 -18z" fill={R1} />
          <rect x="18" y="30" width="58" height="8" rx="4" fill={SU} />
          <rect x="18" y="46" width="40" height="8" rx="4" fill={SU} opacity=".7" />
          <rect x="50" y="78" width="96" height="50" rx="14" fill={SU} />
          <path d="M132 128 l8 14 l-24 -14z" fill={SU} />
          <path d="M78 103 l10 10 l20 -22" fill="none" stroke={R1} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case "Marketing":
      return (
        <g transform={`translate(${170 + dx} 34)`}>
          <path d="M0 40 L60 14 V106 L0 80 Z" fill={R1} />
          <rect x="-18" y="40" width="22" height="40" rx="6" fill={TI} />
          <rect x="2" y="80" width="16" height="34" rx="5" fill={TI} opacity=".85" />
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M${76 + i * 16} ${34 - i * 8} a${30 + i * 16} ${30 + i * 16} 0 0 1 0 ${52 + i * 16}`}
              fill="none"
              stroke={i === 0 ? R2 : R3}
              strokeWidth="5"
              strokeLinecap="round"
            />
          ))}
        </g>
      );
    case "Productividad": {
      // Días de la semana ya cumplidos: de 3 a 6.
      const hechos = 3 + Math.floor(v("c") * 4);
      return (
        <g transform={`translate(${178 + dx} 26)`}>
          <rect x="0" y="0" width="118" height="116" rx="14" fill={SU} />
          <rect x="0" y="0" width="118" height="28" rx="14" fill={R1} />
          <rect x="0" y="14" width="118" height="14" fill={R1} />
          {Array.from({ length: 9 }, (_, i) => {
            const x = 14 + (i % 3) * 32;
            const y = 38 + Math.floor(i / 3) * 24;
            return i < hechos ? (
              <g key={i}>
                <rect x={x} y={y} width="24" height="18" rx="5" fill={R3} />
                <path d={`M${x + 6} ${y + 9} l4 4 l8 -8`} fill="none" stroke={R1} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            ) : (
              <rect key={i} x={x} y={y} width="24" height="18" rx="5" fill={VACIO} />
            );
          })}
        </g>
      );
    }
    case "Diseño":
      return (
        <g transform={`translate(${168 + dx} 22)`}>
          <circle cx="46" cy="58" r="44" fill={R2} />
          <rect x="60" y="40" width="74" height="74" rx="12" fill={TI} opacity=".9" />
          <path d="M110 10 L150 76 H70 Z" fill={R3} />
        </g>
      );
    default: // Liderazgo y cualquier tema nuevo
      return (
        <g transform={`translate(${158 + dx} 34)`}>
          {[0, 1, 2].map((i) => {
            const x = i * 46;
            const y = i === 1 ? 0 : 14;
            const c = i === 1 ? R1 : i === 0 ? R2 : TI;
            return (
              <g key={i}>
                <circle cx={x + 26} cy={y + 22} r="18" fill={c} />
                <path d={`M${x} ${y + 92} a26 30 0 0 1 52 0 z`} fill={c} />
              </g>
            );
          })}
        </g>
      );
  }
}

// "encajar" dibuja la figura completa aunque la caja sea más alta que la ilustración.
export default function PortadaTema({
  tema,
  clave,
  className = "",
  encajar = false,
}: {
  tema: string;
  clave: string;
  className?: string;
  encajar?: boolean;
}) {
  return (
    <span className={`portada-tema ${className}`} data-tema={tema}>
      <svg viewBox="0 0 320 160" preserveAspectRatio={encajar ? "xMidYMid meet" : "xMidYMid slice"} aria-hidden="true" focusable="false">
        {figura(tema, clave)}
      </svg>
      <span className="portada-tema-etiqueta">{tema}</span>
    </span>
  );
}
