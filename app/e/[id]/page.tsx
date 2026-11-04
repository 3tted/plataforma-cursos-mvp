"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/Contexto";
import InvitacionRadar from "@/components/InvitacionRadar";
import TarjetaComunidad from "@/components/TarjetaComunidad";
import { useTitulo } from "@/components/useTitulo";
import { api } from "@/lib/cliente";
import type { MarcaEmpresa } from "@/lib/tipos";

interface DatosEmpresa {
  id: string;
  nombre: string;
  marca?: MarcaEmpresa;
  comunidades: string[];
}

// La página de una empresa (/e/<id>): su dirección para compartir con sus
// alumnos. Lleva su marca y muestra sus comunidades; se ve aunque no haya sesión.
export default function PaginaEmpresa() {
  const { id } = useParams<{ id: string }>();
  const { usuario, comunidades, fijarMarcaPagina, pedirEntrada } = useApp();
  const [empresa, setEmpresa] = useState<DatosEmpresa | null>(null);
  const [error, setError] = useState<string | null>(null);
  useTitulo(empresa?.nombre ?? "Empresa");

  useEffect(() => {
    let vigente = true;
    api<DatosEmpresa>(`/api/empresas/${encodeURIComponent(id)}`)
      .then((e) => {
        if (!vigente) return;
        setEmpresa(e);
        fijarMarcaPagina(e.marca ?? null);
      })
      .catch((e) => vigente && setError((e as Error).message));
    return () => {
      vigente = false;
      fijarMarcaPagina(null);
    };
  }, [id, fijarMarcaPagina]);

  if (error) {
    return (
      <div className="pagina-estrecha">
        <h1>No encontramos esa empresa</h1>
        <p className="texto-suave">Revisa la dirección que te compartieron.</p>
        <Link href="/" className="boton boton-secundario">
          Ir al inicio
        </Link>
      </div>
    );
  }
  if (!empresa) return <p className="texto-suave">Cargando…</p>;

  const suyas = empresa.comunidades
    .map((c) => comunidades.find((x) => x.id === c))
    .filter((c): c is NonNullable<typeof c> => !!c);

  return (
    <div className="pagina-empresa">
      <header className="pagina-empresa-cabecera">
        {empresa.marca?.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pagina-empresa-logo" src={empresa.marca.logo} alt="" />
        )}
        <h1>{empresa.nombre}</h1>
        <p className="texto-suave">
          {suyas.length === 0
            ? "Esta empresa todavía no publica sus comunidades."
            : suyas.length === 1
              ? "Su comunidad en Merkatics: únete gratis y toma sus cursos."
              : "Sus comunidades en Merkatics: únete gratis y toma sus cursos."}
        </p>
        {!usuario && (
          <button type="button" className="boton pagina-empresa-entrar" onClick={() => pedirEntrada("alumno")}>
            Entrar o crear mi cuenta
          </button>
        )}
      </header>
      <InvitacionRadar empresa={empresa.id} />
      {suyas.length > 0 && (
        <ul className="directorio-grupo-lista">
          {suyas.map((c) => (
            <TarjetaComunidad key={c.id} comunidad={c} />
          ))}
        </ul>
      )}
    </div>
  );
}
