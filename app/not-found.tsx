import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Página no encontrada",
};

// 404 de la plataforma, con el mismo diseño de "No encontramos esa lección".
export default function NoEncontrada() {
  return (
    <div className="pagina-estrecha no-encontrada">
      <p className="no-encontrada-codigo" aria-hidden="true">
        404
      </p>
      <h1>No encontramos esta página</h1>
      <p className="texto-suave">
        Puede que el enlace esté incompleto o que la página ya no exista. Desde el inicio llegas a tus comunidades y
        cursos.
      </p>
      <Link href="/" className="boton">
        Ir al inicio
      </Link>
    </div>
  );
}
