"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useApp } from "@/components/Contexto";
import { IconoGoogle } from "@/components/Iconos";
import { useTitulo } from "@/components/useTitulo";
import { api } from "@/lib/cliente";
import type { CuentaPublica } from "@/lib/tipos";

interface Info {
  vigente: boolean;
  tipo?: "coach" | "empresa";
  empresa?: string | null;
  creadaPor?: string;
}

// Lo que abre el enlace de una invitación: crear la cuenta de coach (con
// correo o con Google) o aceptarla con la cuenta de alumno que ya se tiene.
export default function PaginaInvitacion() {
  const { codigo } = useParams<{ codigo: string }>();
  const router = useRouter();
  const { listo, usuario, guardarUsuario, pedirEntrada, cerrarSesion, opcionesEntrada } = useApp();
  const [info, setInfo] = useState<Info | null>(null);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useTitulo("Invitación");

  useEffect(() => {
    api<Info>(`/api/invitaciones/${encodeURIComponent(codigo)}`)
      .then(setInfo)
      .catch(() => setInfo({ vigente: false }));
  }, [codigo]);

  if (!listo || !info) return <p className="texto-suave">Cargando la invitación…</p>;

  const destino = info.tipo === "empresa" ? "/coach/empresa" : "/coach/comunidades";
  const listoComoCoach = (cuenta: CuentaPublica) => {
    guardarUsuario(cuenta);
    router.push(destino);
  };

  const aceptar = async () => {
    setEnviando(true);
    setError(null);
    try {
      listoComoCoach((await api<{ cuenta: CuentaPublica }>(`/api/invitaciones/${encodeURIComponent(codigo)}`, { method: "POST" })).cuenta);
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  };

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      listoComoCoach(
        (
          await api<{ cuenta: CuentaPublica }>("/api/cuentas", {
            method: "POST",
            json: { nombre, correo, contrasena, invitacion: codigo },
          })
        ).cuenta,
      );
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  };

  if (!info.vigente) {
    return (
      <div className="pagina-estrecha invitacion">
        <h1>Esta invitación ya no sirve</h1>
        <p className="texto-suave">
          Ya se usó o venció (duran 14 días). Pídele a quien te invitó que te mande un enlace nuevo.
        </p>
        <Link href="/" className="boton boton-secundario">
          Ir al inicio
        </Link>
      </div>
    );
  }

  const titulo =
    info.tipo === "empresa"
      ? info.empresa
        ? `Te invitaron a abrir ${info.empresa} en Merkatics`
        : "Te invitaron a abrir tu empresa en Merkatics"
      : `Te invitaron a ser coach de ${info.empresa ?? "una empresa"}`;

  return (
    <div className="pagina-estrecha invitacion">
      <h1>{titulo}</h1>
      <p className="texto-suave">
        Te invita {info.creadaPor}.{" "}
        {info.tipo === "empresa"
          ? "Serás la dueña de la empresa: pones su marca, creas sus comunidades y cursos e invitas a tus coaches."
          : "Vas a crear y editar las comunidades y los cursos de la empresa, y ver el avance de sus alumnos."}
      </p>

      {usuario ? (
        usuario.rol === "coach" ? (
          <div className="tarjeta invitacion-tarjeta">
            <p>
              Tu cuenta (<strong>{usuario.nombre}</strong>) ya es de coach en una empresa. Para aceptar esta invitación,
              sal y crea otra cuenta con otro correo.
            </p>
            <button type="button" className="boton boton-secundario" onClick={cerrarSesion}>
              Salir de mi cuenta
            </button>
          </div>
        ) : (
          <div className="tarjeta invitacion-tarjeta">
            <p>
              Entraste como <strong>{usuario.nombre}</strong>. Al aceptar, tu cuenta pasa a ser de coach; lo que hiciste
              como alumno se queda igual.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button type="button" className="boton" onClick={() => void aceptar()} disabled={enviando}>
              {enviando ? "Aceptando…" : "Aceptar la invitación"}
            </button>
          </div>
        )
      ) : (
        <form className="tarjeta invitacion-tarjeta" onSubmit={crear} noValidate>
          <h2>Crea tu cuenta de coach</h2>
          <label className="campo">
            <span>Tu nombre</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} autoComplete="name" />
          </label>
          <label className="campo">
            <span>Correo</span>
            <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="email" inputMode="email" />
          </label>
          <label className="campo">
            <span>Contraseña</span>
            <input
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              autoComplete="new-password"
              aria-describedby="invitacion-contrasena-nota"
            />
            <span className="nota" id="invitacion-contrasena-nota">
              Al menos 8 caracteres.
            </span>
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="boton boton-bloque" disabled={enviando}>
            {enviando ? "Creando tu cuenta…" : "Crear mi cuenta de coach"}
          </button>
          {opcionesEntrada?.google && (
            <a
              className="boton boton-secundario boton-bloque boton-google"
              href={`/api/auth/google?invitacion=${encodeURIComponent(codigo)}&volver=${encodeURIComponent(destino)}`}
            >
              <IconoGoogle width={18} height={18} /> Crear con Google
            </a>
          )}
          <p className="nota">
            ¿Ya tienes una cuenta de alumno?{" "}
            <button type="button" className="enlace-boton" onClick={() => pedirEntrada()}>
              Entra con ella
            </button>{" "}
            y acepta la invitación aquí mismo.
          </p>
        </form>
      )}
    </div>
  );
}
