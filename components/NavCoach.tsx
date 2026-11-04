"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AUTOMATICO, diasHasta, fechaLarga, usePlan } from "./usePlan";

// Las partes del área de coach, con las mismas pestañas arriba de cada una: el
// panel con lo que pasa, lo que crea (comunidades y cursos), su empresa (marca,
// equipo e invitaciones) y su plan con Merkatics. Debajo, un aviso cuando su
// plan lo necesita: los días de prueba que le quedan o que está en pausa.
const PESTANAS = [
  { href: "/coach", texto: "Panel", activa: (r: string) => r === "/coach" },
  {
    href: "/coach/comunidades",
    texto: "Comunidades y cursos",
    activa: (r: string) => r === "/coach/comunidades" || r.startsWith("/coach/comunidad/") || r.startsWith("/coach/curso/"),
  },
  { href: "/coach/empresa", texto: "Mi empresa", activa: (r: string) => r === "/coach/empresa" },
  { href: "/coach/plan", texto: "Mi plan", activa: (r: string) => r === "/coach/plan" },
];

export default function NavCoach() {
  const ruta = usePathname();
  return (
    <>
      <nav className="nav-coach" aria-label="Área de coach">
        {PESTANAS.map((p) => (
          <Link key={p.href} href={p.href} className="nav-coach-enlace" aria-current={p.activa(ruta) ? "page" : undefined}>
            {p.texto}
          </Link>
        ))}
      </nav>
      {ruta !== "/coach/plan" && <AvisoPlan />}
    </>
  );
}

function AvisoPlan() {
  const { datos } = usePlan();
  const plan = datos?.plan;
  if (!plan) return null;
  let texto: string | null = null;
  let pausa = false;
  if (plan.estado === "pausado" || plan.estado === "cancelado") {
    pausa = true;
    texto =
      plan.estado === "cancelado"
        ? "Tu plan está cancelado: no puedes crear comunidades ni cursos nuevos."
        : "Tu empresa está en pausa: falta el pago de tu plan. Tus alumnos siguen viendo tus cursos.";
  } else if (plan.estado === "prueba" && !plan.cancelado) {
    const dias = diasHasta(plan.pruebaHasta);
    const cuando = dias <= 1 ? "Hoy es tu último día de prueba gratis" : `Te quedan ${dias} días de prueba gratis`;
    texto = !plan.metodo
      ? `${cuando}. Elige cómo pagar antes del ${fechaLarga(plan.pruebaHasta)}.`
      : AUTOMATICO(plan.metodo)
        ? `${cuando}. El ${fechaLarga(plan.pruebaHasta)} se cobra tu primer mes.`
        : `${cuando}. Tu ficha del primer mes sale dos días antes del ${fechaLarga(plan.pruebaHasta)}.`;
  } else if (plan.cobros.some((c) => c.estado === "pendiente")) {
    texto = "Tienes una ficha de pago pendiente de tu plan.";
  }
  if (!texto) return null;
  return (
    <div className="aviso aviso-plan" data-pausa={pausa} role="status">
      <p>{texto}</p>
      <Link href="/coach/plan" className="boton boton-chico">
        {pausa ? "Ponerme al corriente" : "Ver mi plan"}
      </Link>
    </div>
  );
}
