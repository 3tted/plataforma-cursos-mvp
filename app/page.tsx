"use client";

import { useApp } from "@/components/Contexto";
import InicioAlumno from "@/components/InicioAlumno";
import InicioCoach from "@/components/InicioCoach";
import { useTitulo } from "@/components/useTitulo";

// Inicio: el mismo lugar para todos, con lo que le sirve a cada rol.
export default function PaginaInicio() {
  const { usuario } = useApp();
  useTitulo("Inicio");
  return usuario?.rol === "coach" ? <InicioCoach /> : <InicioAlumno />;
}
