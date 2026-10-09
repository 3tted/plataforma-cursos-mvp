import { redirect } from "next/navigation";

// Cada comunidad tiene su curso, así que el catálogo de cursos repetía el
// directorio de comunidades. Los enlaces viejos a /cursos llevan ahí.
export default function PaginaCursos() {
  redirect("/comunidades");
}
