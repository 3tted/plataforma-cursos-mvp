// Las bandas curvas de las esquinas del manual de identidad de Merkatics:
// tres cuartos de anillo concéntricos anclados a la esquina superior derecha.
// Los colores salen de --arco-1, --arco-2 y --arco-3 según la superficie.

const BANDAS: [exterior: number, interior: number, color: string][] = [
  [200, 172, "var(--arco-1)"],
  [164, 140, "var(--arco-2)"],
  [132, 118, "var(--arco-3)"],
];

function banda(R: number, r: number): string {
  return `M${200 - R} 0A${R} ${R} 0 0 0 200 ${R}L200 ${r}A${r} ${r} 0 0 1 ${200 - r} 0Z`;
}

export default function Arcos({ className = "" }: { className?: string }) {
  return (
    <svg className={`arcos ${className}`} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      {BANDAS.map(([R, r, color]) => (
        <path key={R} d={banda(R, r)} fill={color} />
      ))}
    </svg>
  );
}
