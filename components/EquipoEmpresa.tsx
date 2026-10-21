"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, fechaCorta, hace } from "@/lib/cliente";
import type { SolicitudCoach } from "@/lib/tipos";
import Avatar from "./Avatar";
import { useApp } from "./Contexto";
import { IconoCopiar, IconoEnlace, IconoInvitar } from "./Iconos";

interface Miembro {
  nombre: string;
  correo: string;
  dueno: boolean;
}

interface InvitacionVista {
  codigo: string;
  tipo: "coach" | "empresa";
  nombreEmpresa?: string;
  creadaPor: string;
  venceEn: string;
}

// Debajo de "Mi empresa": la dirección de la empresa para compartir, su
// equipo de coaches y las invitaciones (ser coach es solo por invitación).
// Al equipo de Merkatics también le toca invitar empresas nuevas y dar
// contraseñas temporales a quien olvidó la suya.
export default function EquipoEmpresa({ empresa, dueno }: { empresa: string; dueno: boolean }) {
  const { usuario } = useApp();
  const [datos, setDatos] = useState<{ equipo: Miembro[]; invitaciones: InvitacionVista[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [creando, setCreando] = useState<"coach" | "empresa" | null>(null);
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [correoOlvido, setCorreoOlvido] = useState("");
  const [temporal, setTemporal] = useState<{ nombre: string; correo: string; contrasena: string } | null>(null);
  const [origen, setOrigen] = useState("");
  const [solicitudes, setSolicitudes] = useState<SolicitudCoach[] | null>(null);

  const cargar = useCallback(() => {
    api<{ equipo: Miembro[]; invitaciones: InvitacionVista[] }>("/api/invitaciones")
      .then(setDatos)
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    setOrigen(window.location.origin);
    cargar();
  }, [cargar]);

  // Solo el equipo de Merkatics ve las solicitudes de acceso de los coaches.
  const esEquipo = usuario?.admin === true;
  const cargarSolicitudes = useCallback(() => {
    api<SolicitudCoach[]>("/api/solicitudes")
      .then(setSolicitudes)
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    if (esEquipo) cargarSolicitudes();
  }, [esEquipo, cargarSolicitudes]);

  const atender = async (id: string, accion: "invitar" | "descartar") => {
    setError(null);
    try {
      const s = await api<SolicitudCoach>("/api/solicitudes", { method: "PATCH", json: { id, accion } });
      cargarSolicitudes();
      cargar();
      if (accion === "invitar" && s.invitacion) void copiar(enlaceDe(s.invitacion), s.invitacion);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const enlaceDe = (codigo: string) => `${origen}/invitacion/${codigo}`;
  const pagina = `${origen}/e/${empresa}`;

  const copiar = async (texto: string, clave: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(clave);
      setTimeout(() => setCopiado((c) => (c === clave ? null : c)), 2500);
    } catch {
      setError("No se pudo copiar. Selecciona el enlace y cópialo a mano.");
    }
  };

  const invitar = async (tipo: "coach" | "empresa") => {
    setCreando(tipo);
    setError(null);
    try {
      const nueva = await api<InvitacionVista>("/api/invitaciones", {
        method: "POST",
        json: tipo === "empresa" ? { tipo, nombreEmpresa } : { tipo },
      });
      if (tipo === "empresa") setNombreEmpresa("");
      cargar();
      void copiar(enlaceDe(nueva.codigo), nueva.codigo);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreando(null);
    }
  };

  const cancelar = async (codigo: string) => {
    setError(null);
    try {
      await api(`/api/invitaciones?codigo=${encodeURIComponent(codigo)}`, { method: "DELETE" });
      cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const restablecer = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setTemporal(null);
    try {
      setTemporal(await api("/api/cuentas/restablecer", { method: "POST", json: { correo: correoOlvido } }));
      setCorreoOlvido("");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const lista = (tipo: "coach" | "empresa") => {
    const suyas = datos?.invitaciones.filter((i) => i.tipo === tipo) ?? [];
    if (suyas.length === 0) return null;
    return (
      <ul className="invitaciones-lista">
        {suyas.map((i) => (
          <li key={i.codigo}>
            <span className="invitaciones-texto">
              <code className="enlace-copiable">{enlaceDe(i.codigo)}</code>
              <span className="nota">
                {i.nombreEmpresa ? `${i.nombreEmpresa} · ` : ""}Sin usar · vence el {fechaCorta(i.venceEn)}
              </span>
            </span>
            <span className="invitaciones-acciones">
              <button type="button" className="boton boton-chico boton-fantasma-borde" onClick={() => void copiar(enlaceDe(i.codigo), i.codigo)}>
                <IconoCopiar width={15} height={15} /> {copiado === i.codigo ? "Copiado" : "Copiar"}
              </button>
              <button type="button" className="enlace enlace-discreto" onClick={() => void cancelar(i.codigo)}>
                Cancelar
              </button>
            </span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="equipo-empresa">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <section className="tarjeta" aria-labelledby="pagina-empresa-titulo">
        <h2 id="pagina-empresa-titulo">La página de tu empresa</h2>
        <p className="texto-suave">
          Compártela con tus alumnos: muestra tus comunidades con tu marca y desde ahí entran o crean su cuenta.
        </p>
        <div className="enlace-fila">
          <code className="enlace-copiable">{pagina}</code>
          <button type="button" className="boton boton-chico boton-fantasma-borde" onClick={() => void copiar(pagina, "pagina")}>
            <IconoCopiar width={15} height={15} /> {copiado === "pagina" ? "Copiado" : "Copiar"}
          </button>
          <Link href={`/e/${empresa}`} className="enlace">
            <IconoEnlace width={15} height={15} /> Abrir
          </Link>
        </div>
      </section>

      <section className="tarjeta" aria-labelledby="equipo-titulo">
        <h2 id="equipo-titulo">Equipo</h2>
        {!datos ? (
          <p className="texto-suave">Cargando tu equipo…</p>
        ) : (
          <ul className="equipo-lista">
            {datos.equipo.map((m) => (
              <li key={m.correo}>
                <Avatar nombre={m.nombre} tamaño={32} coach />
                <span className="equipo-datos">
                  <span className="equipo-nombre">
                    {m.nombre}
                    {m.nombre === usuario?.nombre && <span className="texto-suave"> (tú)</span>}
                  </span>
                  <span className="nota">{m.correo}</span>
                </span>
                <span className="pastilla">{m.dueno ? "Dueña" : "Coach"}</span>
              </li>
            ))}
          </ul>
        )}

        {dueno ? (
          <div className="equipo-invitar">
            <h3>Invitar coaches</h3>
            <p className="texto-suave">
              Crea un enlace y mándalo por WhatsApp o por correo. Sirve una sola vez y dura 14 días: quien lo abre crea
              su cuenta de coach en tu empresa.
            </p>
            <button type="button" className="boton boton-secundario" onClick={() => void invitar("coach")} disabled={creando !== null}>
              <IconoInvitar width={17} height={17} /> {creando === "coach" ? "Creando…" : "Crear enlace de invitación"}
            </button>
            {lista("coach")}
          </div>
        ) : (
          <p className="nota">Para sumar a otra coach, pídele a la dueña de tu empresa que la invite.</p>
        )}
      </section>

      {usuario?.admin && (
        <section className="tarjeta" aria-labelledby="merkatics-titulo">
          <h2 id="merkatics-titulo">Equipo de Merkatics</h2>
          <div className="equipo-invitar">
            <h3>Solicitudes de coaches</h3>
            <p className="texto-suave">
              Lo que piden en la página «Para coaches». Modo demostración: no llega ningún correo; desde aquí creas su
              invitación y se la compartes por el medio que dejaron.
            </p>
            {!solicitudes ? (
              <p className="texto-suave">Cargando solicitudes…</p>
            ) : solicitudes.length === 0 ? (
              <p className="vacio">Todavía no hay solicitudes.</p>
            ) : (
              <ul className="solicitudes-lista">
                {solicitudes.map((s) => (
                  <li key={s.id} className="solicitud" data-estado={s.estado}>
                    <div className="solicitud-cabecera">
                      <strong>
                        {s.nombre}
                        {s.empresa ? ` · ${s.empresa}` : ""}
                      </strong>
                      <span className="nota">{hace(s.creadaEn)}</span>
                    </div>
                    <p className="texto-suave">
                      Enseña: {s.tema} · {s.alumnos === "Todavía ninguno" ? "todavía sin alumnos" : `${s.alumnos} alumnos`} ·
                      Contacto: <span className="cifra">{s.contacto}</span>
                    </p>
                    {s.mensaje && <p className="nota">«{s.mensaje}»</p>}
                    <div className="solicitud-acciones">
                      {s.estado === "invitada" && s.invitacion ? (
                        <>
                          <span className="pastilla pastilla-ok">Invitada</span>
                          <code className="enlace-copiable">{enlaceDe(s.invitacion)}</code>
                          <button
                            type="button"
                            className="boton boton-chico boton-fantasma-borde"
                            onClick={() => void copiar(enlaceDe(s.invitacion!), s.invitacion!)}
                          >
                            <IconoCopiar width={15} height={15} /> {copiado === s.invitacion ? "Copiado" : "Copiar"}
                          </button>
                        </>
                      ) : s.estado === "descartada" ? (
                        <span className="pastilla">Descartada</span>
                      ) : (
                        <>
                          <button type="button" className="boton boton-chico" onClick={() => void atender(s.id, "invitar")}>
                            <IconoInvitar width={15} height={15} /> Crear su invitación
                          </button>
                          <button type="button" className="enlace enlace-discreto" onClick={() => void atender(s.id, "descartar")}>
                            Descartar
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="equipo-invitar">
            <h3>Invitar una empresa nueva</h3>
            <p className="texto-suave">Quien abre el enlace crea su cuenta y queda como dueña de una empresa nueva.</p>
            <form
              className="equipo-forma"
              onSubmit={(e) => {
                e.preventDefault();
                void invitar("empresa");
              }}
            >
              <label className="campo">
                <span>Nombre de la empresa (opcional; la dueña lo puede cambiar)</span>
                <input value={nombreEmpresa} onChange={(e) => setNombreEmpresa(e.target.value)} maxLength={60} />
              </label>
              <button type="submit" className="boton boton-secundario" disabled={creando !== null}>
                <IconoInvitar width={17} height={17} /> {creando === "empresa" ? "Creando…" : "Crear enlace"}
              </button>
            </form>
            {lista("empresa")}
          </div>
          <div className="equipo-invitar">
            <h3>Restablecer una contraseña</h3>
            <p className="texto-suave">
              Si alguien olvidó la suya, escribe su correo: se le pone una contraseña temporal que solo se muestra aquí, una
              vez. Dásela y pídele que la cambie en su perfil.
            </p>
            <form className="equipo-forma" onSubmit={restablecer}>
              <label className="campo">
                <span>Correo de la cuenta</span>
                <input type="email" value={correoOlvido} onChange={(e) => setCorreoOlvido(e.target.value)} />
              </label>
              <button type="submit" className="boton boton-secundario" disabled={!correoOlvido.trim()}>
                Dar contraseña temporal
              </button>
            </form>
            {temporal && (
              <p className="aviso-entrada" role="status">
                Contraseña temporal de {temporal.nombre} ({temporal.correo}): <code>{temporal.contrasena}</code>
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
